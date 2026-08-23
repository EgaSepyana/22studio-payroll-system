import {
  OwnerFixedAssetsRepo,
  OwnerFixedAssetTransactionsRepo,
  OwnerCategoriesRepo,
  OwnerLocationsRepo,
} from '../google-sheet/models.js';
import { generateSequentialCode } from './codeGeneratorService.js';
import { applyFunding } from './ownerFundingService.js';
import { ApiError } from '../utils/response.js';
import * as ownerIncomeService from './ownerIncomeService.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

async function loadLookups() {
  const [categories, locations] = await Promise.all([OwnerCategoriesRepo.getAll(), OwnerLocationsRepo.getAll()]);
  return {
    categoriesById: new Map(categories.map((c) => [String(c.id), c])),
    locationsById: new Map(locations.map((l) => [String(l.id), l])),
  };
}

// Current qty/value = sum of this asset's transactions — the ledger model
// owner.md's plan explicitly picks over the original's conflated
// ledger+depreciation schema (§4.5's data-model note).
function summarizeTransactions(transactions) {
  return transactions.reduce(
    (acc, t) => {
      const qty = Number(t.qty) || 0;
      const value = Number(t.total_value) || 0;
      if (t.type === 'sale') {
        acc.qty -= qty;
        acc.value -= value;
      } else {
        acc.qty += qty;
        acc.value += value;
      }
      return acc;
    },
    { qty: 0, value: 0 }
  );
}

function enrichAsset(row, { categoriesById, locationsById, transactionsByAsset }) {
  const transactions = transactionsByAsset.get(String(row.id)) || [];
  const { qty, value } = summarizeTransactions(transactions);
  return {
    ...clean(row),
    category_name: categoriesById.get(String(row.category_id))?.name || null,
    location_name: locationsById.get(String(row.location_id))?.name || null,
    qty,
    value,
    unit_price: qty > 0 ? value / qty : 0,
  };
}

export async function listAssets({ search, category_id, location_id, sort } = {}) {
  const [assets, transactions, { categoriesById, locationsById }] = await Promise.all([
    OwnerFixedAssetsRepo.getAll(),
    OwnerFixedAssetTransactionsRepo.getAll(),
    loadLookups(),
  ]);

  const transactionsByAsset = new Map();
  for (const t of transactions) {
    const key = String(t.asset_id);
    if (!transactionsByAsset.has(key)) transactionsByAsset.set(key, []);
    transactionsByAsset.get(key).push(t);
  }

  let enriched = assets.map((a) => enrichAsset(a, { categoriesById, locationsById, transactionsByAsset }));

  if (category_id) enriched = enriched.filter((a) => String(a.category_id) === String(category_id));
  if (location_id) enriched = enriched.filter((a) => String(a.location_id) === String(location_id));
  if (search) {
    const needle = String(search).toLowerCase();
    enriched = enriched.filter((a) => a.name.toLowerCase().includes(needle) || a.code.toLowerCase().includes(needle));
  }

  if (sort === 'qty_asc') enriched.sort((a, b) => a.qty - b.qty);
  else if (sort === 'qty_desc') enriched.sort((a, b) => b.qty - a.qty);
  else enriched.sort((a, b) => a.name.localeCompare(b.name));

  return enriched;
}

export async function getAssetDetail(id) {
  const [asset, transactions, { categoriesById, locationsById }] = await Promise.all([
    OwnerFixedAssetsRepo.getById(id),
    OwnerFixedAssetTransactionsRepo.getAll(),
    loadLookups(),
  ]);
  if (!asset) throw new ApiError(404, 'Aset tidak ditemukan');

  const assetTransactions = transactions
    .filter((t) => String(t.asset_id) === String(id))
    .map((t) => ({ ...clean(t), qty: Number(t.qty) || 0, unit_price: Number(t.unit_price) || 0, total_value: Number(t.total_value) || 0 }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const transactionsByAsset = new Map([[String(id), transactions.filter((t) => String(t.asset_id) === String(id))]]);
  return { ...enrichAsset(asset, { categoriesById, locationsById, transactionsByAsset }), transactions: assetTransactions };
}

// "Input Aset Baru" — creates the identity with zero quantity/value.
export async function registerAsset({ date, name, category_id, location_id, description }) {
  const { categoriesById, locationsById } = await loadLookups();
  const category = categoriesById.get(String(category_id));
  if (!category || category.type !== 'asset') throw new ApiError(400, 'Kategori aset tidak valid');
  if (!locationsById.has(String(location_id))) throw new ApiError(400, 'Lokasi tidak valid');
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new ApiError(400, 'Nama aset wajib diisi');

  const code = await generateSequentialCode(OwnerFixedAssetsRepo, 'code', 'AST');
  const row = await OwnerFixedAssetsRepo.insert({
    code,
    date,
    name: trimmed,
    category_id,
    location_id,
    description: description || '',
    created_at: new Date().toISOString(),
  });
  return getAssetDetail(row.id);
}

// "Aset Beli / Masuk" — increases on-hand qty/value via one of three funding
// sources (owner.md §4.5).
export async function buyAsset({
  asset_id,
  date,
  qty,
  unit_price,
  funding_source,
  account_id,
  creditor_name,
  creditor_address,
  due_date,
  capital_source_name,
  capital_note,
}) {
  const asset = await OwnerFixedAssetsRepo.getById(asset_id);
  if (!asset) throw new ApiError(404, 'Aset tidak ditemukan');

  const qtyNum = Number(qty);
  const unitPriceNum = Number(unit_price);
  if (!Number.isFinite(qtyNum) || qtyNum <= 0) throw new ApiError(400, 'Kuantitas tidak valid');
  if (!Number.isFinite(unitPriceNum) || unitPriceNum < 0) throw new ApiError(400, 'Harga satuan tidak valid');
  const totalValue = qtyNum * unitPriceNum;

  const funding = await applyFunding({
    fundingSource: funding_source,
    value: totalValue,
    date,
    description: `Pembelian aset ${asset.code} — ${asset.name}`,
    accountId: account_id,
    creditorName: creditor_name,
    creditorAddress: creditor_address,
    dueDate: due_date,
    capitalSourceName: capital_source_name,
    capitalNote: capital_note,
    refType: 'asset',
  });

  await OwnerFixedAssetTransactionsRepo.insert({
    asset_id,
    date,
    type: 'purchase',
    qty: qtyNum,
    unit_price: unitPriceNum,
    total_value: totalValue,
    funding_source,
    account_id: funding.accountId || '',
    liability_id: funding.liabilityId || '',
    capital_entry_id: funding.capitalEntryId || '',
    description: '',
    created_at: new Date().toISOString(),
  });

  return getAssetDetail(asset_id);
}

// "Jual / Keluar" — cash-only sale (this phase's explicit scope), decreases
// on-hand qty/value and posts the sale amount into Income.
export async function sellAsset({ asset_id, date, qty, sale_price, account_id }) {
  const detail = await getAssetDetail(asset_id);
  const qtyNum = Number(qty);
  if (!Number.isFinite(qtyNum) || qtyNum <= 0) throw new ApiError(400, 'Kuantitas tidak valid');
  if (qtyNum > detail.qty) throw new ApiError(400, 'Kuantitas melebihi jumlah aset yang tersedia');

  const salePriceNum = sale_price !== undefined && sale_price !== null && sale_price !== '' ? Number(sale_price) : detail.unit_price;
  if (!Number.isFinite(salePriceNum) || salePriceNum < 0) throw new ApiError(400, 'Harga jual tidak valid');
  const totalValue = qtyNum * salePriceNum;

  if (!account_id) throw new ApiError(400, 'Akun kas tujuan wajib dipilih');

  await OwnerFixedAssetTransactionsRepo.insert({
    asset_id,
    date,
    type: 'sale',
    qty: qtyNum,
    unit_price: salePriceNum,
    total_value: totalValue,
    funding_source: '',
    account_id,
    liability_id: '',
    capital_entry_id: '',
    description: '',
    created_at: new Date().toISOString(),
  });

  const categories = await OwnerCategoriesRepo.getAll();
  const salesCategory = categories.find((c) => c.type === 'income' && c.is_active !== 'false');
  if (!salesCategory) {
    throw new ApiError(400, 'Belum ada kategori pemasukan aktif — tambahkan di Pengaturan Keuangan terlebih dahulu');
  }
  await ownerIncomeService.createIncome({
    date,
    category_id: salesCategory.id,
    account_id,
    amount: totalValue,
    description: `Penjualan aset ${detail.code} — ${detail.name}`,
  });

  return getAssetDetail(asset_id);
}

// The negative delta cash-funded asset purchases contribute to a cash
// account's derived balance — called from
// ownerCashService.computeBalances(). Cash-funded *sales* aren't summed
// here: they already post through ownerIncomeService.createIncome, which
// ownerCashService already counts, so summing them again here would
// double-count.
export async function sumCashSpendByAccount() {
  const transactions = await OwnerFixedAssetTransactionsRepo.getAll();
  const sums = new Map();
  for (const t of transactions) {
    if (t.type !== 'purchase' || t.funding_source !== 'cash') continue;
    const key = String(t.account_id);
    sums.set(key, (sums.get(key) || 0) + (Number(t.total_value) || 0));
  }
  return sums;
}

export async function deleteAsset(id) {
  const transactions = await OwnerFixedAssetTransactionsRepo.getAll();
  const hasHistory = transactions.some((t) => String(t.asset_id) === String(id));
  if (hasHistory) {
    throw new ApiError(400, 'Aset tidak bisa dihapus karena masih memiliki riwayat transaksi');
  }
  const deleted = await OwnerFixedAssetsRepo.deleteById(id);
  if (!deleted) throw new ApiError(404, 'Aset tidak ditemukan');
}
