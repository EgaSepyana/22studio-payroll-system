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

function isDailyAttendanceRow(row) {
  return row.pay_source === 'attendance' && !!row.pay_date && row.pay_date !== '0';
}

// Attendance pay is daily, not monthly — an employee can have many open
// (unpaid) days across many periods at once. Kasbon must only ever be
// previewed as a deduction against the single chronologically earliest open
// day (same "next payroll, singular" rule as isEarliestOpenPeriod, just at
// day granularity), combining days already sitting unpaid in the sheet with
// the candidate days being reconciled right now in this call.
function earliestOpenDayForEmployee(payrollRows, employeeId, candidateDates) {
  const existingOpenDays = payrollRows
    .filter((p) => String(p.employee_id) === String(employeeId) && isDailyAttendanceRow(p) && p.payment_status === 'unpaid')
    .map((p) => p.pay_date);

  const allOpenDays = new Set([...existingOpenDays, ...candidateDates]);
  if (allOpenDays.size === 0) return null;
  return [...allOpenDays].sort()[0];
}

// Core day-by-day reconciliation for one Finishing-division employee, shared
// by the month view and the date-range view. `matchesPeriod(dateStr)` decides
// which attendance dates belong to the period being generated — the two
// callers just plug in a different predicate (calendar month vs. arbitrary
// date range) over the same upsert/cleanup logic.
async function reconcileAttendanceDaily(employee, payrollRows, cashAdvances, attendance, matchesPeriod) {
  const results = [];
  const hourlyRate = Number(employee.hourly_rate || 0);

  // Already-paid daily rows in this period always surface as-is.
  const existingPaidDaily = payrollRows.filter(
    (p) => String(p.employee_id) === String(employee.id) && isDailyAttendanceRow(p) && p.payment_status === 'paid' && matchesPeriod(p.pay_date)
  );
  for (const paidRow of existingPaidDaily) {
    results.push({ ...clean(paidRow), employee_name: employee.name });
  }

  const relevantAttendance = attendance.filter(
    (a) => String(a.employee_id) === String(employee.id) && !a.payroll_id && a.check_out && matchesPeriod(a.date)
  );
  const hoursByDate = new Map();
  for (const a of relevantAttendance) {
    hoursByDate.set(a.date, (hoursByDate.get(a.date) || 0) + Number(a.hours || 0));
  }

  // Unpaid daily rows in this period that no longer have matching unassigned
  // attendance hours (e.g. the attendance record's date was corrected, or the
  // row was added/edited by hand directly in the sheet) are surfaced as-is,
  // never deleted — a read must never destroy data. Only an explicit
  // "Tandai Sudah Dibayar" ever changes a row's state.
  const existingUnpaidDaily = payrollRows.filter(
    (p) =>
      String(p.employee_id) === String(employee.id) &&
      isDailyAttendanceRow(p) &&
      p.payment_status === 'unpaid' &&
      matchesPeriod(p.pay_date)
  );
  for (const row of existingUnpaidDaily) {
    if (!hoursByDate.has(row.pay_date)) {
      results.push({ ...clean(row), employee_name: employee.name });
    }
  }

  const earliestOpenDay = earliestOpenDayForEmployee(payrollRows, employee.id, [...hoursByDate.keys()]);

  for (const [date, hours] of hoursByDate) {
    const total = hours * hourlyRate;
    if (total <= 0) continue;

    const kasbonDeduction = date === earliestOpenDay ? computeApprovedUnpaidKasbon(cashAdvances, employee.id) : 0;
    const netSalary = total - kasbonDeduction;

    let dayRow = payrollRows.find(
      (p) => String(p.employee_id) === String(employee.id) && isDailyAttendanceRow(p) && p.pay_date === date && p.payment_status === 'unpaid'
    );

    if (!dayRow) {
      const d = new Date(date);
      dayRow = await PayrollRepo.insert({
        employee_id: employee.id,
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        total_salary: total,
        payment_status: 'unpaid',
        paid_at: '',
        paid_by: '',
        kasbon_deduction: kasbonDeduction,
        net_salary: netSalary,
        pay_source: 'attendance',
        pay_date: date,
      });
    } else if (Number(dayRow.total_salary) !== total || Number(dayRow.kasbon_deduction || 0) !== kasbonDeduction) {
      dayRow = await PayrollRepo.updateById(dayRow.id, {
        total_salary: total,
        kasbon_deduction: kasbonDeduction,
        net_salary: netSalary,
      });
    }

    results.push({ ...clean(dayRow), employee_name: employee.name });
  }

  return results;
}

// Auto-computes/upserts a Payroll row per employee for the given month/year,
// matching the PRD's "buka Payroll bulan Agustus -> sistem otomatis menjumlahkan" flow.
// Non-Finishing employees stay on the monthly piece-rate model; Finishing
// employees are reconciled day-by-day (see reconcileAttendanceDaily) since
// attendance pay is daily, not monthly — pay_date is 0 on their rows.
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

  const matchesMonth = (dateStr) => {
    const d = new Date(dateStr);
    return d.getMonth() + 1 === Number(month) && d.getFullYear() === Number(year);
  };

  const results = [];
  for (const employee of targetEmployees) {
    if (isFinishingEmployee(employee)) {
      // Any unpaid attendance row for this employee/period that predates the
      // daily model (no pay_date) or was added/edited by hand directly in
      // the sheet is surfaced as-is, never deleted — a read must never
      // destroy data, even a leftover/legacy row.
      const nonDailyUnpaid = payrollRows.filter(
        (p) =>
          String(p.employee_id) === String(employee.id) &&
          p.pay_source === 'attendance' &&
          !isDailyAttendanceRow(p) &&
          Number(p.month) === Number(month) &&
          Number(p.year) === Number(year) &&
          p.payment_status === 'unpaid'
      );
      for (const row of nonDailyUnpaid) {
        results.push({ ...clean(row), employee_name: employee.name });
      }

      results.push(...(await reconcileAttendanceDaily(employee, payrollRows, cashAdvances, attendance, matchesMonth)));
      continue;
    }

    const computedTotal = computeTotalForPeriod(workLogs, employee.id, month, year);
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
          pay_source: 'worklog',
          pay_date: 0,
        });
        results.push({ ...clean(unpaidRow), employee_name: employee.name });
      }
    } else if (computedTotal === 0 && kasbonDeduction === 0) {
      // Nothing currently backs this row from live work logs/kasbon — it may
      // have been added or edited by hand directly in the sheet. Surface it
      // as-is rather than deleting it; a read must never destroy data.
      results.push({ ...clean(unpaidRow), employee_name: employee.name });
    } else {
      if (
        Number(unpaidRow.total_salary) !== computedTotal ||
        Number(unpaidRow.kasbon_deduction || 0) !== kasbonDeduction
      ) {
        unpaidRow = await PayrollRepo.updateById(unpaidRow.id, {
          total_salary: computedTotal,
          kasbon_deduction: kasbonDeduction,
          net_salary: netSalary,
        });
      }
      results.push({ ...clean(unpaidRow), employee_name: employee.name });
    }
  }

  return results;
}

// Powers the Payroll page's date-range view for attendance (Finishing
// division) employees — an alternative to the month/year view above, since
// their pay is daily. Non-Finishing employees are out of scope here: they
// stay on the month/year view since their pay is monthly.
export async function getOrGenerateAttendancePayrollForRange(dateFrom, dateTo, employeeId, divisi) {
  const [employees, payrollRows, cashAdvances, attendance] = await batchGetAll([
    EmployeesRepo,
    PayrollRepo,
    CashAdvancesRepo,
    AttendanceRepo,
  ]);

  let targetEmployees = employees.filter(isFinishingEmployee);
  if (employeeId) targetEmployees = targetEmployees.filter((e) => String(e.id) === String(employeeId));
  if (divisi) targetEmployees = targetEmployees.filter((e) => e.divisi === divisi);

  const matchesRange = (dateStr) => dateStr >= dateFrom && dateStr <= dateTo;

  const results = [];
  for (const employee of targetEmployees) {
    results.push(...(await reconcileAttendanceDaily(employee, payrollRows, cashAdvances, attendance, matchesRange)));
  }

  results.sort((a, b) => (a.pay_date < b.pay_date ? 1 : -1));
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

  // Attendance pay is daily: a row with a real pay_date only ever covers that
  // one day. (Rows without one predate the daily model and still cover the
  // whole month — kept for backward compatibility with old unpaid rows.)
  const usesDailyPayDate = usesAttendance && row.pay_date && row.pay_date !== '0';
  const unassignedAttendance = usesAttendance
    ? attendance.filter((a) => {
        if (String(a.employee_id) !== String(row.employee_id)) return false;
        if (a.payroll_id) return false;
        if (!a.check_out) return false;
        if (usesDailyPayDate) return a.date === row.pay_date;
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

// Bulk "Tandai Sudah Dibayar" for the date-range view: pays every unpaid
// daily attendance row in [dateFrom, dateTo] in one shot. Re-derives each
// day fresh right before writing (same safety pattern as markAsPaid) and
// batches every touched row — attendance, kasbon, and Payroll, across
// however many days/employees are in range — into a single Sheets API call.
export async function markRangeAsPaid(dateFrom, dateTo, employeeId, divisi, adminId) {
  const rows = await getOrGenerateAttendancePayrollForRange(dateFrom, dateTo, employeeId, divisi);
  const unpaidRows = rows.filter((r) => r.payment_status === 'unpaid');
  if (unpaidRows.length === 0) return [];

  const [employees, attendance, cashAdvances, payrollRows] = await Promise.all([
    EmployeesRepo.getAll(),
    AttendanceRepo.getAll({ fresh: true }),
    CashAdvancesRepo.getAll({ fresh: true }),
    PayrollRepo.getAll({ fresh: true }),
  ]);
  const employeeMap = new Map(employees.map((e) => [String(e.id), e]));
  // getOrGenerateAttendancePayrollForRange returns public (cleaned) rows with
  // no _rowNumber — batchUpdateRows needs the raw row to address the sheet,
  // so re-map each unpaid row back to its raw counterpart before writing.
  const rawPayrollMap = new Map(payrollRows.map((p) => [String(p.id), p]));

  const paidAt = new Date().toISOString();
  const entries = [];
  const kasbonAlreadyQueued = new Set();

  for (const row of unpaidRows) {
    const employee = employeeMap.get(String(row.employee_id));
    const hourlyRate = Number(employee?.hourly_rate || 0);

    const unassignedAttendance = attendance.filter(
      (a) =>
        String(a.employee_id) === String(row.employee_id) &&
        !a.payroll_id &&
        a.check_out &&
        a.date === row.pay_date
    );
    const hours = unassignedAttendance.reduce((sum, a) => sum + Number(a.hours || 0), 0);
    const finalTotal = hours * hourlyRate;

    entries.push(
      ...unassignedAttendance.map((a) => ({
        repo: AttendanceRepo,
        existingRow: a,
        patch: { payroll_id: row.id },
      }))
    );

    // The fresh reconcile above already decided which single day (per
    // employee) carries the kasbon deduction — trust it rather than
    // re-deciding "earliest open day" again here.
    let kasbonDeduction = 0;
    if (Number(row.kasbon_deduction) > 0) {
      const approvedUnpaidKasbon = cashAdvances.filter(
        (c) =>
          String(c.employee_id) === String(row.employee_id) &&
          c.status === 'approved' &&
          !kasbonAlreadyQueued.has(String(c.id))
      );
      kasbonDeduction = approvedUnpaidKasbon.reduce((sum, c) => sum + Number(c.amount), 0);
      for (const kasbon of approvedUnpaidKasbon) {
        kasbonAlreadyQueued.add(String(kasbon.id));
        entries.push({
          repo: CashAdvancesRepo,
          existingRow: kasbon,
          patch: { status: 'paid', paid_at: paidAt, payroll_id: row.id },
        });
      }
    }

    const netSalary = finalTotal - kasbonDeduction;
    const rawRow = rawPayrollMap.get(String(row.id));
    if (!rawRow) continue; // deleted/changed between the reconcile above and now

    entries.push({
      repo: PayrollRepo,
      existingRow: rawRow,
      patch: {
        payment_status: 'paid',
        paid_at: paidAt,
        paid_by: adminId,
        total_salary: finalTotal,
        kasbon_deduction: kasbonDeduction,
        net_salary: netSalary,
      },
    });
  }

  await batchUpdateRows(entries);

  return getOrGenerateAttendancePayrollForRange(dateFrom, dateTo, employeeId, divisi);
}

export async function getPayrollDetail(payrollId) {
  const row = await PayrollRepo.getById(payrollId);
  if (!row) throw new ApiError(404, 'Data payroll tidak ditemukan');

  const usesAttendance = row.pay_source === 'attendance';
  const usesDailyPayDate = usesAttendance && row.pay_date && row.pay_date !== '0';
  const [employee, sourceRows, customers, articles] = await Promise.all([
    EmployeesRepo.getById(row.employee_id),
    usesAttendance ? AttendanceRepo.getAll() : WorkLogsRepo.getAll(),
    usesAttendance ? Promise.resolve([]) : CustomersRepo.getAll(),
    usesAttendance ? Promise.resolve([]) : ArticlesRepo.getAll(),
  ]);

  const filtered = sourceRows.filter((r) => {
    if (String(r.employee_id) !== String(row.employee_id)) return false;
    if (row.payment_status === 'paid') {
      return String(r.payroll_id) === String(row.id);
    }
    if (r.payroll_id) return false;
    if (usesDailyPayDate) {
      return r.date === row.pay_date;
    }
    const dateField = usesAttendance ? r.date : r.work_date;
    const d = new Date(dateField);
    return d.getMonth() + 1 === Number(row.month) && d.getFullYear() === Number(row.year);
  });

  const items = usesAttendance
    ? filtered.map((a) => ({
        ...clean(a),
        hours: Number(a.hours || 0),
        total: Number(a.hours || 0) * Number(employee?.hourly_rate || 0),
      }))
    : filtered.map((l) => {
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

  return {
    ...clean(row),
    employee_name: employee?.name || null,
    items_type: usesAttendance ? 'attendance' : 'worklog',
    items,
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
  // Date range only ever matches daily attendance rows (pay_date) — mirrors
  // the Payroll page's "Range Tanggal" view, which is attendance-only.
  if (filters.date_from) {
    rows = rows.filter((p) => isDailyAttendanceRow(p) && p.pay_date >= filters.date_from);
  }
  if (filters.date_to) {
    rows = rows.filter((p) => isDailyAttendanceRow(p) && p.pay_date <= filters.date_to);
  }
  if (filters.employee_id) {
    rows = rows.filter((p) => String(p.employee_id) === String(filters.employee_id));
  }
  if (filters.divisi) {
    const idsInDivisi = new Set(
      employees.filter((e) => e.divisi === filters.divisi).map((e) => String(e.id))
    );
    rows = rows.filter((p) => idsInDivisi.has(String(p.employee_id)));
  }

  rows.sort((a, b) => {
    if (isDailyAttendanceRow(a) && isDailyAttendanceRow(b)) return a.pay_date < b.pay_date ? 1 : -1;
    return Number(b.year) - Number(a.year) || Number(b.month) - Number(a.month);
  });

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
