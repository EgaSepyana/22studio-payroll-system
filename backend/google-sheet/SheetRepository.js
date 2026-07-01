import { getSheetsClient, SPREADSHEET_ID } from './sheetClient.js';

const locks = new Map();
const cache = new Map();
const sheetIdCache = new Map();
const CACHE_TTL_MS = 4000;

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

/**
 * Generic CRUD repository backed by one Google Sheet tab.
 * Every resource (Users, Employees, Customers, Articles, WorkLogs, Payroll)
 * reuses this instead of hand-rolled Sheets API calls per resource.
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

    const sheets = await getSheetsClient();
    const range = `${this.sheetName}!A2:${this.lastCol}`;
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
    const rows = res.data.values || [];

    const data = rows
      .map((row, idx) => ({ ...this.rowToObject(row), _rowNumber: idx + 2 }))
      .filter((obj) => obj.id !== '' && obj.id !== undefined);

    cache.set(this.sheetName, { data, ts: Date.now() });
    return data;
  }

  async getById(id) {
    const all = await this.getAll();
    return all.find((r) => String(r.id) === String(id)) || null;
  }

  async nextId() {
    const all = await this.getAll({ fresh: true });
    const max = all.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
    return max + 1;
  }

  async insert(data) {
    return withLock(this.sheetName, async () => {
      const sheets = await getSheetsClient();
      const id = data.id ?? (await this.nextId());
      const record = { ...data, id };
      const row = this.objectToRow(record);
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${this.sheetName}!A:${this.lastCol}`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
      });
      this.invalidateCache();
      return record;
    });
  }

  async updateById(id, patch) {
    return withLock(this.sheetName, async () => {
      const all = await this.getAll({ fresh: true });
      const existing = all.find((r) => String(r.id) === String(id));
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
      this.invalidateCache();
      return updated;
    });
  }

  async deleteById(id) {
    return withLock(this.sheetName, async () => {
      const all = await this.getAll({ fresh: true });
      const existing = all.find((r) => String(r.id) === String(id));
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
      this.invalidateCache();
      return true;
    });
  }
}
