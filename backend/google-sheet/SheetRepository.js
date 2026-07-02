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
  constructor(sheetName, columns) {
    this.sheetName = sheetName;
    this.columns = columns;
    this.lastCol = colLetter(columns.length - 1);
  }

  rowToObject(row) {
    const obj = {};
    this.columns.forEach((col, i) => {
      obj[col] = row[i] ?? '';
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
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
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

  async getById(id) {
    const all = await this.getAll();
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

  async nextId() {
    const all = await this.getAll();
    const max = all.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
    return max + 1;
  }

  async insert(data) {
    return withLock(this.sheetName, async () => {
      const sheets = await getSheetsClient();
      const id = data.id ?? (await this.nextId());
      const record = { ...data, id };
      const row = this.objectToRow(record);
      const res = await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${this.sheetName}!A:${this.lastCol}`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
      });

      // Write-through only if the cache is already warm — seeding a cold
      // cache with just this one new row would make getAll() think it's the
      // *only* row in the sheet. When cold, leave it alone; the next getAll()
      // does a real fetch and sees the new row naturally.
      const entry = cache.get(this.sheetName);
      if (entry) {
        const updatedRange = res.data.updates?.updatedRange || '';
        const match = updatedRange.match(/![A-Z]+(\d+)/);
        const rowNumber = match ? Number(match[1]) : entry.data.length + 2;
        entry.data.push({ ...record, _rowNumber: rowNumber });
      }

      return record;
    });
  }

  async updateById(id, patch) {
    return withLock(this.sheetName, async () => {
      const existing = await this.findFreshIfMissing(id);
      if (!existing) return null;
      const { _rowNumber, ...current } = existing;
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
  const res = await sheets.spreadsheets.values.batchGet({ spreadsheetId: SPREADSHEET_ID, ranges });
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
