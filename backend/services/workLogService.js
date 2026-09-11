import {
  WorkLogsRepo,
  ArticlesRepo,
  CustomersRepo,
  EmployeesRepo,
  TasksRepo,
  OrdersRepo,
  CustomerArticlesRepo,
  DEFAULT_WORK_STATUS,
  CUTTING_DIVISION,
  PENDING_AUDIT_WORK_STATUS,
} from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';
import * as taskService from './taskService.js';
import * as notificationService from './notificationService.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

// Shared by createWorkLog and updateWorkLog: a Cutting log's visible status
// is pending_audit whenever acc_owner isn't (yet) true, and the employee's/
// admin's actually-chosen status once it is — so the same rule applies
// whether acc_owner was already true at creation or only just got ticked on
// an edit.
function resolveCuttingStatus(accOwner, originalStatus) {
  return accOwner ? originalStatus : PENDING_AUDIT_WORK_STATUS;
}

async function enrich(log) {
  const [employee, customer, article, task] = await Promise.all([
    EmployeesRepo.getById(log.employee_id),
    CustomersRepo.getById(log.customer_id),
    ArticlesRepo.getById(log.article_id),
    log.task_id ? TasksRepo.getById(log.task_id) : null,
  ]);
  const order = task ? await OrdersRepo.getById(task.order_id) : null;
  return {
    ...clean(log),
    quantity: Number(log.quantity),
    price: Number(log.price),
    total: Number(log.total),
    employee_name: employee?.name || null,
    customer_name: customer?.name || null,
    article_name: article?.article_name || null,
    order_id: order?.id || null,
    order_name: order?.order_name || null,
    // Cutting-only audit checkboxes — always booleans (default false)
    // regardless of division, same treatment as every other enriched field.
    acc_owner: log.acc_owner === 'true',
    is_jumlah_size_sesuai: log.is_jumlah_size_sesuai === 'true',
    is_size_tertempel: log.is_size_tertempel === 'true',
  };
}

// Work logs are task-scoped for progress tracking (task_id, qty against the
// task's target) but the article/price are picked independently per entry —
// a task no longer carries a fixed article_id, so the employee (or admin)
// chooses which of the order's customer's articles this specific log is for.
export async function createWorkLog(
  employeeId,
  {
    task_id,
    article_id,
    work_date,
    quantity,
    notes,
    status,
    laporan_pengerjaan_foto,
    acc_owner,
    is_jumlah_size_sesuai,
    is_size_tertempel,
  },
  { actorRole } = {}
) {
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

  // Cutting must attach photo evidence of the work reported — every other
  // division leaves this empty.
  if (task.divisi === CUTTING_DIVISION && !laporan_pengerjaan_foto) {
    throw new ApiError(400, 'Foto laporan pengerjaan wajib diunggah untuk divisi Cutting');
  }

  const order = await OrdersRepo.getById(task.order_id);
  if (!order) throw new ApiError(400, 'Order untuk task ini tidak ditemukan');

  if (!article_id) throw new ApiError(400, 'Artikel wajib dipilih');
  const article = await ArticlesRepo.getById(article_id);
  if (!article) throw new ApiError(400, 'Artikel tidak valid');
  const customerArticles = await CustomerArticlesRepo.getAll();
  const isLinked = customerArticles.some(
    (ca) => String(ca.category_id) === String(article.category_id) && String(ca.customer_id) === String(order.customer_id)
  );
  if (!isLinked) {
    throw new ApiError(400, 'Artikel tidak sesuai dengan customer pada order ini');
  }

  const qty = Number(quantity);
  const remaining = Number(task.target_qty) - Number(task.completed_qty || 0);
  if (qty > remaining) {
    throw new ApiError(400, `Quantity melebihi sisa target task (sisa ${remaining})`);
  }

  const price = Number(article.price);
  const total = price * qty;

  const chosenStatus = status || DEFAULT_WORK_STATUS;

  // Cutting-only audit checkboxes — optional at creation (the employee may
  // not be ready to attest to them yet), editable later via updateWorkLog.
  // Always empty for every other division, same treatment as the photo.
  const isCutting = task.divisi === CUTTING_DIVISION;
  // A Cutting log's visible status is forced to pending_audit regardless of
  // what the employee picked — it isn't "done" until admin's acc_owner
  // checkbox says so, unless the employee already ticked acc_owner
  // themselves right here at submit (see resolveCuttingStatus). The
  // employee's actual choice is always remembered in original_status.
  // Every other division stores/shows chosenStatus exactly as before,
  // untouched.
  const finalStatus = isCutting ? resolveCuttingStatus(!!acc_owner, chosenStatus) : chosenStatus;
  const log = await WorkLogsRepo.insert({
    employee_id: employeeId,
    customer_id: order.customer_id,
    article_id,
    work_date,
    quantity: qty,
    price,
    total,
    notes: notes || '',
    status: finalStatus,
    task_id,
    laporan_pengerjaan_foto: laporan_pengerjaan_foto || '',
    acc_owner: isCutting ? String(!!acc_owner) : '',
    is_jumlah_size_sesuai: isCutting ? String(!!is_jumlah_size_sesuai) : '',
    is_size_tertempel: isCutting ? String(!!is_size_tertempel) : '',
    original_status: isCutting ? chosenStatus : '',
  });

  // Task qty is advanced only after the work log itself is safely written —
  // if this throws (e.g. a race blew past "remaining"), the work log still
  // exists but the task wasn't over-credited. Task/order status is derived
  // purely from qty (see taskService.applyWorkLog) — the work log's own
  // status is just a label on that entry and never completes a task early.
  await taskService.applyWorkLog(task_id, employeeId, qty);
  // A brand-new Cutting log could itself be the one that completes the
  // qty (task -> pending_audit) while already carrying acc_owner=true (the
  // employee ticked it on submit) — recheck so that case doesn't sit
  // pending_audit forever waiting for an edit that will never come.
  if (isCutting) await taskService.recheckCuttingAudit(task_id);

  // Only when the Cutting employee submits their own work — not when an
  // admin enters a log on their behalf (admin already knows and can tick
  // the checkboxes right there in the same form). A notification failure
  // must never fail the work-log submission itself, so this is swallowed
  // rather than awaited into the throw path.
  if (isCutting && actorRole === 'employee') {
    notificationService
      .notifyCuttingAuditNeeded({ workLogId: log.id, employeeName: employee.name, orderName: order.order_name })
      .catch((err) => console.error('Failed to create cutting-audit notification:', err));
  }

  return enrich(log);
}

// Single-item fetch — used by the notification click-through (the target
// WorkLog may not be on the currently-filtered/paginated list at all, so
// the edit dialog needs to fetch it directly by id instead).
export async function getWorkLog(id) {
  const log = await WorkLogsRepo.getById(id);
  if (!log) throw new ApiError(404, 'Data pekerjaan tidak ditemukan');
  return enrich(log);
}

export async function listWorkLogs(filters = {}) {
  let logs = await WorkLogsRepo.getAll();

  if (filters.task_id) {
    logs = logs.filter((l) => String(l.task_id) === String(filters.task_id));
  }
  if (filters.employee_id) {
    logs = logs.filter((l) => String(l.employee_id) === String(filters.employee_id));
  }
  if (filters.customer_id) {
    logs = logs.filter((l) => String(l.customer_id) === String(filters.customer_id));
  }
  if (filters.article_id) {
    logs = logs.filter((l) => String(l.article_id) === String(filters.article_id));
  }
  if (filters.status) {
    logs = logs.filter((l) => l.status === filters.status);
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

  const {
    quantity,
    work_date,
    notes,
    status,
    article_id,
    acc_owner,
    is_jumlah_size_sesuai,
    is_size_tertempel,
  } = updates;

  if (existing.payroll_id) {
    // Once paid, everything that affects pay (qty/price/article) or the
    // work-log's own record (status/notes/date) is locked — but the audit
    // checkboxes are orthogonal to payroll and must stay editable, or a
    // Cutting WorkLog paid before it was audited permanently strands its
    // task at 'pending_audit' with no way to ever finalize it (this was a
    // real production bug: 3 tasks stuck this way, all paid before this
    // checkbox existed). Reject only if something beyond the 3 audit
    // fields was actually sent — silently ignoring them would look like a
    // successful edit while quietly doing nothing.
    const attemptsOtherFields = [quantity, work_date, notes, status, article_id].some((v) => v !== undefined);
    if (attemptsOtherFields) {
      throw new ApiError(400, 'Tidak dapat mengubah pekerjaan yang sudah dibayar');
    }
  }

  const targetQty = quantity !== undefined ? Number(quantity) : Number(existing.quantity);

  // Article can be changed after creation (customer is still fixed — an
  // edit can only swap to another article already linked to this same
  // customer, same rule createWorkLog enforces via CustomerArticles, just
  // checked against the worklog's own stored customer_id instead of
  // re-walking task -> order since that's already the source of truth).
  // price/total are re-snapshotted from the new article, same
  // "frozen at write time" contract createWorkLog establishes — there's no
  // live recompute-from-Article path anywhere else, so this must happen here.
  let price = Number(existing.price);
  let nextArticleId = existing.article_id;
  if (article_id !== undefined && String(article_id) !== String(existing.article_id)) {
    const article = await ArticlesRepo.getById(article_id);
    if (!article) throw new ApiError(400, 'Artikel tidak valid');
    const customerArticles = await CustomerArticlesRepo.getAll();
    const isLinked = customerArticles.some(
      (ca) => String(ca.category_id) === String(article.category_id) && String(ca.customer_id) === String(existing.customer_id)
    );
    if (!isLinked) throw new ApiError(400, 'Artikel tidak sesuai dengan customer pada order ini');
    price = Number(article.price);
    nextArticleId = article_id;
  }

  // Task sync only runs when qty changes — the work log's status is just a
  // label and never drives task/order completion.
  const qtyChanged = targetQty !== Number(existing.quantity);
  if (qtyChanged) {
    if (!existing.task_id) throw new ApiError(400, 'Data pekerjaan ini tidak terkait task');
    const qtyDelta = targetQty - Number(existing.quantity);
    await taskService.reapplyWorkLog(existing.task_id, qtyDelta);
  }

  // Cutting-only audit checkboxes — only meaningful (and only ever written)
  // on a Cutting work log, same restriction createWorkLog applies at
  // creation. Left untouched (not force-cleared) for every other division,
  // since they're always already '' there and never sent by that form.
  const task = existing.task_id ? await TasksRepo.getById(existing.task_id) : null;
  const isCutting = task?.divisi === CUTTING_DIVISION;

  let statusPatch;
  if (isCutting) {
    // `status` here edits the *intended* status (original_status) — the
    // visible `status` field stays derived from acc_owner, exactly like at
    // creation, so an edit can never accidentally bypass pending_audit by
    // just sending a status without touching acc_owner.
    const nextOriginalStatus = status || existing.original_status || DEFAULT_WORK_STATUS;
    const nextAccOwner = acc_owner !== undefined ? !!acc_owner : existing.acc_owner === 'true';
    statusPatch = {
      original_status: nextOriginalStatus,
      status: resolveCuttingStatus(nextAccOwner, nextOriginalStatus),
    };
  } else {
    statusPatch = { status: status || existing.status || DEFAULT_WORK_STATUS };
  }

  const auditPatch = isCutting
    ? {
        ...(acc_owner !== undefined && { acc_owner: String(!!acc_owner) }),
        ...(is_jumlah_size_sesuai !== undefined && { is_jumlah_size_sesuai: String(!!is_jumlah_size_sesuai) }),
        ...(is_size_tertempel !== undefined && { is_size_tertempel: String(!!is_size_tertempel) }),
      }
    : {};

  const updated = await WorkLogsRepo.updateById(logId, {
    work_date: work_date || existing.work_date,
    quantity: targetQty,
    article_id: nextArticleId,
    price,
    total: price * targetQty,
    notes: notes !== undefined ? notes : existing.notes,
    ...statusPatch,
    ...auditPatch,
  });

  // Ticking acc_owner true here is what actually finalizes a Cutting task
  // out of pending_audit once every one of its WorkLogs is acc_owner=true —
  // see taskService.recheckCuttingAudit. No-ops for any other status/divisi.
  if (isCutting && existing.task_id) await taskService.recheckCuttingAudit(existing.task_id);

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
