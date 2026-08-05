import {
  OrdersRepo,
  OrderItemsRepo,
  OrderItemSizesRepo,
  OrderDPRepo,
  TasksRepo,
  CustomersRepo,
  EmployeesRepo,
} from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';
import { normalizePhone } from '../utils/phoneUtils.js';
import { createTrackingToken } from '../utils/trackingTokenUtils.js';
import { env } from '../config/env.js';
import { enrichTask } from './taskService.js';
import * as orderTimelineService from './orderTimelineService.js';

const STATUS_BELUM_PROSES = 'Belum Di Proses';
const STATUS_DESAIN_FIX = 'Desain Fix';
const STATUS_ON_PROGRESS = 'On Progress';
const STATUS_DONE = 'Done';
const STATUS_DIKIRIM = 'Dikirim';
const STATUS_DIAMBIL = 'Di Ambil Costumer';

// The only manual (admin- or customer-triggered) transitions allowed via
// updateOrder/approveDesign. Desain Fix -> On Progress -> Done are never in
// this map — those stay purely automatic, driven by recalculateOrderStatus.
const MANUAL_TRANSITIONS = {
  [STATUS_BELUM_PROSES]: [STATUS_DESAIN_FIX],
  [STATUS_DONE]: [STATUS_DIKIRIM],
  [STATUS_DIKIRIM]: [STATUS_DIAMBIL],
};

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

function enrichSize(size) {
  const harga = Number(size.harga);
  const qty = Number(size.qty);
  return { ...clean(size), harga, qty, total: harga * qty };
}

// An order item's harga/qty/total are never stored — different sizes can
// carry different prices, so both are always derived fresh from its
// OrderItemSizes children (same "compute, don't store" pattern as
// items_total/terakhir_order elsewhere in this service).
function enrichItem(item, sizes) {
  const itemSizes = sizes
    .filter((s) => String(s.order_item_id) === String(item.id))
    .map(enrichSize)
    .sort((a, b) => Number(a.id) - Number(b.id));
  return {
    id: item.id,
    order_id: item.order_id,
    nama_item: item.nama_item,
    warna: item.warna || '',
    sizes: itemSizes,
    qty: itemSizes.reduce((sum, s) => sum + s.qty, 0),
    total: itemSizes.reduce((sum, s) => sum + s.total, 0),
  };
}

// Order progress is "how many of its tasks are completed" — a coarser signal
// than task progress (which is qty-based), by design: an order is a bundle
// of tasks (each its own article/qty), not a single quantity. items_total is
// the separate "Rincian Order" breakdown (nama item/size/harga/qty),
// unrelated to task progress — a record-keeping line-item total, not
// production tracking.
//
// total_dp/sisa_pembayaran are derived the same "compute, don't store" way —
// summed fresh from OrderDP each time rather than cached on the Orders row,
// so they can never drift out of sync with the actual DP entries.
function enrichOrder(order, { tasks, customers, items, sizes, dp }) {
  const customer = customers.find((c) => String(c.id) === String(order.customer_id));
  const orderTasks = tasks.filter((t) => String(t.order_id) === String(order.id));
  const completedTaskCount = orderTasks.filter((t) => t.status === 'completed').length;
  const orderItems = items ? items.filter((i) => String(i.order_id) === String(order.id)) : [];
  const orderItemIds = new Set(orderItems.map((i) => String(i.id)));
  const orderSizes = sizes ? sizes.filter((s) => orderItemIds.has(String(s.order_item_id))) : [];
  const orderDP = dp ? dp.filter((d) => String(d.order_id) === String(order.id)) : [];

  const itemsTotal = orderSizes.reduce((sum, s) => sum + Number(s.harga) * Number(s.qty), 0);
  const totalDP = orderDP.reduce((sum, d) => sum + Number(d.total_dp), 0);

  return {
    ...clean(order),
    customer_name: customer?.name || null,
    task_count: orderTasks.length,
    completed_task_count: completedTaskCount,
    progress: orderTasks.length > 0 ? completedTaskCount / orderTasks.length : 0,
    item_count: orderItems.length,
    items_total: itemsTotal,
    total_dp: totalDP,
    sisa_pembayaran: itemsTotal - totalDP,
  };
}

function enrichDP(dp) {
  return { ...clean(dp), total_dp: Number(dp.total_dp) };
}

function todayYYYYMMDD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// Numbers like INV-20260713-001 — date is the day the invoice number was
// generated, sequence resets per day, computed by scanning every existing
// order's invoice_no for that day's prefix and taking max + 1.
async function generateInvoiceNo() {
  const datePart = todayYYYYMMDD();
  const prefix = `INV-${datePart}-`;
  const allOrders = await OrdersRepo.getAll();
  let max = 0;
  for (const o of allOrders) {
    if (o.invoice_no && o.invoice_no.startsWith(prefix)) {
      const seq = Number(o.invoice_no.slice(prefix.length));
      if (Number.isFinite(seq)) max = Math.max(max, seq);
    }
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export async function createOrder({
  customer_id,
  order_name,
  notes,
  deadline,
  jenis_category,
  order_from,
  broker,
  desain_fix_url,
}) {
  const customer = await CustomersRepo.getById(customer_id);
  if (!customer) throw new ApiError(400, 'Customer tidak valid');

  const invoiceNo = await generateInvoiceNo();
  const order = await OrdersRepo.insert({
    customer_id,
    order_name,
    status: STATUS_BELUM_PROSES,
    created_at: new Date().toISOString(),
    notes: notes || '',
    deadline: deadline || '',
    invoice_no: invoiceNo,
    jenis_category: jenis_category || '',
    order_from: order_from || '',
    broker: broker || '',
    desain_fix_url: desain_fix_url || '',
  });

  await orderTimelineService.appendTimelineEntry(order.id, {
    stage: STATUS_BELUM_PROSES,
    note: 'Pesanan diterima, menunggu approval desain.',
    actor: 'system',
  });

  return enrichOrder(order, { tasks: [], customers: [customer], items: [], sizes: [], dp: [] });
}

export async function listOrders(filters = {}) {
  const [orders, tasks, customers, items, sizes, dp] = await Promise.all([
    OrdersRepo.getAll(),
    TasksRepo.getAll(),
    CustomersRepo.getAll(),
    OrderItemsRepo.getAll(),
    OrderItemSizesRepo.getAll(),
    OrderDPRepo.getAll(),
  ]);

  let filtered = orders;
  if (filters.customer_id) {
    filtered = filtered.filter((o) => String(o.customer_id) === String(filters.customer_id));
  }
  if (filters.status) {
    filtered = filtered.filter((o) => o.status === filters.status);
  }

  filtered = [...filtered].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return filtered.map((order) => enrichOrder(order, { tasks, customers, items, sizes, dp }));
}

async function getHeaderOrThrow(orderId) {
  const order = await OrdersRepo.getById(orderId);
  if (!order) throw new ApiError(404, 'Order tidak ditemukan');
  return order;
}

export async function getOrderDetail(orderId) {
  const order = await getHeaderOrThrow(orderId);

  const [customers, tasks, employees, items, sizes, dp] = await Promise.all([
    CustomersRepo.getAll(),
    TasksRepo.getAll(),
    EmployeesRepo.getAll(),
    OrderItemsRepo.getAll(),
    OrderItemSizesRepo.getAll(),
    OrderDPRepo.getAll(),
  ]);

  const enriched = enrichOrder(order, { tasks, customers, items, sizes, dp });
  const orderTasks = tasks
    .filter((t) => String(t.order_id) === String(orderId))
    .map((t) => enrichTask(t, employees))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const orderItems = items
    .filter((i) => String(i.order_id) === String(orderId))
    .map((i) => enrichItem(i, sizes))
    .sort((a, b) => Number(a.id) - Number(b.id));
  const orderDP = dp
    .filter((d) => String(d.order_id) === String(orderId))
    .map(enrichDP)
    .sort((a, b) => (a.dp_at < b.dp_at ? 1 : -1));

  return { ...enriched, tasks: orderTasks, items: orderItems, dp: orderDP };
}

// Shared by the admin manual-change path (updateOrder) and the public
// customer design-approval path (approveDesign) — both funnel through the
// same MANUAL_TRANSITIONS guard and both write a timeline entry, just with
// a different actor. Never used for the automatic Desain Fix -> On Progress
// -> Done cascade (see recalculateOrderStatus), which writes status/timeline
// directly since it isn't a "manual" transition.
async function transitionOrderStatus(order, nextStatus, { note, actor, resi, shipping_method } = {}) {
  const allowed = MANUAL_TRANSITIONS[order.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw new ApiError(400, `Tidak dapat mengubah status dari "${order.status}" ke "${nextStatus}"`);
  }
  if (nextStatus === STATUS_DIKIRIM) {
    if (!resi || !shipping_method) {
      throw new ApiError(400, 'Resi dan metode pengiriman wajib diisi');
    }
    await orderTimelineService.upsertOrderShipping(order.id, { method: shipping_method, resi, note });
  }

  const updated = await OrdersRepo.updateById(order.id, { status: nextStatus });
  await orderTimelineService.appendTimelineEntry(order.id, { stage: nextStatus, note, actor });
  return updated;
}

export async function updateOrder(
  orderId,
  { order_name, notes, deadline, status, jenis_category, order_from, broker, desain_fix_url, note, resi, shipping_method }
) {
  const existing = await getHeaderOrThrow(orderId);
  if (existing.status === STATUS_DIAMBIL && status === undefined) {
    throw new ApiError(400, 'Order sudah diambil customer, tidak dapat diubah');
  }

  if (status !== undefined && status !== existing.status) {
    await transitionOrderStatus(existing, status, { note, actor: 'admin', resi, shipping_method });
  }

  const patch = {};
  if (order_name !== undefined) patch.order_name = order_name;
  if (notes !== undefined) patch.notes = notes;
  if (deadline !== undefined) patch.deadline = deadline;
  if (jenis_category !== undefined) patch.jenis_category = jenis_category;
  if (order_from !== undefined) patch.order_from = order_from;
  if (broker !== undefined) patch.broker = broker;
  if (desain_fix_url !== undefined) patch.desain_fix_url = desain_fix_url;

  const updated = Object.keys(patch).length > 0 ? await OrdersRepo.updateById(orderId, patch) : await getHeaderOrThrow(orderId);

  const [tasks, customers, items, sizes, dp] = await Promise.all([
    TasksRepo.getAll(),
    CustomersRepo.getAll(),
    OrderItemsRepo.getAll(),
    OrderItemSizesRepo.getAll(),
    OrderDPRepo.getAll(),
  ]);
  return enrichOrder(updated, { tasks, customers, items, sizes, dp });
}

// Public customer-facing design approval (Belum Di Proses -> Desain Fix),
// looked up by phone + invoice number rather than an authenticated session —
// see publicOrderTrackingService for the lookup + rate limiting around this.
export async function approveDesign(order, note) {
  return transitionOrderStatus(order, STATUS_DESAIN_FIX, { note, actor: 'customer' });
}

export async function deleteOrder(orderId) {
  await getHeaderOrThrow(orderId);

  const tasks = await TasksRepo.getAll();
  const hasTasks = tasks.some((t) => String(t.order_id) === String(orderId));
  if (hasTasks) throw new ApiError(400, 'Tidak dapat menghapus order yang sudah memiliki task');

  const [items, sizes, dp] = await Promise.all([
    OrderItemsRepo.getAll(),
    OrderItemSizesRepo.getAll(),
    OrderDPRepo.getAll(),
  ]);
  const ownItems = items.filter((i) => String(i.order_id) === String(orderId));
  for (const item of ownItems) {
    const ownSizes = sizes.filter((s) => String(s.order_item_id) === String(item.id));
    for (const size of ownSizes) {
      await OrderItemSizesRepo.deleteById(size.id);
    }
    await OrderItemsRepo.deleteById(item.id);
  }
  const ownDP = dp.filter((d) => String(d.order_id) === String(orderId));
  for (const d of ownDP) {
    await OrderDPRepo.deleteById(d.id);
  }
  await orderTimelineService.deleteOrderTimelineAndShipping(orderId);

  await OrdersRepo.deleteById(orderId);
}

// Called by taskService whenever a task's status changes, to keep the parent
// order's status in sync: Desain Fix (no task started yet) -> On Progress (at
// least one task started) -> Done (every task completed) — same cascade as
// before, just relabeled. Order status only enters this cascade once it's
// already at Desain Fix or later (Belum Di Proses requires customer/admin
// approval first — see approveDesign/updateOrder). "Di Ambil Costumer" and
// "Dikirim" are manual-only states this cascade never sets and never
// overwrites once reached — they're sticky/terminal until an admin
// explicitly changes them via updateOrder's status field.
export async function recalculateOrderStatus(orderId) {
  const order = await OrdersRepo.getById(orderId);
  if (!order) return;
  if (order.status === STATUS_DIAMBIL || order.status === STATUS_DIKIRIM || order.status === STATUS_BELUM_PROSES) {
    return;
  }

  const tasks = await TasksRepo.getAll();
  const orderTasks = tasks.filter((t) => String(t.order_id) === String(orderId));
  if (orderTasks.length === 0) return;

  let nextStatus;
  if (orderTasks.every((t) => t.status === 'completed')) {
    nextStatus = STATUS_DONE;
  } else if (orderTasks.some((t) => t.status === 'in_progress' || t.status === 'completed')) {
    nextStatus = STATUS_ON_PROGRESS;
  } else {
    nextStatus = STATUS_DESAIN_FIX;
  }

  if (nextStatus !== order.status) {
    await OrdersRepo.updateById(orderId, { status: nextStatus });
    await orderTimelineService.appendTimelineEntry(orderId, {
      stage: nextStatus,
      actor: 'system',
      note: nextStatus === STATUS_DONE ? 'Semua task selesai.' : 'Task pertama dimulai.',
    });
  }
}

function validateItemName(nama_item) {
  const name = String(nama_item || '').trim();
  if (!name) throw new ApiError(400, 'Nama item wajib diisi');
  return name;
}

// An item is just a name/color grouping — its qty/harga/total live entirely
// on its OrderItemSizes children (see enrichItem), so creating one only
// needs a name (+ optional warna); sizes are added afterward via
// addOrderItemSize or, in bulk, addOrderItemFromTemplate.
export async function addOrderItem(orderId, input) {
  await getHeaderOrThrow(orderId);
  const nama_item = validateItemName(input.nama_item);
  const item = await OrderItemsRepo.insert({
    order_id: orderId,
    nama_item,
    warna: input.warna || '',
    harga: '',
    qty: '',
    total: '',
  });
  return enrichItem(item, []);
}

async function getOwnItemOrThrow(orderId, itemId) {
  const existing = await OrderItemsRepo.getById(itemId);
  if (!existing || String(existing.order_id) !== String(orderId)) {
    throw new ApiError(404, 'Item tidak ditemukan');
  }
  return existing;
}

export async function updateOrderItem(orderId, itemId, input) {
  await getOwnItemOrThrow(orderId, itemId);
  const nama_item = validateItemName(input.nama_item);
  const updated = await OrderItemsRepo.updateById(itemId, { nama_item, warna: input.warna || '' });
  const sizes = await OrderItemSizesRepo.getAll();
  return enrichItem(updated, sizes);
}

export async function deleteOrderItem(orderId, itemId) {
  await getOwnItemOrThrow(orderId, itemId);
  const sizes = await OrderItemSizesRepo.getAll();
  const ownSizes = sizes.filter((s) => String(s.order_item_id) === String(itemId));
  for (const size of ownSizes) {
    await OrderItemSizesRepo.deleteById(size.id);
  }
  await OrderItemsRepo.deleteById(itemId);
}

function validateSizeInput({ size, harga, qty }) {
  const sizeName = String(size || '').trim();
  if (!sizeName) throw new ApiError(400, 'Size wajib diisi');
  const hargaNum = Number(harga);
  const qtyNum = Number(qty);
  if (!(hargaNum >= 0)) throw new ApiError(400, 'Harga size tidak valid');
  if (!(qtyNum > 0)) throw new ApiError(400, 'Qty size harus lebih dari 0');
  return { size: sizeName, harga: hargaNum, qty: qtyNum };
}

export async function addOrderItemSize(orderId, itemId, input) {
  const item = await getOwnItemOrThrow(orderId, itemId);
  const normalized = validateSizeInput(input);
  await OrderItemSizesRepo.insert({ order_item_id: itemId, ...normalized });
  const sizes = await OrderItemSizesRepo.getAll();
  return enrichItem(item, sizes);
}

async function getOwnSizeOrThrow(itemId, sizeId) {
  const existing = await OrderItemSizesRepo.getById(sizeId);
  if (!existing || String(existing.order_item_id) !== String(itemId)) {
    throw new ApiError(404, 'Size tidak ditemukan');
  }
  return existing;
}

export async function updateOrderItemSize(orderId, itemId, sizeId, input) {
  const item = await getOwnItemOrThrow(orderId, itemId);
  const existing = await getOwnSizeOrThrow(itemId, sizeId);
  const normalized = validateSizeInput({
    size: input.size ?? existing.size,
    harga: input.harga ?? existing.harga,
    qty: input.qty ?? existing.qty,
  });
  await OrderItemSizesRepo.updateById(sizeId, normalized);
  const sizes = await OrderItemSizesRepo.getAll();
  return enrichItem(item, sizes);
}

export async function deleteOrderItemSize(orderId, itemId, sizeId) {
  await getOwnItemOrThrow(orderId, itemId);
  await getOwnSizeOrThrow(itemId, sizeId);
  await OrderItemSizesRepo.deleteById(sizeId);
}

function validateDPInput({ dp_at, total_dp }) {
  const dpAt = String(dp_at || '').trim();
  if (!dpAt) throw new ApiError(400, 'Tanggal DP wajib diisi');
  const totalDPNum = Number(total_dp);
  if (!(totalDPNum > 0)) throw new ApiError(400, 'Nominal DP harus lebih dari 0');
  return { dp_at: dpAt, total_dp: totalDPNum };
}

// Cumulative DP can never exceed the order's own item total — otherwise
// "sisa pembayaran" (items_total - total_dp) would go negative, which makes
// no sense on an invoice. Checked against the freshest items/sizes/DP state
// every time, same "re-derive right before writing" pattern used elsewhere
// for money-sensitive checks.
async function assertDPWithinItemsTotal(orderId, additionalAmount, excludingDpId) {
  const [items, sizes, dp] = await Promise.all([
    OrderItemsRepo.getAll(),
    OrderItemSizesRepo.getAll(),
    OrderDPRepo.getAll(),
  ]);
  const orderItems = items.filter((i) => String(i.order_id) === String(orderId));
  const orderItemIds = new Set(orderItems.map((i) => String(i.id)));
  const orderSizes = sizes.filter((s) => orderItemIds.has(String(s.order_item_id)));
  const itemsTotal = orderSizes.reduce((sum, s) => sum + Number(s.harga) * Number(s.qty), 0);

  const existingDPTotal = dp
    .filter((d) => String(d.order_id) === String(orderId) && String(d.id) !== String(excludingDpId))
    .reduce((sum, d) => sum + Number(d.total_dp), 0);

  if (existingDPTotal + additionalAmount > itemsTotal) {
    const remaining = Math.max(0, itemsTotal - existingDPTotal);
    throw new ApiError(400, `Total DP tidak boleh melebihi total rincian order (sisa maksimal ${remaining})`);
  }
}

export async function addOrderDP(orderId, input) {
  await getHeaderOrThrow(orderId);
  const normalized = validateDPInput(input);
  await assertDPWithinItemsTotal(orderId, normalized.total_dp, null);
  const dp = await OrderDPRepo.insert({ order_id: orderId, ...normalized });
  return enrichDP(dp);
}

async function getOwnDPOrThrow(orderId, dpId) {
  const existing = await OrderDPRepo.getById(dpId);
  if (!existing || String(existing.order_id) !== String(orderId)) {
    throw new ApiError(404, 'DP tidak ditemukan');
  }
  return existing;
}

export async function updateOrderDP(orderId, dpId, input) {
  const existing = await getOwnDPOrThrow(orderId, dpId);
  const normalized = validateDPInput({
    dp_at: input.dp_at ?? existing.dp_at,
    total_dp: input.total_dp ?? existing.total_dp,
  });
  await assertDPWithinItemsTotal(orderId, normalized.total_dp, dpId);
  const updated = await OrderDPRepo.updateById(dpId, normalized);
  return enrichDP(updated);
}

export async function deleteOrderDP(orderId, dpId) {
  await getOwnDPOrThrow(orderId, dpId);
  await OrderDPRepo.deleteById(dpId);
}

// The "Tambah Item" quick-entry template: one submit creates the item plus
// every size row the admin filled a qty for. Harga is optional per size here
// (defaults to 0 if left blank) — price can still be adjusted afterward
// through the existing add/edit-size flow.
export async function addOrderItemFromTemplate(orderId, { nama_item, warna, sizes }) {
  await getHeaderOrThrow(orderId);
  const name = validateItemName(nama_item);
  const normalizedSizes = (sizes || [])
    .map((s) => ({ size: String(s.size || '').trim(), harga: Number(s.harga || 0), qty: Number(s.qty) }))
    .filter((s) => s.size && s.qty > 0);
  if (normalizedSizes.length === 0) throw new ApiError(400, 'Minimal isi satu size');

  const item = await OrderItemsRepo.insert({
    order_id: orderId,
    nama_item: name,
    warna: warna || '',
    harga: '',
    qty: '',
    total: '',
  });
  for (const s of normalizedSizes) {
    await OrderItemSizesRepo.insert({ order_item_id: item.id, size: s.size, harga: s.harga, qty: s.qty });
  }
  const allSizes = await OrderItemSizesRepo.getAll();
  return enrichItem(item, allSizes);
}

// Defensive fallback only — every order created after this feature shipped
// already has an invoice_no from createOrder. This covers any pre-existing
// order created before that change. Once assigned it's persisted and never
// regenerated.
async function ensureInvoiceNo(order) {
  if (order.invoice_no) return order.invoice_no;
  const invoiceNo = await generateInvoiceNo();
  await OrdersRepo.updateById(order.id, { invoice_no: invoiceNo });
  return invoiceNo;
}

// Powers the invoice print/export — fetches the same enriched detail as
// getOrderDetail (which now includes the DP list and DP-adjusted
// sisa_pembayaran), plus a persisted/idempotent invoice_no assigned on first
// print. Customer contact details and discount are still out of scope (see
// orderExportService.js).
export async function getOrderInvoice(orderId) {
  const order = await getHeaderOrThrow(orderId);
  const invoiceNo = await ensureInvoiceNo(order);
  const detail = await getOrderDetail(orderId);
  return { ...detail, invoice_no: invoiceNo };
}

// Builds the customer-facing tracking link (see utils/trackingTokenUtils.js)
// for the admin's "Lacak Order" action. Requires the customer to have a
// phone number on file — without one there's nothing for the token to bind
// to, and the public tracking API could never match this order anyway.
export async function getTrackingLink(orderId) {
  const order = await getHeaderOrThrow(orderId);
  const invoiceNo = await ensureInvoiceNo(order);
  const customer = await CustomersRepo.getById(order.customer_id);
  if (!customer?.no_hp) {
    throw new ApiError(400, 'Customer belum memiliki nomor WhatsApp, tidak dapat membuat link lacak order');
  }
  const token = createTrackingToken(invoiceNo, customer.no_hp);
  return { url: `${env.publicTrackingBaseUrl}/lacak-order/status?t=${token}` };
}
