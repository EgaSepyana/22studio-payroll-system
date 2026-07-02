import {
  WorkLogsRepo,
  ArticlesRepo,
  CustomersRepo,
  EmployeesRepo,
  DEFAULT_WORK_STATUS,
} from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';

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

export async function createWorkLog(employeeId, { customer_id, article_id, work_date, quantity, notes, status }) {
  const employee = await EmployeesRepo.getById(employeeId);
  if (!employee) throw new ApiError(400, 'Karyawan tidak valid');

  const article = await ArticlesRepo.getById(article_id);
  if (!article) throw new ApiError(400, 'Artikel tidak valid');
  if (String(article.customer_id) !== String(customer_id)) {
    throw new ApiError(400, 'Artikel tidak sesuai dengan customer');
  }

  const price = Number(article.price);
  const qty = Number(quantity);
  const total = price * qty;

  const log = await WorkLogsRepo.insert({
    employee_id: employeeId,
    customer_id,
    article_id,
    work_date,
    quantity: qty,
    price,
    total,
    notes: notes || '',
    status: status || DEFAULT_WORK_STATUS,
  });

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

  const { article_id, customer_id, quantity, work_date, notes, status } = updates;
  const targetArticleId = article_id || existing.article_id;
  const targetCustomerId = customer_id || existing.customer_id;
  const targetQty = quantity ? Number(quantity) : Number(existing.quantity);

  let price = Number(existing.price);

  if (article_id || customer_id) {
    const article = await ArticlesRepo.getById(targetArticleId);
    if (!article) throw new ApiError(400, 'Artikel tidak valid');
    if (String(article.customer_id) !== String(targetCustomerId)) {
      throw new ApiError(400, 'Artikel tidak sesuai dengan customer');
    }
    price = Number(article.price);
  }

  const total = price * targetQty;

  const updated = await WorkLogsRepo.updateById(logId, {
    customer_id: targetCustomerId,
    article_id: targetArticleId,
    work_date: work_date || existing.work_date,
    quantity: targetQty,
    price,
    total,
    notes: notes !== undefined ? notes : existing.notes,
    status: status || existing.status || DEFAULT_WORK_STATUS,
  });

  return enrich(updated);
}
