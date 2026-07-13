import { SuratJalanRepo, SuratJalanItemsRepo, CustomersRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

// Numbers like SJ-0001, SJ-0002... — the next number is derived from the
// highest existing suffix, not the row count, so a deleted document never
// gets its number reused.
async function generateNoDocument() {
  const rows = await SuratJalanRepo.getAll();
  let max = 0;
  for (const row of rows) {
    const match = /^SJ-(\d+)$/.exec(row.no_document || '');
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `SJ-${String(max + 1).padStart(4, '0')}`;
}

function enrichItem(item) {
  return {
    ...clean(item),
    qty: Number(item.qty),
  };
}

function enrichHeader(row, { customers, items }) {
  const customer = customers.find((c) => String(c.id) === String(row.customer_id));
  const ownItems = items.filter((i) => String(i.surat_jalan_id) === String(row.id)).map(enrichItem);
  return {
    ...clean(row),
    customer_name: customer?.name || null,
    item_count: ownItems.length,
  };
}

export async function createSuratJalan({ customer_id, penerima_nama, penerima_telepon, penerima_alamat }) {
  const customer = await CustomersRepo.getById(customer_id);
  if (!customer) throw new ApiError(400, 'Customer tidak valid');

  const no_document = await generateNoDocument();
  const row = await SuratJalanRepo.insert({
    no_document,
    customer_id,
    penerima_nama: penerima_nama || '',
    penerima_telepon: penerima_telepon || '',
    penerima_alamat: penerima_alamat || '',
    created_at: new Date().toISOString(),
  });

  return enrichHeader(row, { customers: [customer], items: [] });
}

export async function listSuratJalan(filters = {}) {
  const [rows, customers, items] = await Promise.all([
    SuratJalanRepo.getAll(),
    CustomersRepo.getAll(),
    SuratJalanItemsRepo.getAll(),
  ]);

  let filtered = rows;
  if (filters.customer_id) {
    filtered = filtered.filter((r) => String(r.customer_id) === String(filters.customer_id));
  }
  if (filters.date_from) {
    filtered = filtered.filter((r) => r.created_at >= filters.date_from);
  }
  if (filters.date_to) {
    filtered = filtered.filter((r) => r.created_at <= `${filters.date_to}T23:59:59`);
  }

  filtered = [...filtered].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return filtered.map((row) => enrichHeader(row, { customers, items }));
}

async function getHeaderOrThrow(id) {
  const row = await SuratJalanRepo.getById(id);
  if (!row) throw new ApiError(404, 'Surat Jalan tidak ditemukan');
  return row;
}

export async function getSuratJalanDetail(id) {
  const row = await getHeaderOrThrow(id);
  const [customers, items] = await Promise.all([CustomersRepo.getAll(), SuratJalanItemsRepo.getAll()]);
  const header = enrichHeader(row, { customers, items });
  const ownItems = items
    .filter((i) => String(i.surat_jalan_id) === String(id))
    .map(enrichItem)
    .sort((a, b) => Number(a.id) - Number(b.id));

  return { ...header, items: ownItems };
}

export async function updateSuratJalan(id, { customer_id, penerima_nama, penerima_telepon, penerima_alamat }) {
  await getHeaderOrThrow(id);

  const patch = {};
  let customer;
  if (customer_id !== undefined) {
    customer = await CustomersRepo.getById(customer_id);
    if (!customer) throw new ApiError(400, 'Customer tidak valid');
    patch.customer_id = customer_id;
  }
  if (penerima_nama !== undefined) patch.penerima_nama = penerima_nama;
  if (penerima_telepon !== undefined) patch.penerima_telepon = penerima_telepon;
  if (penerima_alamat !== undefined) patch.penerima_alamat = penerima_alamat;

  const updated = await SuratJalanRepo.updateById(id, patch);

  const [customers, items] = await Promise.all([CustomersRepo.getAll(), SuratJalanItemsRepo.getAll()]);
  return enrichHeader(updated, { customers, items });
}

export async function deleteSuratJalan(id) {
  await getHeaderOrThrow(id);

  const items = await SuratJalanItemsRepo.getAll();
  const ownItems = items.filter((i) => String(i.surat_jalan_id) === String(id));
  for (const item of ownItems) {
    await SuratJalanItemsRepo.deleteById(item.id);
  }

  await SuratJalanRepo.deleteById(id);
}

function validateItemInput({ nama_item, qty }) {
  const name = String(nama_item || '').trim();
  if (!name) throw new ApiError(400, 'Nama item wajib diisi');
  const qtyNum = Number(qty);
  if (!(qtyNum > 0)) throw new ApiError(400, 'Qty item harus lebih dari 0');
  return { nama_item: name, qty: qtyNum };
}

export async function addSuratJalanItem(suratJalanId, input) {
  await getHeaderOrThrow(suratJalanId);
  const normalized = validateItemInput(input);
  const item = await SuratJalanItemsRepo.insert({ surat_jalan_id: suratJalanId, ...normalized });
  return enrichItem(item);
}

export async function updateSuratJalanItem(suratJalanId, itemId, input) {
  const existing = await SuratJalanItemsRepo.getById(itemId);
  if (!existing || String(existing.surat_jalan_id) !== String(suratJalanId)) {
    throw new ApiError(404, 'Item tidak ditemukan');
  }
  const normalized = validateItemInput({
    nama_item: input.nama_item ?? existing.nama_item,
    qty: input.qty ?? existing.qty,
  });
  const updated = await SuratJalanItemsRepo.updateById(itemId, normalized);
  return enrichItem(updated);
}

export async function deleteSuratJalanItem(suratJalanId, itemId) {
  const existing = await SuratJalanItemsRepo.getById(itemId);
  if (!existing || String(existing.surat_jalan_id) !== String(suratJalanId)) {
    throw new ApiError(404, 'Item tidak ditemukan');
  }
  await SuratJalanItemsRepo.deleteById(itemId);
}
