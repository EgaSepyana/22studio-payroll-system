import crypto from 'node:crypto';
import { getRedis } from '../config/redis.js';
import { getSheetsClient, SPREADSHEET_ID } from './sheetClient.js';

const locks = new Map();
const cache = new Map();
const sheetIdCache = new Map();
// Tracks a real fetch already underway per sheet, so N concurrent callers
// asking for the same cold sheet (e.g. Promise.all(logs.map(enrich)) hitting
// EmployeesRepo/CustomersRepo/ArticlesRepo at once) share one Sheets API call
// instead of each independently racing to fill the empty cache.
const inFlight = new Map();
// Write-through keeps this cache correct for every write this process makes,
// so the TTL now only bounds how long an *external* manual edit to the sheet
// can go unnoticed — safe to keep fairly long.
const CACHE_TTL_MS = 30_000;

function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(
    key,
    next.then(
      () => {},
      () => {}
    )
  );
  return next;
}

// `withLock` above only serializes inserts *within this process* — on a
// serverless platform (Vercel), a concurrent insert on a different instance
// has its own separate `locks` Map and doesn't see this one at all. That
// produced a real production incident: two different employees' Payroll
// rows both got id 528 (two inserts racing across instances), and every
// getById(528) lookup silently resolved to whichever row happened to sit
// first in the sheet — misrouting both the "view detail" and "mark as paid"
// actions for the *other* row (confirmed and manually repaired, Oct 2026).
// A retry-after-the-fact fix (re-check post-write, reassign on collision)
// was tried first and measurably failed under real contention: two
// processes racing in near-lockstep (same trigger moment, similar network
// latency — exactly what a real race looks like) kept recomputing the same
// candidate id together across retries even with randomized backoff between
// attempts (confirmed empirically: 2 of 5 trials of a live two-process race
// test still ended in a duplicate id). Correctness needs real mutual
// exclusion, not statistical avoidance — this uses the Redis (Upstash)
// already in this project's stack (config/redis.js, otherwise only used for
// the notification queue) as a distributed lock around id allocation, which
// every process *does* share. Random ids (UUIDs) would have sidestepped the
// race entirely with no lock needed, but ids are relied on elsewhere as
// monotonically-increasing-by-insertion-order (orderService.js/
// suratJalanService.js sort and compare with `Number(id)`), so that would
// have silently broken those call sites — not an option here.
const LOCK_TTL_MS = 10_000;
const LOCK_ACQUIRE_RETRY_MS = 100;
const LOCK_ACQUIRE_MAX_WAIT_MS = 15_000;

async function acquireIdLock(sheetName) {
  const redis = getRedis();
  if (!redis) return null; // No Redis configured — caller falls back to the local retry/reassign loop below.
  const key = `lock:nextid:${sheetName}`;
  const token = crypto.randomUUID();
  const deadline = Date.now() + LOCK_ACQUIRE_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      const ok = await redis.set(key, token, 'PX', LOCK_TTL_MS, 'NX');
      if (ok === 'OK') return { key, token };
    } catch (err) {
      // Redis unreachable right now — same "queue unavailable, fall back"
      // treatment config/redis.js's own call sites already give a Redis
      // failure, not a hard error for an insert.
      console.error('acquireIdLock: Redis error, falling back to local retry loop:', err.message);
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, LOCK_ACQUIRE_RETRY_MS));
  }
  return null; // Couldn't get the lock in time — fall back rather than block the request indefinitely.
}

// Lua CAS so this only ever deletes a lock *we* still hold — without this, a
// slow holder whose TTL already expired (and whose key some other process
// has since acquired) would delete that other process's lock out from under
// it instead of its own.
const RELEASE_LOCK_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

async function releaseIdLock(lock) {
  if (!lock) return;
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.eval(RELEASE_LOCK_SCRIPT, 1, lock.key, lock.token);
  } catch (err) {
    console.error('releaseIdLock: Redis error (lock will expire via TTL):', err.message);
  }
}

function colLetter(index) {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function rowsToData(repo, rows) {
  return rows
    .map((row, idx) => ({ ...repo.rowToObject(row), _rowNumber: idx + 2 }))
    .filter((obj) => obj.id !== '' && obj.id !== undefined);
}

/**
 * Generic CRUD repository backed by one Google Sheet tab.
 * Every resource (Users, Employees, Customers, Articles, WorkLogs, Payroll,
 * CashAdvances) reuses this instead of hand-rolled Sheets API calls per
 * resource.
 *
 * Every write (insert/update/delete) patches the in-memory cache directly
 * ("write-through") instead of invalidating it, so a burst of requests in the
 * same warm process — the common case under real traffic — costs at most one
 * real read per sheet, no matter how many reads/writes happen afterward.
 */
export class SheetRepository {
  // `idStrategy: 'uuid'` (Payroll only, see models.js) generates a random
  // id for every auto-generated insert instead of the default sequential
  // `nextId()` — this sidesteps the cross-process collision class entirely
  // (no coordination needed between processes when ids can't collide by
  // construction) rather than coordinating around it with the Redis lock
  // below. Left opt-in per-sheet, not the default, because other sheets'
  // ids are relied on elsewhere as monotonically-increasing-by-insertion-
  // order (orderService.js/suratJalanService.js sort and compare with
  // `Number(id)`) — switching those too would silently break that. Every
  // *existing* row, on every sheet, keeps whatever id it already has
  // regardless of this setting — this only governs what a *future*
  // auto-generated insert picks, so old numeric-id rows are untouched and
  // keep working exactly as before, side by side with new UUID rows.
  constructor(sheetName, columns, { idStrategy = 'sequential' } = {}) {
    this.sheetName = sheetName;
    this.columns = columns;
    this.lastCol = colLetter(columns.length - 1);
    this.idStrategy = idStrategy;
  }

  rowToObject(row) {
    const obj = {};
    this.columns.forEach((col, i) => {
      const v = row[i];
      // UNFORMATTED_VALUE returns numeric cells as real JS numbers (fixing
      // the locale-comma bug), but every id/comparison/String(x)===String(y)
      // check across the whole app — frontend included — assumes every
      // sheet-sourced field is a string, same as it always was. Stringify
      // immediately here so that contract holds: String(8.5) is always
      // "8.5" (dot decimal, no locale involved), unlike what Sheets would
      // have formatted it as.
      obj[col] = v === undefined || v === null ? '' : String(v);
    });
    return obj;
  }

  objectToRow(obj) {
    return this.columns.map((col) => {
      const v = obj[col];
      return v === undefined || v === null ? '' : v;
    });
  }

  invalidateCache() {
    cache.delete(this.sheetName);
  }

  async getSheetId() {
    if (sheetIdCache.has(this.sheetName)) return sheetIdCache.get(this.sheetName);
    const sheets = await getSheetsClient();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = meta.data.sheets.find((s) => s.properties.title === this.sheetName);
    if (!sheet) throw new Error(`Sheet tab not found: ${this.sheetName}`);
    sheetIdCache.set(this.sheetName, sheet.properties.sheetId);
    return sheet.properties.sheetId;
  }

  async getAll({ fresh = false } = {}) {
    const cached = cache.get(this.sheetName);
    if (!fresh && cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

    const existingFetch = inFlight.get(this.sheetName);
    if (existingFetch) return existingFetch;

    const fetchPromise = (async () => {
      const sheets = await getSheetsClient();
      const range = `${this.sheetName}!A2:${this.lastCol}`;
      // UNFORMATTED_VALUE is required: without it Sheets returns numeric
      // cells locale-formatted (e.g. "8,5" instead of 8.5 under an
      // Indonesian-locale spreadsheet), and Number("8,5") parses to NaN —
      // which then silently becomes 0 wherever the code falls back with
      // `|| 0`. This corrupted attendance hours (and any other numeric
      // field) and, downstream, payroll totals.
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range,
        valueRenderOption: 'UNFORMATTED_VALUE',
      });
      const data = rowsToData(this, res.data.values || []);
      cache.set(this.sheetName, { data, ts: Date.now() });
      return data;
    })();

    inFlight.set(this.sheetName, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      inFlight.delete(this.sheetName);
    }
  }

  async getById(id, { fresh = false } = {}) {
    const all = await this.getAll({ fresh });
    return all.find((r) => String(r.id) === String(id)) || null;
  }

  // Finds a row by id preferring whatever's already cached — only pays for a
  // real read when the row genuinely isn't in the cache yet (e.g. it was
  // written by a different serverless instance since our last fetch).
  async findFreshIfMissing(id) {
    let all = await this.getAll();
    let existing = all.find((r) => String(r.id) === String(id));
    if (!existing) {
      all = await this.getAll({ fresh: true });
      existing = all.find((r) => String(r.id) === String(id));
    }
    return existing || null;
  }

  // `fresh: true` (passed by insert() while it holds the distributed id
  // lock) forces a real read instead of trusting the possibly-30s-stale
  // cache — safe to pay for here since no other process can be allocating
  // an id on this sheet concurrently while we hold the lock, so this read
  // is the authoritative last word before we commit to a value.
  async nextId({ fresh = false } = {}) {
    const all = await this.getAll({ fresh });
    const max = all.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
    return max + 1;
  }

  async insert(data) {
    return withLock(this.sheetName, async () => {
      const sheets = await getSheetsClient();
      const hasExplicitId = data.id !== undefined;
      const usesUuid = this.idStrategy === 'uuid';
      // Cross-process mutual exclusion around id allocation (see the
      // acquireIdLock comment above) — only needed when we're the one
      // picking a *sequential* id; a caller-supplied id can't race with
      // nextId(), and a UUID can't collide with anything regardless of
      // timing, so neither needs this lock at all.
      const idLock = !hasExplicitId && !usesUuid ? await acquireIdLock(this.sheetName) : null;
      try {
        // Stringified immediately: nextId() returns a number, but every other
        // read path (rowToObject, used by every real getAll() fetch) stores
        // ids as strings. Without this, a create's response/write-through
        // cache entry carries a numeric id for up to the 30s cache TTL, while
        // a fresh fetch after that window returns it as a string — the same
        // "every sheet-sourced field is a string" contract rowToObject
        // documents, silently violated for one specific window.
        let id = hasExplicitId
          ? data.id
          : usesUuid
            ? crypto.randomUUID()
            : String(await this.nextId({ fresh: Boolean(idLock) }));
        let record = { ...data, id };
        const row = this.objectToRow(record);
        const res = await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${this.sheetName}!A:${this.lastCol}`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [row] },
        });

        const updatedRange = res.data.updates?.updatedRange || '';
        const match = updatedRange.match(/![A-Z]+(\d+)/);
        let rowNumber = match ? Number(match[1]) : null;

        // Fallback path only — for the sequential-id strategy, when the lock
        // above couldn't be acquired (Redis not configured, or contended
        // past LOCK_ACQUIRE_MAX_WAIT_MS), this is the only thing standing
        // between us and the id-collision incident described above.
        // Best-effort, not a guarantee: re-check with a fresh read now that
        // our own row is visible, and if another row still claims the same
        // id, reassign ours in place. Never runs for `usesUuid` — a UUID
        // can't collide, so there's nothing here to reassign away from.
        if (!hasExplicitId && !usesUuid && !idLock && rowNumber) {
          for (let attempt = 0; attempt < 5; attempt++) {
            const fresh = await this.getAll({ fresh: true });
            const collision = fresh.some((r) => r._rowNumber !== rowNumber && String(r.id) === String(id));
            if (!collision) break;

            // Jittered delay, then re-read, before picking the next candidate
            // — two processes racing on the same action tend to enter this
            // loop in near-lockstep (same trigger moment, similar network
            // latency), so without a delay they keep recomputing the
            // identical freshMax+1 together on every attempt. Even with this
            // jitter, confirmed empirically to still collide sometimes under
            // real contention — it narrows the window, it doesn't close it,
            // which is exactly why the lock above is the real fix and this
            // only runs when that lock isn't available.
            await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 250));
            const freshAfterDelay = await this.getAll({ fresh: true });
            const freshMax = freshAfterDelay.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
            id = String(freshMax + 1);
            record = { ...data, id };
            await sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID,
              range: `${this.sheetName}!A${rowNumber}`,
              valueInputOption: 'RAW',
              requestBody: { values: [[id]] },
            });
          }
        }

        // Write-through only if the cache is already warm — seeding a cold
        // cache with just this one new row would make getAll() think it's
        // the *only* row in the sheet. When cold, leave it alone; the next
        // getAll() does a real fetch and sees the new row naturally.
        const entry = cache.get(this.sheetName);
        if (entry) {
          entry.data.push({ ...record, _rowNumber: rowNumber ?? entry.data.length + 2 });
        }

        return record;
      } finally {
        await releaseIdLock(idLock);
      }
    });
  }

  // `patchOrFn` can be a plain object (merged as before) or a function
  // `(current) => patch`, invoked with the freshest row *inside* the lock.
  // Any caller doing a read-then-decide-then-write (e.g. "add qty to
  // completed_qty, recompute status") must use the function form — reading
  // the row *before* calling updateById and passing a precomputed patch
  // races against a concurrent updateById on the same id: both reads see the
  // same stale value, and whichever write lands second silently clobbers the
  // first (lost update), which is exactly what let a task's completed_qty
  // fall out of sync with its status.
  async updateById(id, patchOrFn) {
    return withLock(this.sheetName, async () => {
      const existing = await this.findFreshIfMissing(id);
      if (!existing) return null;
      const { _rowNumber, ...current } = existing;
      const patch = typeof patchOrFn === 'function' ? patchOrFn(current) : patchOrFn;
      const updated = { ...current, ...patch, id: current.id };
      const sheets = await getSheetsClient();
      const row = this.objectToRow(updated);
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${this.sheetName}!A${_rowNumber}:${this.lastCol}${_rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
      });
      // Write-through: `existing` is the live object sitting in the cache
      // array (getAll never clones), so mutating it keeps the cache correct
      // without a follow-up read.
      Object.assign(existing, patch, { id: current.id });
      return updated;
    });
  }

  async deleteById(id) {
    return withLock(this.sheetName, async () => {
      const existing = await this.findFreshIfMissing(id);
      if (!existing) return false;
      const sheets = await getSheetsClient();
      const sheetId = await this.getSheetId();
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: existing._rowNumber - 1,
                  endIndex: existing._rowNumber,
                },
              },
            },
          ],
        },
      });

      // Write-through: drop the row from cache and shift every row after it
      // up by one, since Google Sheets just closed that gap for real.
      const entry = cache.get(this.sheetName);
      if (entry) {
        const idx = entry.data.indexOf(existing);
        if (idx !== -1) entry.data.splice(idx, 1);
        for (const row of entry.data) {
          if (row._rowNumber > existing._rowNumber) row._rowNumber -= 1;
        }
      }

      return true;
    });
  }
}

// Fetches multiple sheets in a single Sheets API call (one quota unit
// regardless of how many ranges are requested) and warms each repo's cache.
// Returns each repo's rows in the same order as `repos`.
export async function batchGetAll(repos) {
  const sheets = await getSheetsClient();
  const ranges = repos.map((repo) => `${repo.sheetName}!A2:${repo.lastCol}`);
  // See the matching comment in getAll() — must match its render option so
  // both read paths parse numeric cells identically.
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const valueRanges = res.data.valueRanges || [];

  return repos.map((repo, i) => {
    const data = rowsToData(repo, valueRanges[i]?.values || []);
    cache.set(repo.sheetName, { data, ts: Date.now() });
    return data;
  });
}

// Writes rows across one or more sheets in a single Sheets API call.
// `entries`: [{ repo, existingRow, patch }] — existingRow must be the live
// object obtained from that repo's getAll()/findFreshIfMissing() so the
// write-through mutation below actually updates the cache.
export async function batchUpdateRows(entries) {
  if (entries.length === 0) return [];

  const sheets = await getSheetsClient();
  const data = [];
  const results = [];

  for (const { repo, existingRow, patch } of entries) {
    const { _rowNumber, ...current } = existingRow;
    const merged = { ...current, ...patch, id: current.id };
    data.push({
      range: `${repo.sheetName}!A${_rowNumber}:${repo.lastCol}${_rowNumber}`,
      values: [repo.objectToRow(merged)],
    });
    results.push(merged);
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'RAW', data },
  });

  entries.forEach(({ existingRow, patch }) => {
    Object.assign(existingRow, patch, { id: existingRow.id });
  });

  return results;
}
