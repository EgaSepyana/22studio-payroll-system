import {
  TasksRepo,
  OrdersRepo,
  EmployeesRepo,
  CustomersRepo,
  FINISHING_DIVISION,
  DIVISI_SUBSTAGE_LABELS,
} from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';
import { recalculateOrderStatus } from './orderService.js';
import { appendTimelineEntry } from './orderTimelineService.js';

// Emits the "Proses <Divisi Label> Selesai" timeline entry the first time a
// task flips into 'completed' — called after the atomic qty update commits,
// never inside it (timeline writes hit a different sheet/lock and don't need
// to be atomic with the task's own row write).
async function noteSubStageCompletion(orderId, divisi) {
  const label = DIVISI_SUBSTAGE_LABELS[divisi] || divisi;
  await appendTimelineEntry(orderId, {
    stage: 'On Progress',
    sub_stage: label,
    note: `Proses ${label} Selesai`,
    actor: 'system',
  });
}

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
    deadline: order?.deadline || null,
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
// work against the same task. Sorted by the parent order's deadline
// (soonest first) so the picker surfaces the most urgent work; tasks
// without a deadline sort last.
export async function listAvailableTasks(divisi) {
  const [tasks, ctx] = await Promise.all([TasksRepo.getAll(), fetchEnrichmentContext()]);
  const orderMap = new Map(ctx.orders.map((o) => [String(o.id), o]));

  const available = tasks
    .filter((t) => {
      if (t.status === 'completed') return false;
      if (divisi && t.divisi !== divisi) return false;
      const order = orderMap.get(String(t.order_id));
      return order && order.status !== 'completed';
    })
    .map((t) => enrichTaskWithOrder(t, ctx));

  available.sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0;
  });

  return available;
}

export async function getTaskDetail(taskId) {
  const task = await TasksRepo.getById(taskId);
  if (!task) throw new ApiError(404, 'Task tidak ditemukan');

  const ctx = await fetchEnrichmentContext();
  return enrichTaskWithOrder(task, ctx);
}

export async function updateTask(taskId, { divisi, description, target_qty }) {
  let orderId;
  let becameCompleted = false;
  let taskDivisi;
  const updated = await TasksRepo.updateById(taskId, (task) => {
    orderId = task.order_id;
    taskDivisi = divisi !== undefined ? divisi : task.divisi;
    const patch = {};
    if (divisi !== undefined) patch.divisi = divisi;
    if (description !== undefined) patch.description = description;
    if (target_qty !== undefined) {
      const nextTarget = Number(target_qty);
      const completedQty = Number(task.completed_qty || 0);
      if (nextTarget < completedQty) {
        throw new ApiError(400, 'Target quantity tidak boleh kurang dari quantity yang sudah selesai');
      }
      patch.target_qty = nextTarget;
      // Editing the target can move a task in or out of "completed" (e.g.
      // raising the target on an already-completed task un-completes it),
      // so status is always re-derived alongside target_qty, not left stale.
      const nextStatus = taskStatusFromQty(completedQty, nextTarget);
      becameCompleted = task.status !== 'completed' && nextStatus === 'completed';
      patch.status = nextStatus;
    }
    return patch;
  });
  if (!updated) throw new ApiError(404, 'Task tidak ditemukan');

  await recalculateOrderStatus(orderId);
  // A target_qty edit can complete a task exactly like a work log can (e.g.
  // lowering the target down to the already-completed quantity) — the order
  // timeline must reflect that transition the same way, or the substage
  // silently never shows as done even though the task itself is complete.
  if (becameCompleted) await noteSubStageCompletion(orderId, taskDivisi);

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
//
// The read (current completed_qty/status) and the write both happen inside
// updateById's function-form patch — i.e. atomically, under that sheet's
// lock — instead of reading the task first and passing a precomputed patch.
// Two work logs landing on the same task around the same time would
// otherwise both compute their new completed_qty from the same stale
// snapshot, and whichever write lands second silently overwrites the first
// (lost update) — which is how a task could reach its target qty across
// several work logs without ever flipping to "completed".
export async function applyWorkLog(taskId, employeeId, qty) {
  let orderId;
  let becameCompleted = false;
  let divisi;
  const updated = await TasksRepo.updateById(taskId, (task) => {
    if (task.status === 'completed') throw new ApiError(400, 'Task ini sudah selesai');

    const target = Number(task.target_qty);
    const currentCompleted = Number(task.completed_qty || 0);
    const nextCompleted = currentCompleted + Number(qty);

    if (nextCompleted > target) {
      throw new ApiError(400, `Quantity melebihi sisa target task (sisa ${target - currentCompleted})`);
    }

    orderId = task.order_id;
    divisi = task.divisi;
    const nextStatus = taskStatusFromQty(nextCompleted, target);
    becameCompleted = nextStatus === 'completed';
    const patch = {
      completed_qty: nextCompleted,
      status: nextStatus,
    };
    if (!task.assigned_to) patch.assigned_to = employeeId;
    return patch;
  });
  if (!updated) throw new ApiError(400, 'Task tidak valid');

  await recalculateOrderStatus(orderId);
  if (becameCompleted) await noteSubStageCompletion(orderId, divisi);
}

// Finishing employees are paid hourly via Attendance, not per piece — so
// unlike every other division, updating a Finishing task's progress must
// NOT create a WorkLog (there's no article/price to attach, and it must
// never feed into payroll, which for Finishing is entirely attendance-hours
// based). This just advances completed_qty/status directly, reusing the
// exact same atomic qty math as applyWorkLog. Restricted to Finishing tasks
// specifically — every other division's progress must keep going through
// workLogService.createWorkLog so its pay is correctly recorded.
export async function addTaskProgress(taskId, employeeId, qty) {
  const employee = await EmployeesRepo.getById(employeeId);
  if (!employee) throw new ApiError(400, 'Karyawan tidak valid');

  const task = await TasksRepo.getById(taskId);
  if (!task) throw new ApiError(400, 'Task tidak valid');
  if (task.divisi !== FINISHING_DIVISION) {
    throw new ApiError(400, 'Update progress tanpa data pekerjaan hanya berlaku untuk divisi Finishing');
  }
  if (employee.divisi !== task.divisi) {
    throw new ApiError(403, 'Task ini bukan untuk divisi Anda');
  }

  await applyWorkLog(taskId, employeeId, qty);
  return getTaskDetail(taskId);
}

// Called by workLogService.updateWorkLog when an existing work log's
// quantity changes. qtyDelta is the change in quantity (positive = more
// completed, negative = less). Same atomic-updater reasoning as applyWorkLog.
export async function reapplyWorkLog(taskId, qtyDelta) {
  let orderId;
  let becameCompleted = false;
  let divisi;
  const updated = await TasksRepo.updateById(taskId, (task) => {
    const target = Number(task.target_qty);
    const currentCompleted = Number(task.completed_qty || 0);
    const nextCompleted = Math.max(0, currentCompleted + Number(qtyDelta));

    if (qtyDelta > 0 && nextCompleted > target) {
      throw new ApiError(400, `Quantity melebihi sisa target task (sisa ${target - currentCompleted})`);
    }

    orderId = task.order_id;
    divisi = task.divisi;
    const nextStatus = taskStatusFromQty(nextCompleted, target);
    becameCompleted = task.status !== 'completed' && nextStatus === 'completed';
    return { completed_qty: nextCompleted, status: nextStatus };
  });
  if (!updated) throw new ApiError(400, 'Task tidak valid');

  await recalculateOrderStatus(orderId);
  if (becameCompleted) await noteSubStageCompletion(orderId, divisi);
}

// Called by workLogService.deleteWorkLog. Same atomic-updater reasoning as
// applyWorkLog.
export async function removeWorkLog(taskId, qty) {
  let orderId;
  const updated = await TasksRepo.updateById(taskId, (task) => {
    const target = Number(task.target_qty);
    const currentCompleted = Number(task.completed_qty || 0);
    const nextCompleted = Math.max(0, currentCompleted - Number(qty));

    orderId = task.order_id;
    return { completed_qty: nextCompleted, status: taskStatusFromQty(nextCompleted, target) };
  });
  if (!updated) return; // task may have been deleted independently; nothing to reverse

  await recalculateOrderStatus(orderId);
}
