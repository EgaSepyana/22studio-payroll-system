import { PayrollRepo, WorkLogsRepo, EmployeesRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

function computeTotalForPeriod(workLogs, employeeId, month, year) {
  return workLogs
    .filter((l) => String(l.employee_id) === String(employeeId))
    .filter((l) => !l.payroll_id) // only include unassigned logs
    .filter((l) => {
      const d = new Date(l.work_date);
      return d.getMonth() + 1 === Number(month) && d.getFullYear() === Number(year);
    })
    .reduce((sum, l) => sum + Number(l.total), 0);
}

// Auto-computes/upserts a Payroll row per employee for the given month/year,
// matching the PRD's "buka Payroll bulan Agustus -> sistem otomatis menjumlahkan" flow.
export async function getOrGeneratePayroll(month, year, employeeId) {
  const [employees, workLogs, payrollRows] = await Promise.all([
    EmployeesRepo.getAll(),
    WorkLogsRepo.getAll(),
    PayrollRepo.getAll({ fresh: true }),
  ]);

  const targetEmployees = employeeId
    ? employees.filter((e) => String(e.id) === String(employeeId))
    : employees;

  const results = [];
  for (const employee of targetEmployees) {
    const computedTotal = computeTotalForPeriod(workLogs, employee.id, month, year);
    
    // Get all paid payroll rows for this employee/month/year
    const existingPaid = payrollRows.filter(
      (p) =>
        String(p.employee_id) === String(employee.id) &&
        Number(p.month) === Number(month) &&
        Number(p.year) === Number(year) &&
        p.payment_status === 'paid'
    );
    for (const paidRow of existingPaid) {
      results.push({ ...clean(paidRow), employee_name: employee.name });
    }

    // Get or create unpaid payroll row if there are unpaid logs
    let unpaidRow = payrollRows.find(
      (p) =>
        String(p.employee_id) === String(employee.id) &&
        Number(p.month) === Number(month) &&
        Number(p.year) === Number(year) &&
        p.payment_status === 'unpaid'
    );

    if (!unpaidRow) {
      if (computedTotal > 0) {
        unpaidRow = await PayrollRepo.insert({
          employee_id: employee.id,
          month: Number(month),
          year: Number(year),
          total_salary: computedTotal,
          payment_status: 'unpaid',
          paid_at: '',
          paid_by: '',
        });
        results.push({ ...clean(unpaidRow), employee_name: employee.name });
      }
    } else if (computedTotal === 0) {
      // Everything that used to back this pending row moved out of the
      // period (e.g. the work log's date was edited) — drop the now-empty row.
      await PayrollRepo.deleteById(unpaidRow.id);
    } else {
      if (Number(unpaidRow.total_salary) !== computedTotal) {
        unpaidRow = await PayrollRepo.updateById(unpaidRow.id, { total_salary: computedTotal });
      }
      results.push({ ...clean(unpaidRow), employee_name: employee.name });
    }
  }

  return results;
}

export async function markAsPaid(payrollId, adminId) {
  const row = await PayrollRepo.getById(payrollId);
  if (!row) throw new ApiError(404, 'Data payroll tidak ditemukan');
  if (row.payment_status === 'paid') throw new ApiError(400, 'Payroll sudah dibayar');

  // Re-derive the exact set of unassigned work logs for this employee/period
  // right now (a log may have been added since the last GET), tag each one
  // with this payroll_id, and use their sum as the locked-in paid total —
  // never trust the row's possibly-stale cached total_salary here.
  const workLogs = await WorkLogsRepo.getAll({ fresh: true });
  const unassignedLogs = workLogs.filter((l) => {
    if (String(l.employee_id) !== String(row.employee_id)) return false;
    if (l.payroll_id) return false;
    const d = new Date(l.work_date);
    return d.getMonth() + 1 === Number(row.month) && d.getFullYear() === Number(row.year);
  });

  for (const log of unassignedLogs) {
    await WorkLogsRepo.updateById(log.id, { payroll_id: payrollId });
  }

  const finalTotal = unassignedLogs.reduce((sum, l) => sum + Number(l.total), 0);

  const updated = await PayrollRepo.updateById(payrollId, {
    payment_status: 'paid',
    paid_at: new Date().toISOString(),
    paid_by: adminId,
    total_salary: finalTotal,
  });

  return clean(updated);
}

export async function getPayrollDetail(payrollId) {
  const row = await PayrollRepo.getById(payrollId);
  if (!row) throw new ApiError(404, 'Data payroll tidak ditemukan');

  const [employee, workLogs] = await Promise.all([
    EmployeesRepo.getById(row.employee_id),
    WorkLogsRepo.getAll(),
  ]);

  const items = workLogs.filter((l) => {
    if (String(l.employee_id) !== String(row.employee_id)) return false;
    if (row.payment_status === 'paid') {
      return String(l.payroll_id) === String(row.id);
    } else {
      if (l.payroll_id) return false;
      const d = new Date(l.work_date);
      return d.getMonth() + 1 === Number(row.month) && d.getFullYear() === Number(row.year);
    }
  });

  return {
    ...clean(row),
    employee_name: employee?.name || null,
    items: items.map(clean),
  };
}

export async function getEmployeePayrollHistory(employeeId) {
  const rows = await PayrollRepo.getAll();
  return rows
    .filter((r) => String(r.employee_id) === String(employeeId))
    .sort((a, b) => Number(b.year) - Number(a.year) || Number(b.month) - Number(a.month))
    .map(clean);
}
