import { OrdersRepo, OrderItemsRepo, TasksRepo, CustomersRepo, EmployeesRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';
import { enrichTask } from './taskService.js';

const STATUS_DESAIN_FIX = 'Desain Fix';
const STATUS_ON_PROGRESS = 'On Progress';
const STATUS_DONE = 'Done';
const STATUS_DIAMBIL = 'Di Ambil Costumer';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

function enrichItem(item) {
  return {
    ...clean(item),
    harga: Number(item.harga),
    qty: Number(item.qty),
    total: Number(item.total),
  };
}

// Order progress is "how many of its tasks are completed" — a coarser signal
// than task progress (which is qty-based), by design: an order is a bundle
// of tasks (each its own article/qty), not a single quantity. items_total is
// the separate "Rincian Order" breakdown (nama item/harga/qty), unrelated to
// task progress — a record-keeping line-item total, not production tracking.
function enrichOrder(order, { tasks, customers, items }) {
  const customer = customers.find((c) => String(c.id) === String(order.customer_id));
  const orderTasks = tasks.filter((t) => String(t.order_id) === String(order.id));
  const completedTaskCount = orderTasks.filter((t) => t.status === 'completed').length;
  const orderItems = items ? items.filter((i) => String(i.order_id) === String(order.id)) : [];

  return {
    ...clean(order),
    customer_name: customer?.name || null,
    task_count: orderTasks.length,
    completed_task_count: completedTaskCount,
    progress: orderTasks.length > 0 ? completedTaskCount / orderTasks.length : 0,
    item_count: orderItems.length,
    items_total: orderItems.reduce((sum, i) => sum + Number(i.total), 0),
  };
}

export async function createOrder({ customer_id, order_name, notes, deadline }) {
  const customer = await CustomersRepo.getById(customer_id);
  if (!customer) throw new ApiError(400, 'Customer tidak valid');

  const order = await OrdersRepo.insert({
    customer_id,
    order_name,
    status: STATUS_DESAIN_FIX,
    created_at: new Date().toISOString(),
    notes: notes || '',
    deadline: deadline || '',
  });

  return enrichOrder(order, { tasks: [], customers: [customer], items: [] });
}

export async function listOrders(filters = {}) {
  const [orders, tasks, customers, items] = await Promise.all([
    OrdersRepo.getAll(),
    TasksRepo.getAll(),
    CustomersRepo.getAll(),
    OrderItemsRepo.getAll(),
  ]);

  let filtered = orders;
  if (filters.customer_id) {
    filtered = filtered.filter((o) => String(o.customer_id) === String(filters.customer_id));
  }
  if (filters.status) {
    filtered = filtered.filter((o) => o.status === filters.status);
  }

  filtered = [...filtered].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return filtered.map((order) => enrichOrder(order, { tasks, customers, items }));
}

async function getHeaderOrThrow(orderId) {
  const order = await OrdersRepo.getById(orderId);
  if (!order) throw new ApiError(404, 'Order tidak ditemukan');
  return order;
}

export async function getOrderDetail(orderId) {
  const order = await getHeaderOrThrow(orderId);

  const [customers, tasks, employees, items] = await Promise.all([
    CustomersRepo.getAll(),
    TasksRepo.getAll(),
    EmployeesRepo.getAll(),
    OrderItemsRepo.getAll(),
  ]);

  const enriched = enrichOrder(order, { tasks, customers, items });
  const orderTasks = tasks
    .filter((t) => String(t.order_id) === String(orderId))
    .map((t) => enrichTask(t, employees))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const orderItems = items
    .filter((i) => String(i.order_id) === String(orderId))
    .map(enrichItem)
    .sort((a, b) => Number(a.id) - Number(b.id));

  return { ...enriched, tasks: orderTasks, items: orderItems };
}

export async function updateOrder(orderId, { order_name, notes, deadline, status }) {
  const existing = await getHeaderOrThrow(orderId);
  if (existing.status === STATUS_DIAMBIL && status === undefined) {
    throw new ApiError(400, 'Order sudah diambil customer, tidak dapat diubah');
  }

  const patch = {};
  if (order_name !== undefined) patch.order_name = order_name;
  if (notes !== undefined) patch.notes = notes;
  if (deadline !== undefined) patch.deadline = deadline;
  if (status !== undefined) patch.status = status;

  const updated = await OrdersRepo.updateById(orderId, patch);

  const [tasks, customers, items] = await Promise.all([
    TasksRepo.getAll(),
    CustomersRepo.getAll(),
    OrderItemsRepo.getAll(),
  ]);
  return enrichOrder(updated, { tasks, customers, items });
}

export async function deleteOrder(orderId) {
  await getHeaderOrThrow(orderId);

  const tasks = await TasksRepo.getAll();
  const hasTasks = tasks.some((t) => String(t.order_id) === String(orderId));
  if (hasTasks) throw new ApiError(400, 'Tidak dapat menghapus order yang sudah memiliki task');

  const items = await OrderItemsRepo.getAll();
  const ownItems = items.filter((i) => String(i.order_id) === String(orderId));
  for (const item of ownItems) {
    await OrderItemsRepo.deleteById(item.id);
  }

  await OrdersRepo.deleteById(orderId);
}

// Called by taskService whenever a task's status changes, to keep the parent
// order's status in sync: Desain Fix (no task started yet) -> On Progress (at
// least one task started) -> Done (every task completed) — same cascade as
// before, just relabeled. "Di Ambil Costumer" is a manual-only state (the
// customer physically picked up the order) that this cascade never sets and
// never overwrites once reached — it's sticky/terminal until an admin
// explicitly changes it via updateOrder's status field.
export async function recalculateOrderStatus(orderId) {
  const order = await OrdersRepo.getById(orderId);
  if (!order) return;
  if (order.status === STATUS_DIAMBIL) return;

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
  }
}

function validateItemInput({ nama_item, harga, qty }) {
  const name = String(nama_item || '').trim();
  if (!name) throw new ApiError(400, 'Nama item wajib diisi');
  const hargaNum = Number(harga);
  const qtyNum = Number(qty);
  if (!(hargaNum >= 0)) throw new ApiError(400, 'Harga item tidak valid');
  if (!(qtyNum > 0)) throw new ApiError(400, 'Qty item harus lebih dari 0');
  return { nama_item: name, harga: hargaNum, qty: qtyNum, total: hargaNum * qtyNum };
}

export async function addOrderItem(orderId, input) {
  await getHeaderOrThrow(orderId);
  const normalized = validateItemInput(input);
  const item = await OrderItemsRepo.insert({ order_id: orderId, ...normalized });
  return enrichItem(item);
}

export async function updateOrderItem(orderId, itemId, input) {
  const existing = await OrderItemsRepo.getById(itemId);
  if (!existing || String(existing.order_id) !== String(orderId)) {
    throw new ApiError(404, 'Item tidak ditemukan');
  }
  const normalized = validateItemInput({
    nama_item: input.nama_item ?? existing.nama_item,
    harga: input.harga ?? existing.harga,
    qty: input.qty ?? existing.qty,
  });
  const updated = await OrderItemsRepo.updateById(itemId, normalized);
  return enrichItem(updated);
}

export async function deleteOrderItem(orderId, itemId) {
  const existing = await OrderItemsRepo.getById(itemId);
  if (!existing || String(existing.order_id) !== String(orderId)) {
    throw new ApiError(404, 'Item tidak ditemukan');
  }
  await OrderItemsRepo.deleteById(itemId);
}

function todayYYYYMMDD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// Numbers like INV-20260713-001 — date is the day the invoice was FIRST
// printed (not the order's creation date), sequence resets per day. Once
// assigned it's persisted on the order and never regenerated, so printing
// the same order's invoice twice always shows the same number.
async function ensureInvoiceNo(order) {
  if (order.invoice_no) return order.invoice_no;

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
  const invoiceNo = `${prefix}${String(max + 1).padStart(3, '0')}`;
  await OrdersRepo.updateById(order.id, { invoice_no: invoiceNo });
  return invoiceNo;
}

// Powers the invoice print/export — fetches the same enriched detail as
// getOrderDetail, plus a persisted/idempotent invoice_no assigned on first
// print. Customer contact details, discount, and down-payment are
// deliberately left out of scope for now (see orderExportService.js).
export async function getOrderInvoice(orderId) {
  const order = await getHeaderOrThrow(orderId);
  const invoiceNo = await ensureInvoiceNo(order);
  const detail = await getOrderDetail(orderId);
  return { ...detail, invoice_no: invoiceNo };
}
