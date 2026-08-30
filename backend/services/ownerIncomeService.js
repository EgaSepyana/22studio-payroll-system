import { OwnerIncomeRepo, OwnerCategoriesRepo, OwnerCashAccountsRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

function enrichIncome(row, categoriesById, accountsById) {
  return {
    ...clean(row),
    amount: Number(row.amount) || 0,
    category_name: categoriesById.get(String(row.category_id))?.name || null,
    is_sales_category: categoriesById.get(String(row.category_id))?.is_sales_category === 'true',
    account_name: accountsById.get(String(row.account_id))?.name || null,
  };
}

async function loadLookups() {
  const [categories, accounts] = await Promise.all([OwnerCategoriesRepo.getAll(), OwnerCashAccountsRepo.getAll()]);
  return {
    categoriesById: new Map(categories.map((c) => [String(c.id), c])),
    accountsById: new Map(accounts.map((a) => [String(a.id), a])),
  };
}

export async function listIncome({ category_id, month, account_id } = {}) {
  const [rows, { categoriesById, accountsById }] = await Promise.all([OwnerIncomeRepo.getAll(), loadLookups()]);

  let filtered = rows;
  if (category_id) filtered = filtered.filter((r) => String(r.category_id) === String(category_id));
  if (account_id) filtered = filtered.filter((r) => String(r.account_id) === String(account_id));
  if (month) filtered = filtered.filter((r) => typeof r.date === 'string' && r.date.startsWith(month));

  return filtered
    .map((r) => enrichIncome(r, categoriesById, accountsById))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export async function createIncome({ date, category_id, account_id, amount, description }) {
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) throw new ApiError(400, 'Jumlah tidak valid');

  const { categoriesById, accountsById } = await loadLookups();
  if (!categoriesById.has(String(category_id))) throw new ApiError(400, 'Kategori tidak valid');
  if (!accountsById.has(String(account_id))) throw new ApiError(400, 'Akun kas tidak valid');

  const row = await OwnerIncomeRepo.insert({
    date,
    category_id,
    account_id,
    amount: amountNum,
    description: description || '',
    created_at: new Date().toISOString(),
  });
  return enrichIncome(row, categoriesById, accountsById);
}

// Used by the Pemasukan page's own edit flow (if any) and by
// orderService.updateOrderDP to keep an Order Pembayaran's linked Income row
// in sync when the payment's amount/date/category changes after creation.
export async function updateIncome(id, { date, category_id, account_id, amount, description }) {
  const existing = await OwnerIncomeRepo.getById(id);
  if (!existing) throw new ApiError(404, 'Pemasukan tidak ditemukan');

  const { categoriesById, accountsById } = await loadLookups();
  const patch = {};
  if (date !== undefined) patch.date = date;
  if (description !== undefined) patch.description = description;
  if (category_id !== undefined) {
    if (!categoriesById.has(String(category_id))) throw new ApiError(400, 'Kategori tidak valid');
    patch.category_id = category_id;
  }
  if (account_id !== undefined) {
    if (!accountsById.has(String(account_id))) throw new ApiError(400, 'Akun kas tidak valid');
    patch.account_id = account_id;
  }
  if (amount !== undefined) {
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) throw new ApiError(400, 'Jumlah tidak valid');
    patch.amount = amountNum;
  }

  const updated = await OwnerIncomeRepo.updateById(id, patch);
  return enrichIncome(updated, categoriesById, accountsById);
}

export async function deleteIncome(id) {
  const deleted = await OwnerIncomeRepo.deleteById(id);
  if (!deleted) throw new ApiError(404, 'Pemasukan tidak ditemukan');
}

// The positive delta Income contributes to a cash account's derived balance
// — called from ownerCashService.computeBalances() alongside every other
// money-moving module, never duplicated into its own balance calculation.
export async function sumByAccount() {
  const rows = await OwnerIncomeRepo.getAll();
  const sums = new Map();
  for (const r of rows) {
    const key = String(r.account_id);
    sums.set(key, (sums.get(key) || 0) + (Number(r.amount) || 0));
  }
  return sums;
}
