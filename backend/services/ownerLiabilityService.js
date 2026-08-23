import {
  OwnerLiabilitiesRepo,
  OwnerLiabilityPaymentsRepo,
  OwnerCogsEntriesRepo,
  OwnerCategoriesRepo,
  OwnerCashAccountsRepo,
} from '../google-sheet/models.js';
import { generateSequentialCode } from './codeGeneratorService.js';
import { ApiError } from '../utils/response.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

function computeStatus(value, amountPaid) {
  if (amountPaid <= 0) return 'unpaid';
  if (amountPaid >= value) return 'paid';
  return 'partial';
}

async function syncCogsEntry({ liabilityId, categoriesById, categoryId, date, value, description }, existingCogsId) {
  const bucket = categoriesById.get(String(categoryId))?.cogs_bucket || 'generic';
  const patch = {
    source: 'liability',
    source_ref: String(liabilityId),
    date,
    bucket,
    amount: value,
    description,
    updated_at: new Date().toISOString(),
  };
  if (existingCogsId) {
    await OwnerCogsEntriesRepo.updateById(existingCogsId, patch);
    return existingCogsId;
  }
  const row = await OwnerCogsEntriesRepo.insert({ ...patch, created_at: patch.updated_at });
  return String(row.id);
}

function enrichLiability(row, categoriesById) {
  const value = Number(row.value) || 0;
  const amountPaid = Number(row.amount_paid) || 0;
  return {
    ...clean(row),
    qty: Number(row.qty) || 0,
    unit_price: Number(row.unit_price) || 0,
    value,
    amount_paid: amountPaid,
    remaining: value - amountPaid,
    category_name: categoriesById.get(String(row.category_id))?.name || null,
  };
}

async function loadCategoriesById() {
  const categories = await OwnerCategoriesRepo.getAll();
  return new Map(categories.map((c) => [String(c.id), c]));
}

export async function listLiabilities({ search, category_id, status } = {}) {
  const [rows, categoriesById] = await Promise.all([OwnerLiabilitiesRepo.getAll(), loadCategoriesById()]);
  let enriched = rows.map((r) => enrichLiability(r, categoriesById));

  if (category_id) enriched = enriched.filter((r) => String(r.category_id) === String(category_id));
  if (status) enriched = enriched.filter((r) => r.status === status);
  if (search) {
    const needle = String(search).toLowerCase();
    enriched = enriched.filter(
      (r) => r.code?.toLowerCase().includes(needle) || r.creditor_name?.toLowerCase().includes(needle)
    );
  }

  return enriched.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export async function getLiabilityDetail(id) {
  const [liability, categoriesById, payments, accounts] = await Promise.all([
    OwnerLiabilitiesRepo.getById(id),
    loadCategoriesById(),
    OwnerLiabilityPaymentsRepo.getAll(),
    OwnerCashAccountsRepo.getAll(),
  ]);
  if (!liability) throw new ApiError(404, 'Kewajiban tidak ditemukan');

  const accountsById = new Map(accounts.map((a) => [String(a.id), a]));
  const liabilityPayments = payments
    .filter((p) => String(p.liability_id) === String(id))
    .map((p) => ({
      ...clean(p),
      amount: Number(p.amount) || 0,
      account_name: accountsById.get(String(p.account_id))?.name || null,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return { ...enrichLiability(liability, categoriesById), payments: liabilityPayments };
}

// The one shared liability-creation code path owner.md §4.7 calls for —
// manual entry (ownerLiabilityController) and Asset/Inventory "funding
// source = Payable" purchases (ownerFundingService) all funnel through this
// single function rather than three separate implementations.
//
// `source` controls whether a COGS entry is synced: 'manual' (default, the
// Kewajiban page) is a real incurred cost with nothing else offsetting it,
// so it hits P&L immediately. 'funding' (Asset/Inventory buying on credit)
// does NOT sync a COGS entry — the cost is already represented by the
// purchased asset/inventory sitting on the books; recognizing it again as
// COGS here would double-count against equity and break the balance sheet
// (found and fixed during this phase's live verification — buying stock on
// credit was silently throwing Assets out of sync with Liabilities+Equity
// by the COGS amount every time). It only becomes a real P&L cost later,
// when that inventory is sold/consumed or the asset is used up.
export async function createLiability({
  date,
  due_date,
  creditor_name,
  creditor_address,
  category_id,
  qty,
  unit_price,
  description,
  source = 'manual',
}) {
  const categoriesById = await loadCategoriesById();
  const category = categoriesById.get(String(category_id));
  if (!category || category.type !== 'liability') throw new ApiError(400, 'Kategori kewajiban tidak valid');

  const qtyNum = Number(qty);
  const unitPriceNum = Number(unit_price);
  if (!Number.isFinite(qtyNum) || qtyNum <= 0) throw new ApiError(400, 'Kuantitas tidak valid');
  if (!Number.isFinite(unitPriceNum) || unitPriceNum < 0) throw new ApiError(400, 'Harga satuan tidak valid');
  const value = qtyNum * unitPriceNum;

  const code = await generateSequentialCode(OwnerLiabilitiesRepo, 'code', 'HTG');
  const now = new Date().toISOString();

  const row = await OwnerLiabilitiesRepo.insert({
    code,
    date,
    due_date: due_date || '',
    creditor_name,
    creditor_address: creditor_address || '',
    category_id,
    qty: qtyNum,
    unit_price: unitPriceNum,
    value,
    amount_paid: 0,
    status: 'unpaid',
    description: description || '',
    cogs_entry_id: '',
    source,
    created_at: now,
    updated_at: now,
  });

  if (source !== 'manual') {
    return enrichLiability(row, categoriesById);
  }

  const cogsId = await syncCogsEntry(
    {
      liabilityId: row.id,
      categoriesById,
      categoryId: category_id,
      date,
      value,
      description: `Kewajiban ${code} — ${creditor_name}`,
    },
    null
  );
  const updated = await OwnerLiabilitiesRepo.updateById(row.id, { cogs_entry_id: cogsId });
  return enrichLiability(updated, categoriesById);
}

export async function updateLiability(id, { date, due_date, creditor_name, creditor_address, category_id, qty, unit_price, description }) {
  const existing = await OwnerLiabilitiesRepo.getById(id);
  if (!existing) throw new ApiError(404, 'Kewajiban tidak ditemukan');

  const categoriesById = await loadCategoriesById();
  const nextCategoryId = category_id ?? existing.category_id;
  const category = categoriesById.get(String(nextCategoryId));
  if (!category || category.type !== 'liability') throw new ApiError(400, 'Kategori kewajiban tidak valid');

  const qtyNum = qty !== undefined ? Number(qty) : Number(existing.qty);
  const unitPriceNum = unit_price !== undefined ? Number(unit_price) : Number(existing.unit_price);
  if (!Number.isFinite(qtyNum) || qtyNum <= 0) throw new ApiError(400, 'Kuantitas tidak valid');
  if (!Number.isFinite(unitPriceNum) || unitPriceNum < 0) throw new ApiError(400, 'Harga satuan tidak valid');
  const value = qtyNum * unitPriceNum;

  // Preserves whatever has already been paid — recomputes remaining/status
  // against the new value (owner.md §4.7's explicit edit behavior).
  const amountPaid = Number(existing.amount_paid) || 0;
  if (amountPaid > value) {
    throw new ApiError(400, 'Nilai baru tidak boleh lebih kecil dari jumlah yang sudah dibayar');
  }

  const patch = {
    value,
    qty: qtyNum,
    unit_price: unitPriceNum,
    status: computeStatus(value, amountPaid),
    updated_at: new Date().toISOString(),
  };
  if (date !== undefined) patch.date = date;
  if (due_date !== undefined) patch.due_date = due_date;
  if (creditor_name !== undefined) patch.creditor_name = creditor_name;
  if (creditor_address !== undefined) patch.creditor_address = creditor_address;
  if (category_id !== undefined) patch.category_id = category_id;
  if (description !== undefined) patch.description = description;

  const updated = await OwnerLiabilitiesRepo.updateById(id, patch);

  // Only 'manual' liabilities ever have a COGS entry to keep in sync — see
  // createLiability's comment for why 'funding'-sourced ones never get one.
  if (existing.source !== 'funding') {
    await syncCogsEntry(
      {
        liabilityId: id,
        categoriesById,
        categoryId: nextCategoryId,
        date: updated.date,
        value,
        description: `Kewajiban ${updated.code} — ${updated.creditor_name}`,
      },
      existing.cogs_entry_id || null
    );
  }

  return enrichLiability(updated, categoriesById);
}

export async function deleteLiability(id) {
  const existing = await OwnerLiabilitiesRepo.getById(id);
  if (!existing) throw new ApiError(404, 'Kewajiban tidak ditemukan');
  if ((Number(existing.amount_paid) || 0) > 0) {
    throw new ApiError(400, 'Kewajiban tidak bisa dihapus karena sudah ada pembayaran');
  }

  if (existing.cogs_entry_id) {
    await OwnerCogsEntriesRepo.deleteById(existing.cogs_entry_id);
  }
  const deleted = await OwnerLiabilitiesRepo.deleteById(id);
  if (!deleted) throw new ApiError(404, 'Kewajiban tidak ditemukan');
}

// --- Payments ("Bayar") ---

export async function createPayment(liabilityId, { date, amount, account_id, description }) {
  const liability = await OwnerLiabilitiesRepo.getById(liabilityId);
  if (!liability) throw new ApiError(404, 'Kewajiban tidak ditemukan');

  const accounts = await OwnerCashAccountsRepo.getAll();
  if (!accounts.some((a) => String(a.id) === String(account_id))) throw new ApiError(400, 'Akun kas tidak valid');

  const value = Number(liability.value) || 0;
  const currentPaid = Number(liability.amount_paid) || 0;
  const remaining = value - currentPaid;

  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) throw new ApiError(400, 'Jumlah pembayaran tidak valid');
  if (amountNum > remaining) throw new ApiError(400, 'Jumlah pembayaran melebihi sisa kewajiban');

  const payment = await OwnerLiabilityPaymentsRepo.insert({
    liability_id: liabilityId,
    date,
    amount: amountNum,
    account_id,
    description: description || '',
    created_at: new Date().toISOString(),
  });

  const nextPaid = currentPaid + amountNum;
  await OwnerLiabilitiesRepo.updateById(liabilityId, {
    amount_paid: nextPaid,
    status: computeStatus(value, nextPaid),
    updated_at: new Date().toISOString(),
  });

  return clean(payment);
}

// Reverses a specific payment's effect — the one exception to "ledgers are
// append-only" this module has (owner.md §4.7's explicit compensating
// transaction).
export async function deletePayment(liabilityId, paymentId) {
  const [liability, payment] = await Promise.all([
    OwnerLiabilitiesRepo.getById(liabilityId),
    OwnerLiabilityPaymentsRepo.getById(paymentId),
  ]);
  if (!liability) throw new ApiError(404, 'Kewajiban tidak ditemukan');
  if (!payment || String(payment.liability_id) !== String(liabilityId)) {
    throw new ApiError(404, 'Pembayaran tidak ditemukan');
  }

  const value = Number(liability.value) || 0;
  const currentPaid = Number(liability.amount_paid) || 0;
  const nextPaid = Math.max(0, currentPaid - (Number(payment.amount) || 0));

  await OwnerLiabilityPaymentsRepo.deleteById(paymentId);
  await OwnerLiabilitiesRepo.updateById(liabilityId, {
    amount_paid: nextPaid,
    status: computeStatus(value, nextPaid),
    updated_at: new Date().toISOString(),
  });
}
