import { OwnerIncomeRepo, OwnerExpensesRepo, OwnerReceivablesRepo } from '../google-sheet/models.js';
import * as ownerCashService from './ownerCashService.js';
import * as orderService from './orderService.js';

function currentMonthPrefix() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// Revenue/Expenses/Gross Profit "for the current period" (owner.md §4.1) —
// scoped to the current calendar month, matching the month-prefix filter
// Pemasukan/Pengeluaran already use elsewhere in this module.
async function getPeriodSummary() {
  const monthPrefix = currentMonthPrefix();
  const [income, expenses] = await Promise.all([OwnerIncomeRepo.getAll(), OwnerExpensesRepo.getAll()]);

  const revenue = income
    .filter((r) => typeof r.date === 'string' && r.date.startsWith(monthPrefix))
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const expense = expenses
    .filter((r) => typeof r.date === 'string' && r.date.startsWith(monthPrefix))
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  return { revenue, expense, gross_profit: revenue - expense };
}

async function getUnpaidReceivables() {
  const rows = await OwnerReceivablesRepo.getAll();
  return rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
}

// Orders received in the last 2 days (today + yesterday) — owner.md §4.1,
// read straight from the existing Orders system, unmodified.
async function getRecentOrders() {
  const orders = await orderService.listOrders();
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 1);
  twoDaysAgo.setHours(0, 0, 0, 0);

  return orders
    .filter((o) => new Date(o.created_at) >= twoDaysAgo)
    .map((o) => ({
      id: o.id,
      order_name: o.order_name,
      customer_name: o.customer_name,
      item_count: o.item_count,
      items_total: o.items_total,
      created_at: o.created_at,
    }));
}

// Simple month-over-month trend for the chart — last 6 months of
// Income/Expenses, same shape as the existing admin Dashboard's
// monthly_chart so the frontend can reuse the same ChartContainer pattern.
async function getMonthlyTrend() {
  const [income, expenses] = await Promise.all([OwnerIncomeRepo.getAll(), OwnerExpensesRepo.getAll()]);

  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
    months.push({ prefix, label });
  }

  return months.map(({ prefix, label }) => {
    const revenue = income
      .filter((r) => typeof r.date === 'string' && r.date.startsWith(prefix))
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const expense = expenses
      .filter((r) => typeof r.date === 'string' && r.date.startsWith(prefix))
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    return { label, revenue, expense };
  });
}

export async function getDashboard() {
  const [periodSummary, cashBalances, unpaidReceivables, recentOrders, monthlyTrend] = await Promise.all([
    getPeriodSummary(),
    ownerCashService.getAccountBalances(),
    getUnpaidReceivables(),
    getRecentOrders(),
    getMonthlyTrend(),
  ]);

  return {
    ...periodSummary,
    cash_accounts: cashBalances.accounts,
    total_cash: cashBalances.total,
    unpaid_receivables: unpaidReceivables,
    recent_orders: recentOrders,
    monthly_trend: monthlyTrend,
  };
}
