import {
  WorkLogsRepo,
  ArticlesRepo,
  CustomersRepo,
  EmployeesRepo,
  TasksRepo,
  OrdersRepo,
  DEFAULT_WORK_STATUS,
} from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';
import * as taskService from './taskService.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

async function enrich(log) {
  const [employee, customer, article] = await Promise.all([
    EmployeesRepo.getById(log.employee_id),
    CustomersRepo.getById(log.customer_id),
    ArticlesRepo.getById(log.article_id),
  ]);
  return {
    ...clean(log),
    quantity: Number(log.quantity),
    price: Number(log.price),
    total: Number(log.total),
    employee_name: employee?.name || null,
    customer_name: customer?.name || null,
    article_name: article?.article_name || null,
  };
}

// Work logs are now always task-scoped: the customer/article/price are
// derived from the task's parent order rather than picked independently, and
// completing a work log advances the task's completed_qty.
export async function createWorkLog(employeeId, { task_id, work_date, quantity, notes, status }) {
  const employee = await EmployeesRepo.getById(employeeId);
  if (!employee) throw new ApiError(400, 'Karyawan tidak valid');

  if (!task_id) throw new ApiError(400, 'Task wajib dipilih');
  const task = await TasksRepo.getById(task_id);
  if (!task) throw new ApiError(400, 'Task tidak valid');
  if (task.divisi && employee.divisi !== task.divisi) {
    throw new ApiError(403, 'Task ini bukan untuk divisi Anda');
  }
  if (task.status === 'completed') {
    throw new ApiError(400, 'Task ini sudah selesai');
  }

  const order = await OrdersRepo.getById(task.order_id);
  if (!order) throw new ApiError(400, 'Order untuk task ini tidak ditemukan');

  const article = await ArticlesRepo.getById(task.article_id);
  if (!article) throw new ApiError(400, 'Artikel pada task tidak valid');

  const qty = Number(quantity);
  const remaining = Number(task.target_qty) - Number(task.completed_qty || 0);
  if (qty > remaining) {
    throw new ApiError(400, `Quantity melebihi sisa target task (sisa ${remaining})`);
  }

  const price = Number(article.price);
  const total = price * qty;

  const finalStatus = status || DEFAULT_WORK_STATUS;

  const log = await WorkLogsRepo.insert({
    employee_id: employeeId,
    customer_id: order.customer_id,
    article_id: task.article_id,
    work_date,
    quantity: qty,
    price,
    total,
    notes: notes || '',
    status: finalStatus,
    task_id,
  });

  // Task qty is advanced only after the work log itself is safely written —
  // if this throws (e.g. a race blew past "remaining"), the work log still
  // exists but the task wasn't over-credited. Task/order status is derived
  // purely from qty (see taskService.applyWorkLog) — the work log's own
  // status is just a label on that entry and never completes a task early.
  await taskService.applyWorkLog(task_id, employeeId, qty);

  return enrich(log);
}

export async function listWorkLogs(filters = {}) {
  let logs = await WorkLogsRepo.getAll();

  if (filters.employee_id) {
    logs = logs.filter((l) => String(l.employee_id) === String(filters.employee_id));
  }
  if (filters.customer_id) {
    logs = logs.filter((l) => String(l.customer_id) === String(filters.customer_id));
  }
  if (filters.article_id) {
    logs = logs.filter((l) => String(l.article_id) === String(filters.article_id));
  }
  if (filters.date_from) {
    logs = logs.filter((l) => l.work_date >= filters.date_from);
  }
  if (filters.date_to) {
    logs = logs.filter((l) => l.work_date <= filters.date_to);
  }
  if (filters.divisi) {
    const employees = await EmployeesRepo.getAll();
    const idsInDivisi = new Set(
      employees.filter((e) => e.divisi === filters.divisi).map((e) => String(e.id))
    );
    logs = logs.filter((l) => idsInDivisi.has(String(l.employee_id)));
  }

  logs.sort((a, b) => (a.work_date < b.work_date ? 1 : -1));

  return Promise.all(logs.map(enrich));
}

export async function updateWorkLog(logId, employeeId, role, updates) {
  const existing = await WorkLogsRepo.getById(logId);
  if (!existing) throw new ApiError(404, 'Data pekerjaan tidak ditemukan');

  // If role is employee, ensure they own it
  if (role === 'employee' && String(existing.employee_id) !== String(employeeId)) {
    throw new ApiError(403, 'Akses ditolak');
  }

  if (existing.payroll_id) {
    throw new ApiError(400, 'Tidak dapat mengubah pekerjaan yang sudah dibayar');
  }

  const { quantity, work_date, notes, status } = updates;
  const targetQty = quantity !== undefined ? Number(quantity) : Number(existing.quantity);
  const price = Number(existing.price);
  const finalStatus = status || existing.status || DEFAULT_WORK_STATUS;

  // Customer/article are fixed at creation time via the task, so they're
  // never edited here. Task sync only runs when qty changes — the work
  // log's status is just a label and never drives task/order completion.
  const qtyChanged = targetQty !== Number(existing.quantity);
  if (qtyChanged) {
    if (!existing.task_id) throw new ApiError(400, 'Data pekerjaan ini tidak terkait task');
    const qtyDelta = targetQty - Number(existing.quantity);
    await taskService.reapplyWorkLog(existing.task_id, qtyDelta);
  }

  const updated = await WorkLogsRepo.updateById(logId, {
    work_date: work_date || existing.work_date,
    quantity: targetQty,
    price,
    total: price * targetQty,
    notes: notes !== undefined ? notes : existing.notes,
    status: finalStatus,
  });

  return enrich(updated);
}

export async function deleteWorkLog(id) {
  const existing = await WorkLogsRepo.getById(id);
  if (!existing) throw new ApiError(404, 'Data pekerjaan tidak ditemukan');
  if (existing.payroll_id) {
    throw new ApiError(400, 'Tidak dapat menghapus pekerjaan yang sudah dibayar');
  }

  await WorkLogsRepo.deleteById(id);

  if (existing.task_id) {
    await taskService.removeWorkLog(existing.task_id, Number(existing.quantity));
  }
}
