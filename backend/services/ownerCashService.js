import {
  OwnerCashAccountsRepo,
  OwnerCashTransfersRepo,
  OwnerCashReconciliationsRepo,
} from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';
import * as ownerIncomeService from './ownerIncomeService.js';
import * as ownerExpenseService from './ownerExpenseService.js';
import * as ownerAssetService from './ownerAssetService.js';
import * as ownerInventoryService from './ownerInventoryService.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

// --- Accounts ---

export async function listAccounts() {
  const rows = await OwnerCashAccountsRepo.getAll();
  return rows.map((a) => ({ ...clean(a), is_active: a.is_active !== 'false' }));
}

export async function createAccount({ name }) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new ApiError(400, 'Nama akun kas wajib diisi');
  const row = await OwnerCashAccountsRepo.insert({
    name: trimmed,
    is_active: 'true',
    created_at: new Date().toISOString(),
  });
  return { ...clean(row), is_active: true };
}

export async function updateAccount(id, { name, is_active }) {
  const patch = {};
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) throw new ApiError(400, 'Nama akun kas wajib diisi');
    patch.name = trimmed;
  }
  if (is_active !== undefined) patch.is_active = String(!!is_active);

  const updated = await OwnerCashAccountsRepo.updateById(id, patch);
  if (!updated) throw new ApiError(404, 'Akun kas tidak ditemukan');
  return { ...clean(updated), is_active: updated.is_active !== 'false' };
}

export async function deleteAccount(id) {
  const [transfers, reconciliations] = await Promise.all([
    OwnerCashTransfersRepo.getAll(),
    OwnerCashReconciliationsRepo.getAll(),
  ]);
  const referenced =
    transfers.some((t) => String(t.from_account_id) === String(id) || String(t.to_account_id) === String(id)) ||
    reconciliations.some((r) => String(r.account_id) === String(id));
  if (referenced) {
    throw new ApiError(400, 'Akun kas tidak bisa dihapus karena masih memiliki riwayat transaksi');
  }
  const deleted = await OwnerCashAccountsRepo.deleteById(id);
  if (!deleted) throw new ApiError(404, 'Akun kas tidak ditemukan');
}

// Every module that posts into a cash account (Transfers, Income, Expenses,
// cash-funded Asset/Inventory purchases) adds its own delta source here so
// the derived balance always reflects the full ledger, not just this
// module's slice of it.
async function computeBalances() {
  const [accounts, transfers, incomeByAccount, expensesByAccount, assetSpendByAccount, inventorySpendByAccount] =
    await Promise.all([
      OwnerCashAccountsRepo.getAll(),
      OwnerCashTransfersRepo.getAll(),
      ownerIncomeService.sumByAccount(),
      ownerExpenseService.sumByAccount(),
      ownerAssetService.sumCashSpendByAccount(),
      ownerInventoryService.sumCashSpendByAccount(),
    ]);

  // Keyed by String(id): a row just written by insert() sits in the
  // write-through cache with a numeric `id` (nextId() returns a number),
  // while every other read path stringifies it — same contract
  // SheetRepository.rowToObject documents for every field.
  const balances = new Map(accounts.map((a) => [String(a.id), 0]));
  for (const t of transfers) {
    const amount = Number(t.amount) || 0;
    const from = String(t.from_account_id);
    const to = String(t.to_account_id);
    if (balances.has(from)) balances.set(from, balances.get(from) - amount);
    if (balances.has(to)) balances.set(to, balances.get(to) + amount);
  }
  for (const [accountId, sum] of incomeByAccount) {
    if (balances.has(accountId)) balances.set(accountId, balances.get(accountId) + sum);
  }
  for (const [accountId, sum] of expensesByAccount) {
    if (balances.has(accountId)) balances.set(accountId, balances.get(accountId) - sum);
  }
  for (const [accountId, sum] of assetSpendByAccount) {
    if (balances.has(accountId)) balances.set(accountId, balances.get(accountId) - sum);
  }
  for (const [accountId, sum] of inventorySpendByAccount) {
    if (balances.has(accountId)) balances.set(accountId, balances.get(accountId) - sum);
  }
  // Reconciliations don't change the ledger-derived balance by definition —
  // they record a discrepancy against it, they don't correct it (owner.md
  // has no "apply adjustment" workflow, only a logged Lebih/Kurang/Sesuai
  // reading). Only a real transaction moves the derived balance.
  return { accounts, balances };
}

export async function getAccountBalances() {
  const { accounts, balances } = await computeBalances();
  const rows = accounts
    .filter((a) => a.is_active !== 'false')
    .map((a) => ({ id: a.id, name: a.name, balance: balances.get(String(a.id)) || 0 }));
  const total = rows.reduce((sum, r) => sum + r.balance, 0);
  return { accounts: rows, total };
}

async function getAccountBalance(accountId) {
  const { balances } = await computeBalances();
  const key = String(accountId);
  if (!balances.has(key)) throw new ApiError(400, 'Akun kas tidak valid');
  return balances.get(key);
}

// --- Mutasi Kas (transfers) ---

function enrichTransfer(row, accountsById) {
  return {
    ...clean(row),
    amount: Number(row.amount) || 0,
    from_account_name: accountsById.get(String(row.from_account_id))?.name || null,
    to_account_name: accountsById.get(String(row.to_account_id))?.name || null,
  };
}

export async function listTransfers() {
  const [rows, accounts] = await Promise.all([OwnerCashTransfersRepo.getAll(), OwnerCashAccountsRepo.getAll()]);
  const accountsById = new Map(accounts.map((a) => [String(a.id), a]));
  return rows
    .map((r) => enrichTransfer(r, accountsById))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

async function assertAccountsExist(...ids) {
  const accounts = await OwnerCashAccountsRepo.getAll();
  // Ids are compared as strings: a row just written by insert() sits in the
  // write-through cache with a numeric `id` (nextId() returns a number),
  // while every other read path (a real Sheets fetch) stringifies it — same
  // contract SheetRepository.rowToObject documents for every field.
  const byId = new Map(accounts.map((a) => [String(a.id), a]));
  for (const id of ids) {
    if (!byId.has(String(id))) throw new ApiError(400, 'Akun kas tidak valid');
  }
  return byId;
}

export async function createTransfer({ date, from_account_id, to_account_id, amount, description }) {
  if (from_account_id === to_account_id) {
    throw new ApiError(400, 'Akun tujuan harus berbeda dari akun sumber');
  }
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) throw new ApiError(400, 'Jumlah transfer tidak valid');
  const accountsById = await assertAccountsExist(from_account_id, to_account_id);

  const row = await OwnerCashTransfersRepo.insert({
    date,
    from_account_id,
    to_account_id,
    amount: amountNum,
    description: description || '',
    created_at: new Date().toISOString(),
  });
  return enrichTransfer(row, accountsById);
}

export async function updateTransfer(id, { date, from_account_id, to_account_id, amount, description }) {
  const existing = await OwnerCashTransfersRepo.getById(id);
  if (!existing) throw new ApiError(404, 'Mutasi kas tidak ditemukan');

  const nextFrom = from_account_id ?? existing.from_account_id;
  const nextTo = to_account_id ?? existing.to_account_id;
  if (nextFrom === nextTo) throw new ApiError(400, 'Akun tujuan harus berbeda dari akun sumber');
  const accountsById = await assertAccountsExist(nextFrom, nextTo);

  const patch = {};
  if (date !== undefined) patch.date = date;
  if (from_account_id !== undefined) patch.from_account_id = from_account_id;
  if (to_account_id !== undefined) patch.to_account_id = to_account_id;
  if (description !== undefined) patch.description = description;
  if (amount !== undefined) {
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) throw new ApiError(400, 'Jumlah transfer tidak valid');
    patch.amount = amountNum;
  }

  const updated = await OwnerCashTransfersRepo.updateById(id, patch);
  return enrichTransfer(updated, accountsById);
}

export async function deleteTransfer(id) {
  const deleted = await OwnerCashTransfersRepo.deleteById(id);
  if (!deleted) throw new ApiError(404, 'Mutasi kas tidak ditemukan');
}

// --- Penyesuaian Kas (reconciliations) ---

function computeDifference(systemBalance, actualBalance) {
  const difference = actualBalance - systemBalance;
  const status = difference > 0 ? 'over' : difference < 0 ? 'short' : 'matched';
  return { difference, status };
}

function enrichReconciliation(row, accountsById) {
  return {
    ...clean(row),
    system_balance: Number(row.system_balance) || 0,
    actual_balance: Number(row.actual_balance) || 0,
    difference: Number(row.difference) || 0,
    account_name: accountsById.get(String(row.account_id))?.name || null,
  };
}

export async function listReconciliations() {
  const [rows, accounts] = await Promise.all([
    OwnerCashReconciliationsRepo.getAll(),
    OwnerCashAccountsRepo.getAll(),
  ]);
  const accountsById = new Map(accounts.map((a) => [String(a.id), a]));
  return rows
    .map((r) => enrichReconciliation(r, accountsById))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// The "system balance" a fresh reconciliation form should show — always a
// live server read, never a value the client is allowed to just echo back
// (owner.md §4.4's explicit correctness fix over the original's client-cache
// bug).
export async function previewSystemBalance(accountId) {
  return { system_balance: await getAccountBalance(accountId) };
}

export async function createReconciliation({ date, account_id, actual_balance, description }) {
  const actualNum = Number(actual_balance);
  if (!Number.isFinite(actualNum)) throw new ApiError(400, 'Saldo aktual tidak valid');

  const accountsById = await assertAccountsExist(account_id);
  // Recomputed here, inside the write, from the live ledger — not trusted
  // from anything the client sent.
  const systemBalance = await getAccountBalance(account_id);
  const { difference, status } = computeDifference(systemBalance, actualNum);

  const row = await OwnerCashReconciliationsRepo.insert({
    date,
    account_id,
    system_balance: systemBalance,
    actual_balance: actualNum,
    difference,
    status,
    description: description || '',
    created_at: new Date().toISOString(),
  });
  return enrichReconciliation(row, accountsById);
}

export async function deleteReconciliation(id) {
  const deleted = await OwnerCashReconciliationsRepo.deleteById(id);
  if (!deleted) throw new ApiError(404, 'Penyesuaian kas tidak ditemukan');
}
