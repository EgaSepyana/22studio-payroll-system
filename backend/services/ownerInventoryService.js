import {
  OwnerInventoryItemsRepo,
  OwnerInventoryTransactionsRepo,
  OwnerCategoriesRepo,
  OwnerLocationsRepo,
  OwnerReceivablesRepo,
  OwnerEquityAdjustmentsRepo,
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

// Current qty/value = sum of this item's transactions (ledger model, same
// shape as Fixed Assets — owner.md §3's "ledger-first accounting pattern").
function summarizeTransactions(transactions) {
  return transactions.reduce(
    (acc, t) => {
      const qty = Number(t.qty) || 0;
      const value = Number(t.total_value) || 0;
      if (t.type === 'stock_out') {
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

function enrichItem(row, { categoriesById, locationsById, transactionsByItem }) {
  const transactions = transactionsByItem.get(String(row.id)) || [];
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

async function groupTransactionsByItem() {
  const transactions = await OwnerInventoryTransactionsRepo.getAll();
  const byItem = new Map();
  for (const t of transactions) {
    const key = String(t.item_id);
    if (!byItem.has(key)) byItem.set(key, []);
    byItem.get(key).push(t);
  }
  return { transactions, byItem };
}

export async function listItems({ search, category_id, location_id, item_type, sort } = {}) {
  const [items, { byItem: transactionsByItem }, { categoriesById, locationsById }] = await Promise.all([
    OwnerInventoryItemsRepo.getAll(),
    groupTransactionsByItem(),
    loadLookups(),
  ]);

  let enriched = items.map((i) => enrichItem(i, { categoriesById, locationsById, transactionsByItem }));

  if (category_id) enriched = enriched.filter((i) => String(i.category_id) === String(category_id));
  if (location_id) enriched = enriched.filter((i) => String(i.location_id) === String(location_id));
  if (item_type) enriched = enriched.filter((i) => i.item_type === item_type);
  if (search) {
    const needle = String(search).toLowerCase();
    enriched = enriched.filter((i) => i.name.toLowerCase().includes(needle) || i.code.toLowerCase().includes(needle));
  }

  if (sort === 'qty_asc') enriched.sort((a, b) => a.qty - b.qty);
  else if (sort === 'qty_desc') enriched.sort((a, b) => b.qty - a.qty);
  else enriched.sort((a, b) => a.name.localeCompare(b.name));

  return enriched;
}

export async function getItemDetail(id) {
  const [item, { transactions }, { categoriesById, locationsById }] = await Promise.all([
    OwnerInventoryItemsRepo.getById(id),
    groupTransactionsByItem(),
    loadLookups(),
  ]);
  if (!item) throw new ApiError(404, 'Item stok tidak ditemukan');

  const itemTransactions = transactions
    .filter((t) => String(t.item_id) === String(id))
    .map((t) => ({ ...clean(t), qty: Number(t.qty) || 0, unit_price: Number(t.unit_price) || 0, total_value: Number(t.total_value) || 0 }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const byItem = new Map([[String(id), transactions.filter((t) => String(t.item_id) === String(id))]]);
  return { ...enrichItem(item, { categoriesById, locationsById, transactionsByItem: byItem }), transactions: itemTransactions };
}

// "Input Stok" — registers the item identity and its opening quantity in
// one step (owner.md §4.6 folds these together, unlike Aset's separate
// "register identity" / "buy more" split).
export async function registerItem({
  date,
  name,
  category_id,
  location_id,
  item_type,
  qty,
  unit_price,
  description,
  funding_source,
  account_id,
  creditor_name,
  creditor_address,
  due_date,
  capital_source_name,
  capital_note,
}) {
  const { categoriesById, locationsById } = await loadLookups();
  const category = categoriesById.get(String(category_id));
  if (!category || category.type !== 'inventory') throw new ApiError(400, 'Kategori stok tidak valid');
  if (!locationsById.has(String(location_id))) throw new ApiError(400, 'Lokasi tidak valid');
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new ApiError(400, 'Nama item wajib diisi');

  const qtyNum = Number(qty);
  const unitPriceNum = Number(unit_price);
  if (!Number.isFinite(qtyNum) || qtyNum <= 0) throw new ApiError(400, 'Kuantitas tidak valid');
  if (!Number.isFinite(unitPriceNum) || unitPriceNum < 0) throw new ApiError(400, 'Harga satuan tidak valid');
  const totalValue = qtyNum * unitPriceNum;

  const prefix = item_type === 'finished_good' ? 'PRD' : 'BRG';
  const code = await generateSequentialCode(OwnerInventoryItemsRepo, 'code', prefix);

  const item = await OwnerInventoryItemsRepo.insert({
    code,
    date,
    name: trimmed,
    category_id,
    location_id,
    item_type,
    description: description || '',
    created_at: new Date().toISOString(),
  });

  const funding = await applyFunding({
    fundingSource: funding_source,
    value: totalValue,
    date,
    description: `Stok awal ${code} — ${trimmed}`,
    accountId: account_id,
    creditorName: creditor_name,
    creditorAddress: creditor_address,
    dueDate: due_date,
    capitalSourceName: capital_source_name,
    capitalNote: capital_note,
    refType: 'inventory',
  });

  await OwnerInventoryTransactionsRepo.insert({
    item_id: item.id,
    date,
    type: 'opening',
    qty: qtyNum,
    unit_price: unitPriceNum,
    total_value: totalValue,
    funding_source,
    account_id: funding.accountId || '',
    liability_id: funding.liabilityId || '',
    capital_entry_id: funding.capitalEntryId || '',
    exit_type: '',
    sale_method: '',
    linked_transaction_id: '',
    description: '',
    created_at: new Date().toISOString(),
  });

  return getItemDetail(item.id);
}

export async function updateItem(id, { name, category_id, location_id, description }) {
  const existing = await OwnerInventoryItemsRepo.getById(id);
  if (!existing) throw new ApiError(404, 'Item stok tidak ditemukan');

  const patch = {};
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) throw new ApiError(400, 'Nama item wajib diisi');
    patch.name = trimmed;
  }
  if (category_id !== undefined) patch.category_id = category_id;
  if (location_id !== undefined) patch.location_id = location_id;
  if (description !== undefined) patch.description = description;

  await OwnerInventoryItemsRepo.updateById(id, patch);
  return getItemDetail(id);
}

// "Stok Masuk" — restock, same funding-source pattern as registerItem.
export async function stockIn({
  item_id,
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
  const detail = await getItemDetail(item_id);

  const qtyNum = Number(qty);
  const unitPriceNum = unit_price !== undefined && unit_price !== null && unit_price !== '' ? Number(unit_price) : detail.unit_price;
  if (!Number.isFinite(qtyNum) || qtyNum <= 0) throw new ApiError(400, 'Kuantitas tidak valid');
  if (!Number.isFinite(unitPriceNum) || unitPriceNum < 0) throw new ApiError(400, 'Harga satuan tidak valid');
  const totalValue = qtyNum * unitPriceNum;

  const funding = await applyFunding({
    fundingSource: funding_source,
    value: totalValue,
    date,
    description: `Stok masuk ${detail.code} — ${detail.name}`,
    accountId: account_id,
    creditorName: creditor_name,
    creditorAddress: creditor_address,
    dueDate: due_date,
    capitalSourceName: capital_source_name,
    capitalNote: capital_note,
    refType: 'inventory',
  });

  await OwnerInventoryTransactionsRepo.insert({
    item_id,
    date,
    type: 'stock_in',
    qty: qtyNum,
    unit_price: unitPriceNum,
    total_value: totalValue,
    funding_source,
    account_id: funding.accountId || '',
    liability_id: funding.liabilityId || '',
    capital_entry_id: funding.capitalEntryId || '',
    exit_type: '',
    sale_method: '',
    linked_transaction_id: '',
    description: '',
    created_at: new Date().toISOString(),
  });

  return getItemDetail(item_id);
}

async function insertStockOut(item, { date, qty, unitPrice, exitType, saleMethod, linkedTransactionId, description }) {
  const totalValue = qty * unitPrice;
  const row = await OwnerInventoryTransactionsRepo.insert({
    item_id: item.id,
    date,
    type: 'stock_out',
    qty,
    unit_price: unitPrice,
    total_value: totalValue,
    funding_source: '',
    account_id: '',
    liability_id: '',
    capital_entry_id: '',
    exit_type: exitType,
    sale_method: saleMethod || '',
    linked_transaction_id: linkedTransactionId || '',
    description: description || '',
    created_at: new Date().toISOString(),
  });
  return { row, totalValue };
}

// "Stok Keluar" — one required exit type, three completely different
// downstream postings (owner.md §4.6):
//   production -> consumes this item, creates/restocks a finished-goods item
//                 at equivalent value, no revenue/expense recognized
//   sold       -> cash: posts to Income; credit: posts to Receivables
//   damaged    -> posts a negative equity adjustment
export async function stockOut(params) {
  const { item_id, date, qty, exit_type } = params;
  const detail = await getItemDetail(item_id);

  const qtyNum = Number(qty);
  if (!Number.isFinite(qtyNum) || qtyNum <= 0) throw new ApiError(400, 'Kuantitas tidak valid');
  if (qtyNum > detail.qty) throw new ApiError(400, 'Kuantitas melebihi stok yang tersedia');

  if (exit_type === 'production') {
    return stockOutProduction(detail, { ...params, qtyNum });
  }
  if (exit_type === 'sold') {
    return stockOutSold(detail, { ...params, qtyNum });
  }
  if (exit_type === 'damaged') {
    return stockOutDamaged(detail, { ...params, qtyNum });
  }
  throw new ApiError(400, 'Tipe keluar tidak valid');
}

async function stockOutProduction(
  sourceItem,
  { date, qtyNum, output_code, output_name, output_category_id, output_location_id, description }
) {
  const unitPrice = sourceItem.unit_price;
  const { row: outRow, totalValue } = await insertStockOut(sourceItem, {
    date,
    qty: qtyNum,
    unitPrice,
    exitType: 'production',
    description,
  });

  if (!output_name) throw new ApiError(400, 'Nama item hasil produksi wajib diisi');
  const { categoriesById, locationsById } = await loadLookups();
  const outputCategoryId = output_category_id || sourceItem.category_id;
  const outputLocationId = output_location_id || sourceItem.location_id;
  if (!categoriesById.has(String(outputCategoryId))) throw new ApiError(400, 'Kategori item hasil produksi tidak valid');
  if (!locationsById.has(String(outputLocationId))) throw new ApiError(400, 'Lokasi item hasil produksi tidak valid');

  // Restock an existing finished-goods item by name if one is already
  // registered at this category/location, otherwise create a new one —
  // owner.md says "creates or restocks", so a name+category+location match
  // is treated as the same SKU.
  const allItems = await OwnerInventoryItemsRepo.getAll();
  let outputItem = allItems.find(
    (i) =>
      i.item_type === 'finished_good' &&
      i.name.toLowerCase() === String(output_name).trim().toLowerCase() &&
      String(i.category_id) === String(outputCategoryId) &&
      String(i.location_id) === String(outputLocationId)
  );

  if (!outputItem) {
    const code = output_code || (await generateSequentialCode(OwnerInventoryItemsRepo, 'code', 'PRD'));
    outputItem = await OwnerInventoryItemsRepo.insert({
      code,
      date,
      name: String(output_name).trim(),
      category_id: outputCategoryId,
      location_id: outputLocationId,
      item_type: 'finished_good',
      description: '',
      created_at: new Date().toISOString(),
    });
  }

  // Equivalent value, no revenue/expense recognized — pure internal
  // transformation (owner.md's explicit note).
  const outputQty = qtyNum;
  const outputUnitPrice = outputQty > 0 ? totalValue / outputQty : 0;
  await OwnerInventoryTransactionsRepo.insert({
    item_id: outputItem.id,
    date,
    type: 'stock_in',
    qty: outputQty,
    unit_price: outputUnitPrice,
    total_value: totalValue,
    funding_source: '',
    account_id: '',
    liability_id: '',
    capital_entry_id: '',
    exit_type: '',
    sale_method: '',
    linked_transaction_id: String(outRow.id),
    description: `Hasil produksi dari ${sourceItem.code} — ${sourceItem.name}`,
    created_at: new Date().toISOString(),
  });

  return { source: await getItemDetail(sourceItem.id), output: await getItemDetail(outputItem.id) };
}

async function stockOutSold(item, { date, qtyNum, sale_price, sale_method, account_id, description }) {
  const salePriceNum = sale_price !== undefined && sale_price !== null && sale_price !== '' ? Number(sale_price) : item.unit_price;
  if (!Number.isFinite(salePriceNum) || salePriceNum < 0) throw new ApiError(400, 'Harga jual tidak valid');

  if (sale_method === 'cash') {
    if (!account_id) throw new ApiError(400, 'Akun kas tujuan wajib dipilih');
  } else if (sale_method !== 'credit') {
    throw new ApiError(400, 'Metode penjualan tidak valid');
  }

  const { totalValue } = await insertStockOut(item, {
    date,
    qty: qtyNum,
    unitPrice: salePriceNum,
    exitType: 'sold',
    saleMethod: sale_method,
    description,
  });

  if (sale_method === 'cash') {
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
      description: `Penjualan stok ${item.code} — ${item.name}`,
    });
  } else {
    await OwnerReceivablesRepo.insert({
      date,
      source: 'inventory_sale',
      source_ref: String(item.id),
      amount: totalValue,
      description: `Penjualan kredit ${item.code} — ${item.name}`,
      created_at: new Date().toISOString(),
    });
  }

  return { source: await getItemDetail(item.id) };
}

async function stockOutDamaged(item, { date, qtyNum, loss_value, description }) {
  const carryingCost = item.qty > 0 ? item.value / item.qty : 0;
  const lossValueNum = loss_value !== undefined && loss_value !== null && loss_value !== '' ? Number(loss_value) : carryingCost * qtyNum;
  if (!Number.isFinite(lossValueNum) || lossValueNum < 0) throw new ApiError(400, 'Nilai kerugian tidak valid');

  await insertStockOut(item, { date, qty: qtyNum, unitPrice: carryingCost, exitType: 'damaged', description });

  await OwnerEquityAdjustmentsRepo.insert({
    date,
    account: 'retained_earnings',
    amount: -lossValueNum,
    source_ref: String(item.id),
    description: `Stok rusak/hilang ${item.code} — ${item.name}`,
    created_at: new Date().toISOString(),
  });

  return { source: await getItemDetail(item.id) };
}

// The negative delta cash-funded stock purchases (opening + stock_in)
// contribute to a cash account's derived balance — called from
// ownerCashService.computeBalances(). Cash sales aren't summed here: they
// already post through ownerIncomeService.createIncome, which
// ownerCashService already counts, so summing them again here would
// double-count.
export async function sumCashSpendByAccount() {
  const { transactions } = await groupTransactionsByItem();
  const sums = new Map();
  for (const t of transactions) {
    if ((t.type !== 'opening' && t.type !== 'stock_in') || t.funding_source !== 'cash') continue;
    const key = String(t.account_id);
    sums.set(key, (sums.get(key) || 0) + (Number(t.total_value) || 0));
  }
  return sums;
}

export async function deleteItem(id) {
  const { byItem } = await groupTransactionsByItem();
  if ((byItem.get(String(id)) || []).length > 0) {
    throw new ApiError(400, 'Item tidak bisa dihapus karena masih memiliki riwayat transaksi');
  }
  const deleted = await OwnerInventoryItemsRepo.deleteById(id);
  if (!deleted) throw new ApiError(404, 'Item stok tidak ditemukan');
}
