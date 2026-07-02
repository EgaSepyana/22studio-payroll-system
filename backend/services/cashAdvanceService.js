import { CashAdvancesRepo, EmployeesRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

async function enrich(record) {
  const employee = await EmployeesRepo.getById(record.employee_id);
  return {
    ...clean(record),
    amount: Number(record.amount),
    employee_name: employee?.name || null,
  };
}

export async function createCashAdvance(employeeId, { amount, reason }) {
  const employee = await EmployeesRepo.getById(employeeId);
  if (!employee) throw new ApiError(400, 'Karyawan tidak valid');

  const value = Number(amount);
  if (!(value > 0)) throw new ApiError(400, 'Nominal harus lebih dari Rp0');

  const record = await CashAdvancesRepo.insert({
    employee_id: employeeId,
    amount: value,
    reason: reason || '',
    status: 'pending',
    requested_at: new Date().toISOString(),
    approved_at: '',
    approved_by: '',
    paid_at: '',
    payroll_id: '',
  });

  return enrich(record);
}

export async function listCashAdvances(filters = {}) {
  let rows = await CashAdvancesRepo.getAll();

  if (filters.employee_id) {
    rows = rows.filter((r) => String(r.employee_id) === String(filters.employee_id));
  }
  if (filters.status) {
    rows = rows.filter((r) => r.status === filters.status);
  }
  if (filters.date_from) {
    rows = rows.filter((r) => r.requested_at >= filters.date_from);
  }
  if (filters.date_to) {
    // requested_at is a full ISO timestamp; make an inclusive end-of-day bound
    // when the caller passes a plain date (YYYY-MM-DD).
    const bound = filters.date_to.length === 10 ? `${filters.date_to}T23:59:59.999Z` : filters.date_to;
    rows = rows.filter((r) => r.requested_at <= bound);
  }
  if (filters.divisi) {
    const employees = await EmployeesRepo.getAll();
    const idsInDivisi = new Set(
      employees.filter((e) => e.divisi === filters.divisi).map((e) => String(e.id))
    );
    rows = rows.filter((r) => idsInDivisi.has(String(r.employee_id)));
  }

  rows.sort((a, b) => (a.requested_at < b.requested_at ? 1 : -1));

  return Promise.all(rows.map(enrich));
}

export async function getCashAdvanceDetail(id) {
  const record = await CashAdvancesRepo.getById(id);
  if (!record) throw new ApiError(404, 'Data kasbon tidak ditemukan');
  return enrich(record);
}

export async function approveCashAdvance(id, adminId) {
  const record = await CashAdvancesRepo.getById(id);
  if (!record) throw new ApiError(404, 'Data kasbon tidak ditemukan');
  if (record.status !== 'pending') throw new ApiError(400, 'Kasbon sudah diproses sebelumnya');

  const updated = await CashAdvancesRepo.updateById(id, {
    status: 'approved',
    approved_at: new Date().toISOString(),
    approved_by: adminId,
  });

  return enrich(updated);
}

export async function rejectCashAdvance(id, adminId) {
  const record = await CashAdvancesRepo.getById(id);
  if (!record) throw new ApiError(404, 'Data kasbon tidak ditemukan');
  if (record.status !== 'pending') throw new ApiError(400, 'Kasbon sudah diproses sebelumnya');

  const updated = await CashAdvancesRepo.updateById(id, {
    status: 'rejected',
    approved_at: new Date().toISOString(),
    approved_by: adminId,
  });

  return enrich(updated);
}
