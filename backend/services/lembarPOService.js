import { LembarPORepo, OrdersRepo, CustomersRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';
import * as orderService from './orderService.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

function enrichLembarPO(row, { orders, customers }) {
  const order = orders.find((o) => String(o.id) === String(row.order_id));
  const customer = order ? customers.find((c) => String(c.id) === String(order.customer_id)) : null;
  return {
    ...clean(row),
    label: row.label === 'true',
    hangtag: row.hangtag === 'true',
    order_name: order?.order_name || null,
    customer_name: customer?.name || null,
  };
}

async function assertOrderExists(orderId) {
  const order = await OrdersRepo.getById(orderId);
  if (!order) throw new ApiError(400, 'Order tidak valid');
  return order;
}

export async function listLembarPO() {
  const [rows, orders, customers] = await Promise.all([
    LembarPORepo.getAll(),
    OrdersRepo.getAll(),
    CustomersRepo.getAll(),
  ]);
  return [...rows]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map((row) => enrichLembarPO(row, { orders, customers }));
}

async function getRowOrThrow(id) {
  const row = await LembarPORepo.getById(id);
  if (!row) throw new ApiError(404, 'Lembar PO tidak ditemukan');
  return row;
}

// At most one LembarPO per order (enforced in createLembarPO/updateLembarPO,
// not at the sheet level) — used by the employee-facing "Lihat Lembar PO"
// button, which only knows the order_id from the task it selected, not a
// LembarPO id.
async function getRowByOrderIdOrThrow(orderId) {
  const rows = await LembarPORepo.getAll();
  const row = rows.find((r) => String(r.order_id) === String(orderId));
  if (!row) throw new ApiError(404, 'Lembar PO untuk order ini belum dibuat');
  return row;
}

export async function getLembarPODetail(id) {
  const row = await getRowOrThrow(id);
  const [orders, customers] = await Promise.all([OrdersRepo.getAll(), CustomersRepo.getAll()]);
  return enrichLembarPO(row, { orders, customers });
}

export async function createLembarPO({
  order_id,
  sablon_bordir,
  catatan,
  label,
  bahan_tipe,
  pola_potong,
  hangtag,
}) {
  await assertOrderExists(order_id);

  const existing = await LembarPORepo.getAll();
  if (existing.some((r) => String(r.order_id) === String(order_id))) {
    throw new ApiError(400, 'Order ini sudah memiliki Lembar PO');
  }

  const row = await LembarPORepo.insert({
    order_id,
    sablon_bordir: sablon_bordir || '',
    catatan: catatan || '',
    label: String(!!label),
    bahan_tipe: bahan_tipe || '',
    pola_potong: pola_potong || '',
    hangtag: String(!!hangtag),
    created_at: new Date().toISOString(),
  });

  const [orders, customers] = await Promise.all([OrdersRepo.getAll(), CustomersRepo.getAll()]);
  return enrichLembarPO(row, { orders, customers });
}

export async function updateLembarPO(
  id,
  { order_id, sablon_bordir, catatan, label, bahan_tipe, pola_potong, hangtag }
) {
  await getRowOrThrow(id);

  const patch = {};
  if (order_id !== undefined) {
    await assertOrderExists(order_id);
    const existing = await LembarPORepo.getAll();
    if (existing.some((r) => String(r.id) !== String(id) && String(r.order_id) === String(order_id))) {
      throw new ApiError(400, 'Order ini sudah memiliki Lembar PO');
    }
    patch.order_id = order_id;
  }
  if (sablon_bordir !== undefined) patch.sablon_bordir = sablon_bordir;
  if (catatan !== undefined) patch.catatan = catatan;
  if (label !== undefined) patch.label = String(!!label);
  if (bahan_tipe !== undefined) patch.bahan_tipe = bahan_tipe;
  if (pola_potong !== undefined) patch.pola_potong = pola_potong;
  if (hangtag !== undefined) patch.hangtag = String(!!hangtag);

  const updated = await LembarPORepo.updateById(id, patch);
  const [orders, customers] = await Promise.all([OrdersRepo.getAll(), CustomersRepo.getAll()]);
  return enrichLembarPO(updated, { orders, customers });
}

export async function deleteLembarPO(id) {
  await getRowOrThrow(id);
  await LembarPORepo.deleteById(id);
}

// Assembles everything the PDF template (and the employee-facing preview
// modal) needs: the Lembar PO fields, the order's header info (reusing the
// same idempotent invoice_no as the Order Invoice print, since both
// documents reference the same order) with its items/sizes for the
// "Ukuran per Tipe" breakdown.
async function assembleForPrint(lembarPO) {
  const orderInvoice = await orderService.getOrderInvoice(lembarPO.order_id);
  return { ...lembarPO, order: orderInvoice };
}

export async function getLembarPOForPrint(id) {
  const lembarPO = await getLembarPODetail(id);
  return assembleForPrint(lembarPO);
}

// Same assembled shape as getLembarPOForPrint, looked up by order_id instead
// of the LembarPO's own id — the employee task-input flow only knows the
// order_id (from the selected task), not a LembarPO id.
export async function getLembarPOForOrder(orderId) {
  const row = await getRowByOrderIdOrThrow(orderId);
  const [orders, customers] = await Promise.all([OrdersRepo.getAll(), CustomersRepo.getAll()]);
  const lembarPO = enrichLembarPO(row, { orders, customers });
  return assembleForPrint(lembarPO);
}
