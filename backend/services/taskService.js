import { TasksRepo, OrdersRepo, EmployeesRepo, CustomersRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';
import { recalculateOrderStatus } from './orderService.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

// Sync enrichment over a pre-fetched employees array — shared with
// orderService.getOrderDetail so it can enrich a whole order's tasks without
// re-fetching per task.
export function enrichTask(task, employees) {
  const employee = task.assigned_to ? employees.find((e) => String(e.id) === String(task.assigned_to)) : null;
  const targetQty = Number(task.target_qty);
  const completedQty = Number(task.completed_qty || 0);

  return {
    ...clean(task),
    target_qty: targetQty,
    completed_qty: completedQty,
    remaining_qty: Math.max(0, targetQty - completedQty),
    progress: targetQty > 0 ? completedQty / targetQty : 0,
    assigned_to_name: employee?.name || null,
  };
}

// Adds order/customer context on top of enrichTask — the employee
// task-picker needs customer_name/order_name to show what a task is
// actually for without a second round-trip to /orders, and customer_id so
// the work log form can scope its Article select to the right customer.
// Articles are no longer tied to the task itself — they're chosen per work
// log entry (see workLogService), since a task now just tracks divisi/qty
// progress.
function enrichTaskWithOrder(task, { orders, customers, employees }) {
  const order = orders.find((o) => String(o.id) === String(task.order_id));
  const customer = order ? customers.find((c) => String(c.id) === String(order.customer_id)) : null;

  return {
    ...enrichTask(task, employees),
    order_name: order?.order_name || null,
    customer_id: order?.customer_id || null,
    customer_name: customer?.name || null,
  };
}

async function fetchEnrichmentContext() {
  const [orders, customers, employees] = await Promise.all([
    OrdersRepo.getAll(),
    CustomersRepo.getAll(),
    EmployeesRepo.getAll(),
  ]);
  return { orders, customers, employees };
}

export async function createTask({ order_id, divisi, description, target_qty }) {
  const order = await OrdersRepo.getById(order_id);
  if (!order) throw new ApiError(400, 'Order tidak valid');
  if (order.status === 'completed') {
    throw new ApiError(400, 'Tidak dapat menambah task pada order yang sudah selesai');
  }

  const task = await TasksRepo.insert({
    order_id,
    divisi,
    description: description || '',
    target_qty: Number(target_qty),
    completed_qty: 0,
    assigned_to: '',
    status: 'open',
    created_at: new Date().toISOString(),
  });

  await recalculateOrderStatus(order_id);

  const ctx = await fetchEnrichmentContext();
  return enrichTaskWithOrder(task, ctx);
}

export async function listTasks(filters = {}) {
  const [tasks, ctx] = await Promise.all([TasksRepo.getAll(), fetchEnrichmentContext()]);

  let filtered = tasks;
  if (filters.order_id) filtered = filtered.filter((t) => String(t.order_id) === String(filters.order_id));
  if (filters.divisi) filtered = filtered.filter((t) => t.divisi === filters.divisi);
  if (filters.status) filtered = filtered.filter((t) => t.status === filters.status);
  if (filters.assigned_to) filtered = filtered.filter((t) => String(t.assigned_to) === String(filters.assigned_to));

  filtered = [...filtered].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return filtered.map((t) => enrichTaskWithOrder(t, ctx));
}

// Tasks any employee in a division can currently work on: not completed,
// matching division, and belonging to an order that isn't already completed.
// Assignment is no longer exclusionary — any number of employees may log
// work against the same task.
export async function listAvailableTasks(divisi) {
  const [tasks, ctx] = await Promise.all([TasksRepo.getAll(), fetchEnrichmentContext()]);
  const orderMap = new Map(ctx.orders.map((o) => [String(o.id), o]));

  const available = tasks.filter((t) => {
    if (t.status === 'completed') return false;
    if (divisi && t.divisi !== divisi) return false;
    const order = orderMap.get(String(t.order_id));
    return order && order.status !== 'completed';
  });

  available.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return available.map((t) => enrichTaskWithOrder(t, ctx));
}

export async function getTaskDetail(taskId) {
  const task = await TasksRepo.getById(taskId);
  if (!task) throw new ApiError(404, 'Task tidak ditemukan');

  const ctx = await fetchEnrichmentContext();
  return enrichTaskWithOrder(task, ctx);
}

export async function updateTask(taskId, { divisi, description, target_qty }) {
  const existing = await TasksRepo.getById(taskId);
  if (!existing) throw new ApiError(404, 'Task tidak ditemukan');

  const patch = {};
  if (divisi !== undefined) patch.divisi = divisi;
  if (description !== undefined) patch.description = description;
  if (target_qty !== undefined) {
    const nextTarget = Number(target_qty);
    if (nextTarget < Number(existing.completed_qty || 0)) {
      throw new ApiError(400, 'Target quantity tidak boleh kurang dari quantity yang sudah selesai');
    }
    patch.target_qty = nextTarget;
  }

  await TasksRepo.updateById(taskId, patch);
  await recalculateOrderStatus(existing.order_id);

  const [ctx, fresh] = await Promise.all([fetchEnrichmentContext(), TasksRepo.getById(taskId)]);
  return enrichTaskWithOrder(fresh, ctx);
}

export async function deleteTask(taskId) {
  const existing = await TasksRepo.getById(taskId);
  if (!existing) throw new ApiError(404, 'Task tidak ditemukan');
  if (Number(existing.completed_qty || 0) > 0) {
    throw new ApiError(400, 'Tidak dapat menghapus task yang sudah memiliki progress');
  }
  const orderId = existing.order_id;
  await TasksRepo.deleteById(taskId);
  await recalculateOrderStatus(orderId);
}

// Task status is purely a function of completed_qty vs target_qty — a work
// log's own status field (on_progress/selesai/belum_selesai) is just a label
// on that entry and never drives task/order completion. This is critical:
// a 30/100 work log marked "selesai" must NOT complete a 100-qty task.
function taskStatusFromQty(completedQty, targetQty) {
  if (targetQty > 0 && completedQty >= targetQty) return 'completed';
  if (completedQty > 0) return 'in_progress';
  return 'open';
}

// Called by workLogService when a work log is created against a task.
// assigned_to is informational only: it's set to the first employee to log
// work against the task, but never blocks other employees in the same
// division from also logging work against it.
export async function applyWorkLog(taskId, employeeId, qty) {
  const task = await TasksRepo.getById(taskId);
  if (!task) throw new ApiError(400, 'Task tidak valid');
  if (task.status === 'completed') throw new ApiError(400, 'Task ini sudah selesai');

  const target = Number(task.target_qty);
  const currentCompleted = Number(task.completed_qty || 0);
  const nextCompleted = currentCompleted + Number(qty);

  if (nextCompleted > target) {
    throw new ApiError(400, `Quantity melebihi sisa target task (sisa ${target - currentCompleted})`);
  }

  const patch = {
    completed_qty: nextCompleted,
    status: taskStatusFromQty(nextCompleted, target),
  };
  if (!task.assigned_to) patch.assigned_to = employeeId;

  await TasksRepo.updateById(taskId, patch);
  await recalculateOrderStatus(task.order_id);
}

// Called by workLogService.updateWorkLog when an existing work log's
// quantity changes. qtyDelta is the change in quantity (positive = more
// completed, negative = less).
export async function reapplyWorkLog(taskId, qtyDelta) {
  const task = await TasksRepo.getById(taskId);
  if (!task) throw new ApiError(400, 'Task tidak valid');

  const target = Number(task.target_qty);
  const currentCompleted = Number(task.completed_qty || 0);
  const nextCompleted = Math.max(0, currentCompleted + Number(qtyDelta));

  if (qtyDelta > 0 && nextCompleted > target) {
    throw new ApiError(400, `Quantity melebihi sisa target task (sisa ${target - currentCompleted})`);
  }

  await TasksRepo.updateById(taskId, {
    completed_qty: nextCompleted,
    status: taskStatusFromQty(nextCompleted, target),
  });
  await recalculateOrderStatus(task.order_id);
}

// Called by workLogService.deleteWorkLog.
export async function removeWorkLog(taskId, qty) {
  const task = await TasksRepo.getById(taskId);
  if (!task) return; // task may have been deleted independently; nothing to reverse

  const target = Number(task.target_qty);
  const currentCompleted = Number(task.completed_qty || 0);
  const nextCompleted = Math.max(0, currentCompleted - Number(qty));

  await TasksRepo.updateById(taskId, {
    completed_qty: nextCompleted,
    status: taskStatusFromQty(nextCompleted, target),
  });
  await recalculateOrderStatus(task.order_id);
}
