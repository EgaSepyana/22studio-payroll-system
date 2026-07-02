import {
  PayrollRepo,
  WorkLogsRepo,
  EmployeesRepo,
  CashAdvancesRepo,
  AttendanceRepo,
  CustomersRepo,
  ArticlesRepo,
  FINISHING_DIVISION,
} from '../google-sheet/models.js';
import { batchGetAll, batchUpdateRows } from '../google-sheet/SheetRepository.js';
import { ApiError } from '../utils/response.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

function isFinishingEmployee(employee) {
  return employee?.divisi === FINISHING_DIVISION;
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

// Mirrors computeTotalForPeriod's exclusion pattern (unassigned = !payroll_id)
// but for hourly attendance instead of piece-rate work logs. Only completed
// sessions (check_out set) count — an open check-in with no check-out yet
// contributes zero hours until it's closed out.
function computeAttendanceTotalForPeriod(attendance, employeeId, hourlyRate, month, year) {
  const hours = attendance
    .filter((a) => String(a.employee_id) === String(employeeId))
    .filter((a) => !a.payroll_id)
    .filter((a) => a.check_out)
    .filter((a) => {
      const d = new Date(a.date);
      return d.getMonth() + 1 === Number(month) && d.getFullYear() === Number(year);
    })
    .reduce((sum, a) => sum + Number(a.hours || 0), 0);
  return hours * Number(hourlyRate || 0);
}

// "Approved" is the only gate that matters here: once a cash advance is
// deducted from a payroll its status flips to "paid" and it naturally drops
// out of this query — same exclusion pattern as payroll_id on WorkLogs, just
// expressed through the status field instead of a separate id check.
function computeApprovedUnpaidKasbon(cashAdvances, employeeId) {
  return cashAdvances
    .filter((c) => String(c.employee_id) === String(employeeId))
    .filter((c) => c.status === 'approved')
    .reduce((sum, c) => sum + Number(c.amount), 0);
}

// An employee can have more than one open (unpaid) payroll period at once —
// e.g. July is still unpaid when August's work already started. Kasbon must
// only ever be previewed as a deduction against ONE of them (kasbon.md: "masuk
// ke perhitungan payroll BERIKUTNYA" — the next one, singular), otherwise the
// same approved amount would appear to double-deduct across every open period.
// It always applies to the chronologically earliest open period; if none of
// the employee's periods are open yet, it applies to whichever period is
// currently being generated.
function isEarliestOpenPeriod(payrollRows, employeeId, month, year) {
  const openPeriods = payrollRows
    .filter((p) => String(p.employee_id) === String(employeeId) && p.payment_status === 'unpaid')
    .map((p) => ({ month: Number(p.month), year: Number(p.year) }));

  const alreadyIncluded = openPeriods.some((p) => p.month === Number(month) && p.year === Number(year));
  if (!alreadyIncluded) openPeriods.push({ month: Number(month), year: Number(year) });

  openPeriods.sort((a, b) => a.year - b.year || a.month - b.month);
  const earliest = openPeriods[0];
  return earliest.month === Number(month) && earliest.year === Number(year);
}

// Auto-computes/upserts a Payroll row per employee for the given month/year,
// matching the PRD's "buka Payroll bulan Agustus -> sistem otomatis menjumlahkan" flow.
export async function getOrGeneratePayroll(month, year, employeeId, divisi) {
  // One Sheets API call fetches all five sheets instead of five separate ones.
  const [employees, workLogs, payrollRows, cashAdvances, attendance] = await batchGetAll([
    EmployeesRepo,
    WorkLogsRepo,
    PayrollRepo,
    CashAdvancesRepo,
    AttendanceRepo,
  ]);

  let targetEmployees = employeeId
    ? employees.filter((e) => String(e.id) === String(employeeId))
    : employees;
  if (divisi) {
    targetEmployees = targetEmployees.filter((e) => e.divisi === divisi);
  }

  const results = [];
  for (const employee of targetEmployees) {
    const finishing = isFinishingEmployee(employee);
    const paySource = finishing ? 'attendance' : 'worklog';
    const computedTotal = finishing
      ? computeAttendanceTotalForPeriod(attendance, employee.id, employee.hourly_rate, month, year)
      : computeTotalForPeriod(workLogs, employee.id, month, year);
    const kasbonDeduction = isEarliestOpenPeriod(payrollRows, employee.id, month, year)
      ? computeApprovedUnpaidKasbon(cashAdvances, employee.id)
      : 0;
    const netSalary = computedTotal - kasbonDeduction;

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

    // Get or create unpaid payroll row if there's anything to reconcile —
    // either logged work or approved-but-unpaid kasbon (an employee can have
    // kasbon deducted even in a period with no work logged).
    let unpaidRow = payrollRows.find(
      (p) =>
        String(p.employee_id) === String(employee.id) &&
        Number(p.month) === Number(month) &&
        Number(p.year) === Number(year) &&
        p.payment_status === 'unpaid'
    );

    if (!unpaidRow) {
      if (computedTotal > 0 || kasbonDeduction > 0) {
        unpaidRow = await PayrollRepo.insert({
          employee_id: employee.id,
          month: Number(month),
          year: Number(year),
          total_salary: computedTotal,
          payment_status: 'unpaid',
          paid_at: '',
          paid_by: '',
          kasbon_deduction: kasbonDeduction,
          net_salary: netSalary,
          pay_source: paySource,
        });
        results.push({ ...clean(unpaidRow), employee_name: employee.name });
      }
    } else if (computedTotal === 0 && kasbonDeduction === 0) {
      // Everything that used to back this pending row moved out of the
      // period (e.g. the work log's date was edited) — drop the now-empty row.
      await PayrollRepo.deleteById(unpaidRow.id);
    } else {
      if (
        Number(unpaidRow.total_salary) !== computedTotal ||
        Number(unpaidRow.kasbon_deduction || 0) !== kasbonDeduction ||
        unpaidRow.pay_source !== paySource
      ) {
        unpaidRow = await PayrollRepo.updateById(unpaidRow.id, {
          total_salary: computedTotal,
          kasbon_deduction: kasbonDeduction,
          net_salary: netSalary,
          pay_source: paySource,
        });
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

  // The source (worklog vs attendance) was fixed at generation time and is
  // trusted here rather than re-derived from the employee's current divisi —
  // the total_salary the admin already reviewed was computed from that source,
  // so payment must lock in the same source even if the employee's division
  // changed in between.
  const usesAttendance = row.pay_source === 'attendance';

  // Re-derive the exact set of unassigned work logs (or attendance records)
  // for this employee/period right now (a record may have been added since
  // the last GET), and the exact set of approved-but-unpaid kasbon, right
  // before locking them in — this is the one place staleness would be a real
  // money bug, so these reads stay forced-fresh even though everything else
  // in this file now relies on the write-through cache.
  const [employee, workLogs, attendance, cashAdvances] = await Promise.all([
    EmployeesRepo.getById(row.employee_id),
    usesAttendance ? Promise.resolve([]) : WorkLogsRepo.getAll({ fresh: true }),
    usesAttendance ? AttendanceRepo.getAll({ fresh: true }) : Promise.resolve([]),
    CashAdvancesRepo.getAll({ fresh: true }),
  ]);

  const unassignedLogs = usesAttendance
    ? []
    : workLogs.filter((l) => {
        if (String(l.employee_id) !== String(row.employee_id)) return false;
        if (l.payroll_id) return false;
        const d = new Date(l.work_date);
        return d.getMonth() + 1 === Number(row.month) && d.getFullYear() === Number(row.year);
      });

  const unassignedAttendance = usesAttendance
    ? attendance.filter((a) => {
        if (String(a.employee_id) !== String(row.employee_id)) return false;
        if (a.payroll_id) return false;
        if (!a.check_out) return false;
        const d = new Date(a.date);
        return d.getMonth() + 1 === Number(row.month) && d.getFullYear() === Number(row.year);
      })
    : [];

  const finalTotal = usesAttendance
    ? unassignedAttendance.reduce((sum, a) => sum + Number(a.hours || 0), 0) * Number(employee?.hourly_rate || 0)
    : unassignedLogs.reduce((sum, l) => sum + Number(l.total), 0);

  const approvedUnpaidKasbon = cashAdvances.filter(
    (c) => String(c.employee_id) === String(row.employee_id) && c.status === 'approved'
  );
  const kasbonDeduction = approvedUnpaidKasbon.reduce((sum, c) => sum + Number(c.amount), 0);
  const netSalary = finalTotal - kasbonDeduction;
  const paidAt = new Date().toISOString();

  // Every row this action touches — the work logs, the kasbon, and the
  // payroll row itself — gets written in a single Sheets API call instead of
  // one call per row (previously 2 calls *per row* since updateById forced a
  // fresh read first). Ranges can span different tabs in one batchUpdate.
  const entries = [
    ...unassignedLogs.map((log) => ({
      repo: WorkLogsRepo,
      existingRow: log,
      patch: { payroll_id: payrollId },
    })),
    ...unassignedAttendance.map((a) => ({
      repo: AttendanceRepo,
      existingRow: a,
      patch: { payroll_id: payrollId },
    })),
    ...approvedUnpaidKasbon.map((kasbon) => ({
      repo: CashAdvancesRepo,
      existingRow: kasbon,
      patch: { status: 'paid', paid_at: paidAt, payroll_id: payrollId },
    })),
    {
      repo: PayrollRepo,
      existingRow: row,
      patch: {
        payment_status: 'paid',
        paid_at: paidAt,
        paid_by: adminId,
        total_salary: finalTotal,
        kasbon_deduction: kasbonDeduction,
        net_salary: netSalary,
      },
    },
  ];

  const results = await batchUpdateRows(entries);
  const updated = results[results.length - 1]; // the Payroll entry, always last

  return clean(updated);
}

export async function getPayrollDetail(payrollId) {
  const row = await PayrollRepo.getById(payrollId);
  if (!row) throw new ApiError(404, 'Data payroll tidak ditemukan');

  const usesAttendance = row.pay_source === 'attendance';
  const [employee, sourceRows] = await Promise.all([
    EmployeesRepo.getById(row.employee_id),
    usesAttendance ? AttendanceRepo.getAll() : WorkLogsRepo.getAll(),
  ]);

  const items = sourceRows.filter((r) => {
    if (String(r.employee_id) !== String(row.employee_id)) return false;
    if (row.payment_status === 'paid') {
      return String(r.payroll_id) === String(row.id);
    }
    if (r.payroll_id) return false;
    const dateField = usesAttendance ? r.date : r.work_date;
    const d = new Date(dateField);
    return d.getMonth() + 1 === Number(row.month) && d.getFullYear() === Number(row.year);
  });

  return {
    ...clean(row),
    employee_name: employee?.name || null,
    items_type: usesAttendance ? 'attendance' : 'worklog',
    items: items.map(clean),
  };
}

// Powers the payroll export/print feature: only ever paid rows, since an
// unpaid preview has no locked-in kasbon/net figures to print.
export async function listPaidPayrollForExport(filters = {}) {
  const [employees, customers, articles, payrollRows, workLogs, attendance] = await batchGetAll([
    EmployeesRepo,
    CustomersRepo,
    ArticlesRepo,
    PayrollRepo,
    WorkLogsRepo,
    AttendanceRepo,
  ]);

  let rows = payrollRows.filter((p) => p.payment_status === 'paid');
  if (filters.id) rows = rows.filter((p) => String(p.id) === String(filters.id));
  if (filters.month) rows = rows.filter((p) => Number(p.month) === Number(filters.month));
  if (filters.year) rows = rows.filter((p) => Number(p.year) === Number(filters.year));
  if (filters.employee_id) {
    rows = rows.filter((p) => String(p.employee_id) === String(filters.employee_id));
  }
  if (filters.divisi) {
    const idsInDivisi = new Set(
      employees.filter((e) => e.divisi === filters.divisi).map((e) => String(e.id))
    );
    rows = rows.filter((p) => idsInDivisi.has(String(p.employee_id)));
  }

  rows.sort((a, b) => Number(b.year) - Number(a.year) || Number(b.month) - Number(a.month));

  return rows.map((row) => {
    const employee = employees.find((e) => String(e.id) === String(row.employee_id));
    const usesAttendance = row.pay_source === 'attendance';

    let items;
    if (usesAttendance) {
      const hourlyRate = Number(employee?.hourly_rate || 0);
      items = attendance
        .filter((a) => String(a.employee_id) === String(row.employee_id) && String(a.payroll_id) === String(row.id))
        .map((a) => ({
          ...clean(a),
          hours: Number(a.hours || 0),
          total: Number(a.hours || 0) * hourlyRate,
        }));
    } else {
      items = workLogs
        .filter((l) => String(l.employee_id) === String(row.employee_id) && String(l.payroll_id) === String(row.id))
        .map((l) => {
          const customer = customers.find((c) => String(c.id) === String(l.customer_id));
          const article = articles.find((a) => String(a.id) === String(l.article_id));
          return {
            ...clean(l),
            quantity: Number(l.quantity),
            price: Number(l.price),
            total: Number(l.total),
            customer_name: customer?.name || null,
            article_name: article?.article_name || null,
          };
        });
    }

    return {
      ...clean(row),
      employee_name: employee?.name || null,
      items_type: usesAttendance ? 'attendance' : 'worklog',
      items,
    };
  });
}

export async function getEmployeePayrollHistory(employeeId) {
  const rows = await PayrollRepo.getAll();
  return rows
    .filter((r) => String(r.employee_id) === String(employeeId))
    .sort((a, b) => Number(b.year) - Number(a.year) || Number(b.month) - Number(a.month))
    .map(clean);
}
