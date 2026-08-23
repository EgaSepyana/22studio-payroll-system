import { OwnerExpensesRepo, OwnerCategoriesRepo, OwnerCashAccountsRepo } from '../google-sheet/models.js';
import * as orderService from './orderService.js';
import { ApiError } from '../utils/response.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

function enrichExpense(row, categoriesById, accountsById, ordersById) {
  const order = row.order_id ? ordersById.get(String(row.order_id)) : null;
  return {
    ...clean(row),
    amount: Number(row.amount) || 0,
    category_name: categoriesById.get(String(row.category_id))?.name || null,
    account_name: accountsById.get(String(row.account_id))?.name || null,
    order_name: order?.order_name || null,
    customer_name: order?.customer_name || null,
    invoice_no: order?.invoice_no || null,
  };
}

async function loadLookups() {
  const [categories, accounts, orders] = await Promise.all([
    OwnerCategoriesRepo.getAll(),
    OwnerCashAccountsRepo.getAll(),
    orderService.listOrders(),
  ]);
  return {
    categoriesById: new Map(categories.map((c) => [String(c.id), c])),
    accountsById: new Map(accounts.map((a) => [String(a.id), a])),
    ordersById: new Map(orders.map((o) => [String(o.id), o])),
  };
}

export async function listExpenses({ category_id, order_search, account_id } = {}) {
  const [rows, lookups] = await Promise.all([OwnerExpensesRepo.getAll(), loadLookups()]);
  const { categoriesById, accountsById, ordersById } = lookups;

  let enriched = rows.map((r) => enrichExpense(r, categoriesById, accountsById, ordersById));

  if (category_id) enriched = enriched.filter((r) => String(r.category_id) === String(category_id));
  if (account_id) enriched = enriched.filter((r) => String(r.account_id) === String(account_id));
  if (order_search) {
    const needle = String(order_search).toLowerCase();
    enriched = enriched.filter(
      (r) =>
        r.order_name?.toLowerCase().includes(needle) ||
        r.customer_name?.toLowerCase().includes(needle) ||
        r.invoice_no?.toLowerCase().includes(needle)
    );
  }

  return enriched.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// Orders eligible for the Expenses "Pilih Invoice PROSES" picker — owner.md
// §4.3: only in-progress orders, searchable by invoice/customer/order name.
export async function listInProgressOrdersForPicker(search) {
  const orders = await orderService.listOrders({ status: 'On Progress' });
  if (!search) return orders;
  const needle = String(search).toLowerCase();
  return orders.filter(
    (o) =>
      o.order_name?.toLowerCase().includes(needle) ||
      o.customer_name?.toLowerCase().includes(needle) ||
      o.invoice_no?.toLowerCase().includes(needle)
  );
}

// Reusable "per-invoice P&L" query (owner.md §4.3's explicit note that this
// is useful standalone, e.g. an "order profitability" report) — total
// expenses logged against one order plus an estimated profit versus its
// invoice total.
export async function getOrderProfitability(orderId) {
  const [order, expenses] = await Promise.all([orderService.getOrderDetail(orderId), OwnerExpensesRepo.getAll()]);
  const linkedExpenses = expenses.filter((e) => String(e.order_id) === String(orderId));
  const totalExpenses = linkedExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  return {
    order_id: orderId,
    invoice_no: order.invoice_no,
    order_name: order.order_name,
    customer_name: order.customer_name,
    invoice_total: order.items_total,
    total_expenses: totalExpenses,
    estimated_profit: order.items_total - totalExpenses,
  };
}

export async function createExpense({ date, category_id, account_id, order_id, amount, description }) {
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) throw new ApiError(400, 'Jumlah tidak valid');

  const { categoriesById, accountsById, ordersById } = await loadLookups();
  if (!categoriesById.has(String(category_id))) throw new ApiError(400, 'Kategori tidak valid');
  if (!accountsById.has(String(account_id))) throw new ApiError(400, 'Akun kas tidak valid');
  if (order_id && !ordersById.has(String(order_id))) throw new ApiError(400, 'Order tidak valid');

  const row = await OwnerExpensesRepo.insert({
    date,
    category_id,
    account_id,
    order_id: order_id || '',
    amount: amountNum,
    description: description || '',
    created_at: new Date().toISOString(),
  });
  return enrichExpense(row, categoriesById, accountsById, ordersById);
}

export async function deleteExpense(id) {
  const deleted = await OwnerExpensesRepo.deleteById(id);
  if (!deleted) throw new ApiError(404, 'Pengeluaran tidak ditemukan');
}

// The negative delta Expenses contributes to a cash account's derived
// balance — called from ownerCashService.computeBalances().
export async function sumByAccount() {
  const rows = await OwnerExpensesRepo.getAll();
  const sums = new Map();
  for (const r of rows) {
    const key = String(r.account_id);
    sums.set(key, (sums.get(key) || 0) + (Number(r.amount) || 0));
  }
  return sums;
}
