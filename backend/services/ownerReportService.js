import {
  OwnerIncomeRepo,
  OwnerExpensesRepo,
  OwnerCogsEntriesRepo,
  OwnerCategoriesRepo,
  OwnerCapitalEntriesRepo,
  OwnerEquityAdjustmentsRepo,
  OwnerReceivablesRepo,
} from '../google-sheet/models.js';
import * as ownerCashService from './ownerCashService.js';
import * as ownerAssetService from './ownerAssetService.js';
import * as ownerInventoryService from './ownerInventoryService.js';
import * as ownerLiabilityService from './ownerLiabilityService.js';

function inMonth(dateStr, monthPrefix) {
  return typeof dateStr === 'string' && dateStr.startsWith(monthPrefix);
}

// --- Laba Rugi (P&L) ---
//
// Computed directly from the ledger, not copied from spreadsheet formulas
// (owner.md §4.8's explicit instruction — the original's formulas were
// never visible in the source it was derived from). Decided with the user:
//
// - Revenue = the Income (Pemasukan) ledger for the month, full stop. Cash
//   sales of stock/assets already post into Income (ownerInventoryService /
//   ownerAssetService), so summing Income already captures them — no
//   separate aggregation, and no double-counting.
// - Credit stock sales (which post to Receivables, not Income) are
//   deliberately EXCLUDED from Revenue until collected — a cash-style P&L,
//   not accrual. They show up as a Receivables asset in Neraca instead.
// - Asset-sale proceeds are included in Revenue with no special-casing —
//   they're already indistinguishable from ordinary revenue in the Income
//   ledger, and the user chose not to add a field to separate them.
export async function getProfitLoss(month) {
  const [income, expenses, cogsEntries, categories] = await Promise.all([
    OwnerIncomeRepo.getAll(),
    OwnerExpensesRepo.getAll(),
    OwnerCogsEntriesRepo.getAll(),
    OwnerCategoriesRepo.getAll(),
  ]);
  const categoriesById = new Map(categories.map((c) => [String(c.id), c]));

  const monthIncome = income.filter((r) => inMonth(r.date, month));
  const monthExpenses = expenses.filter((r) => inMonth(r.date, month));
  const monthCogs = cogsEntries.filter((r) => inMonth(r.date, month));

  const revenueByCategory = groupSum(monthIncome, (r) => categoriesById.get(String(r.category_id))?.name || 'Lainnya');
  const expensesByCategory = groupSum(monthExpenses, (r) => categoriesById.get(String(r.category_id))?.name || 'Lainnya');
  const cogsByBucket = groupSum(monthCogs, (r) => COGS_BUCKET_LABEL[r.bucket] || 'HPP Umum');

  const totalRevenue = sumAmount(monthIncome);
  const totalCogs = sumAmount(monthCogs);
  const totalExpenses = sumAmount(monthExpenses);
  const grossProfit = totalRevenue - totalCogs;
  const netProfit = grossProfit - totalExpenses;

  return {
    month,
    revenue: { rows: revenueByCategory, total: totalRevenue },
    cogs: { rows: cogsByBucket, total: totalCogs },
    gross_profit: grossProfit,
    expenses: { rows: expensesByCategory, total: totalExpenses },
    net_profit: netProfit,
  };
}

const COGS_BUCKET_LABEL = {
  fabric_purchase: 'Pembelian Bahan',
  production_cost: 'Biaya Produksi',
  generic: 'HPP Umum',
};

function sumAmount(rows) {
  return rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
}

function groupSum(rows, keyFn) {
  const map = new Map();
  for (const r of rows) {
    const key = keyFn(r);
    map.set(key, (map.get(key) || 0) + (Number(r.amount) || 0));
  }
  return [...map.entries()].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
}

// Net profit across ALL history (not just one month) — the accumulation
// that feeds Neraca's Retained Earnings, computed the same way
// getProfitLoss computes one month, just without the date filter.
async function getCumulativeNetProfit() {
  const [income, expenses, cogsEntries] = await Promise.all([
    OwnerIncomeRepo.getAll(),
    OwnerExpensesRepo.getAll(),
    OwnerCogsEntriesRepo.getAll(),
  ]);
  const revenue = sumAmount(income);
  const cogs = sumAmount(cogsEntries);
  const expensesTotal = sumAmount(expenses);
  return revenue - cogs - expensesTotal;
}

// --- Neraca (Balance Sheet) ---
//
// Point-in-time aggregation over Cash, Inventory, Fixed Assets, Liabilities,
// and Capital/Retained Earnings (owner.md §4.9's explicit list). Equity is
// derived, not stored: Capital = sum of all-time Capital Entries; Retained
// Earnings = cumulative net profit since inception, adjusted by
// OwnerEquityAdjustments' write-downs (damaged/lost stock, always negative).
//
// Internally consistent by construction: every asset/inventory purchase
// funded by cash moves value between two asset lines (net zero); funded by
// payable adds equally to Assets and Liabilities; funded by capital adds
// equally to Assets and Equity. So Assets should equal Liabilities + Equity
// whenever every module's postings are correct — the discrepancy pill is a
// real sanity check, not decoration.
export async function getBalanceSheet() {
  const [cashBalances, assets, items, liabilities, capitalEntries, equityAdjustments, receivables, cumulativeNetProfit] =
    await Promise.all([
      ownerCashService.getAccountBalances(),
      ownerAssetService.listAssets(),
      ownerInventoryService.listItems(),
      ownerLiabilityService.listLiabilities(),
      OwnerCapitalEntriesRepo.getAll(),
      OwnerEquityAdjustmentsRepo.getAll(),
      OwnerReceivablesRepo.getAll(),
      getCumulativeNetProfit(),
    ]);

  const totalCash = cashBalances.total;
  const totalInventoryValue = items.reduce((sum, i) => sum + i.value, 0);
  const totalAssetValue = assets.reduce((sum, a) => sum + a.value, 0);
  const totalReceivables = receivables.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const totalAssets = totalCash + totalInventoryValue + totalAssetValue + totalReceivables;

  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.remaining, 0);

  const totalCapital = capitalEntries.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const totalEquityAdjustments = equityAdjustments.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const retainedEarnings = cumulativeNetProfit + totalEquityAdjustments;
  const totalEquity = totalCapital + retainedEarnings;

  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  const discrepancy = totalAssets - totalLiabilitiesAndEquity;
  const isBalanced = Math.abs(discrepancy) < 1;

  return {
    assets: {
      cash: { rows: cashBalances.accounts.map((a) => ({ label: a.name, total: a.balance })), total: totalCash },
      inventory: { total: totalInventoryValue },
      fixed_assets: { total: totalAssetValue },
      receivables: { total: totalReceivables },
      total: totalAssets,
    },
    liabilities: { total: totalLiabilities },
    equity: {
      capital: totalCapital,
      retained_earnings: retainedEarnings,
      total: totalEquity,
    },
    total_liabilities_and_equity: totalLiabilitiesAndEquity,
    discrepancy,
    is_balanced: isBalanced,
  };
}
