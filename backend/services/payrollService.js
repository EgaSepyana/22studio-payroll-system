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

// A kasbon can now be paid off across several partial payroll payments —
// paid_amount tracks how much of it has already been deducted, so
// "outstanding" (not the original amount) is what's left to collect.
// Status only flips to "paid" once outstanding reaches 0 (see
// allocateKasbonDeduction/markAsPaid), so "approved" alone no longer implies
// the full amount is still owed.
function outstandingAmount(kasbon) {
  return Number(kasbon.amount) - Number(kasbon.paid_amount || 0);
}

// "Approved" is the only status gate that matters here: once a cash advance
// is fully deducted its status flips to "paid" and it naturally drops out of
// this query — same exclusion pattern as payroll_id on WorkLogs, just
// expressed through the status field instead of a separate id check.
function computeApprovedUnpaidKasbon(cashAdvances, employeeId) {
  return cashAdvances
    .filter((c) => String(c.employee_id) === String(employeeId))
    .filter((c) => c.status === 'approved')
    .reduce((sum, c) => sum + outstandingAmount(c), 0);
}

// Allocates a chosen deduction amount (defaults to the full outstanding
// total, but an admin may choose to deduct less at payment time) across an
// employee's approved kasbon rows oldest-first. A row that's fully covered
// gets tagged paid (with this payroll_id); a row only partially covered
// keeps accruing paid_amount and stays "approved" for the remainder, to be
// picked up by a future payroll.
function allocateKasbonDeduction(approvedUnpaidKasbon, deductionAmount) {
  const sorted = [...approvedUnpaidKasbon].sort((a, b) => (a.requested_at < b.requested_at ? -1 : 1));
  let remaining = deductionAmount;
  const allocations = [];
  for (const kasbon of sorted) {
    if (remaining <= 0) break;
    const applied = Math.min(outstandingAmount(kasbon), remaining);
    if (applied <= 0) continue;
    allocations.push({ kasbon, applied });
    remaining -= applied;
  }
  return allocations;
}

// A kasbon deduction must never exceed what's actually being paid out that
// day — otherwise net_salary goes negative, which reads as the company
// owing the employee money back through a payroll line, and there is no
// such flow in this app. Cap it at earnings; whatever doesn't fit stays on
// the kasbon's outstanding balance (paid_amount is only ever incremented by
// however much was actually applied, per allocateKasbonDeduction) and rolls
// forward to the next payroll — never gets waived.
function capKasbonDeduction(kasbonDeduction, earnings) {
  return Math.min(kasbonDeduction, Math.max(0, Number(earnings)));
}

function kasbonAllocationPatch(kasbon, applied, payrollId, paidAt) {
  const newPaidAmount = Number(kasbon.paid_amount || 0) + applied;
  const fullyPaid = newPaidAmount >= Number(kasbon.amount);
  return fullyPaid
    ? { paid_amount: newPaidAmount, status: 'paid', paid_at: paidAt, payroll_id: payrollId }
    : { paid_amount: newPaidAmount };
}

function isDailyRow(row) {
  return !!row.pay_date && row.pay_date !== '0' && row.pay_date !== 0;
}

// Both pay models are daily now — an employee can have many open (unpaid)
// days across many periods at once. Kasbon must only ever be previewed as a
// deduction against the single chronologically earliest open day (kasbon.md:
// "masuk ke perhitungan payroll BERIKUTNYA" — the next one, singular),
// combining days already sitting unpaid in the sheet with the candidate days
// being reconciled right now in this call. Scoped to one pay_source since an
// employee only ever has one (fixed by their divisi), but kept explicit for
// correctness rather than relying on that always being true.
function earliestOpenDayForEmployee(payrollRows, employeeId, paySource, candidateDates) {
  const existingOpenDays = payrollRows
    .filter(
      (p) =>
        String(p.employee_id) === String(employeeId) &&
        p.pay_source === paySource &&
        isDailyRow(p) &&
        p.payment_status === 'unpaid'
    )
    .map((p) => p.pay_date);

  const allOpenDays = new Set([...existingOpenDays, ...candidateDates]);
  if (allOpenDays.size === 0) return null;
  return [...allOpenDays].sort()[0];
}

// Core day-by-day reconciliation, shared by both pay models (hourly
// attendance and piece-rate work logs) and both views (month and date-range).
// `matchesPeriod(dateStr)` decides which source-row dates belong to the
// period being generated; `dateOf`/`totalForRows` adapt the generic upsert
// logic below to each source's shape (attendance hours vs worklog totals).
async function reconcileDaily(employee, payrollRows, cashAdvances, sourceRows, matchesPeriod, { paySource, dateOf, totalForRows }) {
  const results = [];
  const isThisSource = (p) => p.pay_source === paySource;

  // Already-paid daily rows in this period always surface as-is.
  const existingPaidDaily = payrollRows.filter(
    (p) => String(p.employee_id) === String(employee.id) && isThisSource(p) && isDailyRow(p) && p.payment_status === 'paid' && matchesPeriod(p.pay_date)
  );
  for (const paidRow of existingPaidDaily) {
    results.push({ ...clean(paidRow), employee_name: employee.name });
  }

  const relevant = sourceRows.filter(
    (r) => String(r.employee_id) === String(employee.id) && !r.payroll_id && matchesPeriod(dateOf(r))
  );
  const rowsByDate = new Map();
  for (const r of relevant) {
    const date = dateOf(r);
    if (!rowsByDate.has(date)) rowsByDate.set(date, []);
    rowsByDate.get(date).push(r);
  }

  // Unpaid daily rows in this period that no longer have matching unassigned
  // source rows (e.g. a work log/attendance date was corrected, or the row
  // was added/edited by hand directly in the sheet) are surfaced as-is,
  // never deleted — a read must never destroy data. Only an explicit
  // "Tandai Sudah Dibayar" ever changes a row's state. A day CAN legitimately
  // have both a paid row and a separate unpaid one at once — more work
  // logged for that date after the first batch was already paid — so this
  // does NOT exclude dates that already have a paid sibling; genuinely empty
  // phantoms (no real unassigned work behind them) are instead identified
  // and cleaned up in the write paths (markAsPaid/markRangeAsPaid), which
  // can check the actual source data directly instead of inferring from
  // row shape alone.
  const existingUnpaidDaily = payrollRows.filter(
    (p) => String(p.employee_id) === String(employee.id) && isThisSource(p) && isDailyRow(p) && p.payment_status === 'unpaid' && matchesPeriod(p.pay_date)
  );
  for (const row of existingUnpaidDaily) {
    if (!rowsByDate.has(row.pay_date)) {
      results.push({ ...clean(row), employee_name: employee.name });
    }
  }

  const earliestOpenDay = earliestOpenDayForEmployee(payrollRows, employee.id, paySource, [...rowsByDate.keys()]);

  for (const [date, rows] of rowsByDate) {
    const total = totalForRows(rows);
    if (total <= 0) continue;

    const kasbonDeduction = date === earliestOpenDay ? capKasbonDeduction(computeApprovedUnpaidKasbon(cashAdvances, employee.id), total) : 0;
    const netSalary = total - kasbonDeduction;

    // Match only the UNPAID row for this day — a day can legitimately have
    // both a paid row (settled earlier) and a separate unpaid one (more
    // work logged for that same date afterward, still pending). Matching
    // without the status filter means .find() could resolve to whichever
    // row happens to come first in the array; if that's the paid one, the
    // real unpaid row for this date is silently skipped (never updated,
    // never surfaced) while the paid row gets pushed into `results` a
    // second time (it was already added by existingPaidDaily above).
    const findDayRow = (rows) =>
      rows.find(
        (p) =>
          String(p.employee_id) === String(employee.id) &&
          isThisSource(p) &&
          isDailyRow(p) &&
          p.pay_date === date &&
          p.payment_status === 'unpaid'
      );

    let dayRow = findDayRow(payrollRows);

    if (!dayRow) {
      // The `payrollRows` snapshot passed into this function can be
      // several requests old by the time execution reaches here (this
      // runs once per employee/day, in a loop, and is itself invoked from
      // a GET that has no exclusive lock on the sheet) — two concurrent
      // reconcile calls can both see "no row yet" from their own snapshot
      // and both insert, spawning a duplicate. A fresh re-check right
      // before the insert can't fully eliminate the race (Sheets has no
      // atomic compare-and-insert), but it closes the window down from
      // "however long the whole request took" to one more read, which is
      // enough for the realistic trigger here (two requests fired back to
      // back from the same user action).
      const freshPayrollRows = await PayrollRepo.getAll({ fresh: true });
      dayRow = findDayRow(freshPayrollRows);
    }

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
        pay_source: paySource,
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

async function reconcileAttendanceDaily(employee, payrollRows, cashAdvances, attendance, matchesPeriod) {
  const hourlyRate = Number(employee.hourly_rate || 0);
  return reconcileDaily(employee, payrollRows, cashAdvances, attendance.filter((a) => a.check_out), matchesPeriod, {
    paySource: 'attendance',
    dateOf: (a) => a.date,
    totalForRows: (rows) => rows.reduce((sum, a) => sum + Number(a.hours || 0), 0) * hourlyRate,
  });
}

async function reconcileWorklogDaily(employee, payrollRows, cashAdvances, workLogs, matchesPeriod) {
  return reconcileDaily(employee, payrollRows, cashAdvances, workLogs, matchesPeriod, {
    paySource: 'worklog',
    dateOf: (l) => l.work_date,
    totalForRows: (rows) => rows.reduce((sum, l) => sum + Number(l.total), 0),
  });
}

// Auto-computes/upserts a Payroll row per employee for the given month/year,
// matching the PRD's "buka Payroll bulan Agustus -> sistem otomatis menjumlahkan" flow.
// Every division is reconciled day-by-day now (see reconcileDaily): Finishing
// employees from Attendance hours, everyone else from WorkLogs totals. This
// view just filters that daily reconciliation down to one calendar month —
// the date-range view below runs the exact same reconciliation over an
// arbitrary span instead.
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
    const finishing = isFinishingEmployee(employee);
    const paySource = finishing ? 'attendance' : 'worklog';

    // Any unpaid row for this employee/period that predates the daily model
    // (no pay_date) or was added/edited by hand directly in the sheet is
    // surfaced as-is, never deleted — a read must never destroy data, even
    // a leftover/legacy row.
    const nonDailyUnpaid = payrollRows.filter(
      (p) =>
        String(p.employee_id) === String(employee.id) &&
        p.pay_source === paySource &&
        !isDailyRow(p) &&
        Number(p.month) === Number(month) &&
        Number(p.year) === Number(year) &&
        p.payment_status === 'unpaid'
    );
    for (const row of nonDailyUnpaid) {
      results.push({ ...clean(row), employee_name: employee.name });
    }

    if (finishing) {
      results.push(...(await reconcileAttendanceDaily(employee, payrollRows, cashAdvances, attendance, matchesMonth)));
    } else {
      results.push(...(await reconcileWorklogDaily(employee, payrollRows, cashAdvances, workLogs, matchesMonth)));
    }
  }

  return results;
}

// Powers the Payroll page's date-range view — an alternative to the
// month/year view above for browsing/paying daily payroll across an
// arbitrary span, for any division (piece-rate WorkLogs or hourly
// Attendance). Runs the exact same per-day reconciliation as the month view,
// just filtered by an arbitrary date range instead of a calendar month.
export async function getOrGeneratePayrollForRange(dateFrom, dateTo, employeeId, divisi) {
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
  if (divisi) targetEmployees = targetEmployees.filter((e) => e.divisi === divisi);

  const matchesRange = (dateStr) => dateStr >= dateFrom && dateStr <= dateTo;

  const results = [];
  for (const employee of targetEmployees) {
    if (isFinishingEmployee(employee)) {
      results.push(...(await reconcileAttendanceDaily(employee, payrollRows, cashAdvances, attendance, matchesRange)));
    } else {
      results.push(...(await reconcileWorklogDaily(employee, payrollRows, cashAdvances, workLogs, matchesRange)));
    }
  }

  results.sort((a, b) => (a.pay_date < b.pay_date ? 1 : -1));
  return results;
}

// kasbonDeductionInput (optional): how much of the employee's outstanding
// kasbon to deduct THIS payment — defaults to the full outstanding amount if
// omitted, but an admin may specify less, leaving the remainder "approved"
// and outstanding for a future payroll to pick up (see
// allocateKasbonDeduction). Must be between 0 and the total outstanding.
export async function markAsPaid(payrollId, adminId, kasbonDeductionInput) {
  const row = await PayrollRepo.getById(payrollId, { fresh: true });
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

  // A row with a real pay_date only ever covers that one day — both pay
  // models are daily now. (Rows without one predate the daily model and
  // still cover the whole month — kept for backward compatibility with old
  // unpaid rows.)
  const usesDailyPayDate = row.pay_date && row.pay_date !== '0';

  const unassignedLogs = usesAttendance
    ? []
    : workLogs.filter((l) => {
        if (String(l.employee_id) !== String(row.employee_id)) return false;
        if (l.payroll_id) return false;
        if (usesDailyPayDate) return l.work_date === row.pay_date;
        const d = new Date(l.work_date);
        return d.getMonth() + 1 === Number(row.month) && d.getFullYear() === Number(row.year);
      });

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

  // A row the admin saw with a real, non-zero total that suddenly has zero
  // unassigned work behind it at payment time is a duplicate whose sibling
  // already claimed the real work logs/attendance (see reconcileDaily/
  // markRangeAsPaid's dedup) — refuse rather than silently recording a
  // Rp0 payment against it.
  if (finalTotal === 0 && Number(row.total_salary) > 0) {
    throw new ApiError(
      400,
      'Data pekerjaan untuk payroll ini sudah tercatat di baris lain (kemungkinan duplikat) — muat ulang halaman dan periksa kembali.'
    );
  }

  const approvedUnpaidKasbon = cashAdvances.filter(
    (c) => String(c.employee_id) === String(row.employee_id) && c.status === 'approved'
  );
  const totalOutstanding = approvedUnpaidKasbon.reduce((sum, c) => sum + outstandingAmount(c), 0);
  // Never let a kasbon deduction exceed what's actually being paid out —
  // same rule as the preview in reconcileDaily, enforced again here since
  // an admin can override the previewed amount, and the day's real earnings
  // (finalTotal) may have shifted since that preview was generated.
  const maxDeduction = capKasbonDeduction(totalOutstanding, finalTotal);

  const kasbonDeduction = kasbonDeductionInput === undefined ? maxDeduction : Number(kasbonDeductionInput);
  if (!(kasbonDeduction >= 0) || kasbonDeduction > maxDeduction) {
    throw new ApiError(400, `Nominal potongan kasbon tidak valid (maksimal ${maxDeduction})`);
  }

  const netSalary = finalTotal - kasbonDeduction;
  const paidAt = new Date().toISOString();
  const kasbonAllocations = allocateKasbonDeduction(approvedUnpaidKasbon, kasbonDeduction);

  // Re-verify right before writing, not just at the top of this function —
  // everything above this line is async (multiple fresh Sheets reads), which
  // is exactly the window a concurrent duplicate call (a double-click with
  // no disabled state on the confirm button, or two requests racing across
  // separate serverless invocations) can slip through. Without this check, a
  // second call still in flight when the first one's write lands would go on
  // to recompute `finalTotal` against work logs the first call already
  // claimed — finding none left, landing on 0 — and then unconditionally
  // overwrite the payroll row's already-correct total_salary with that 0.
  const currentRow = await PayrollRepo.getById(payrollId, { fresh: true });
  if (!currentRow || currentRow.payment_status === 'paid') {
    throw new ApiError(400, 'Payroll sudah dibayar');
  }

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
    ...kasbonAllocations.map(({ kasbon, applied }) => ({
      repo: CashAdvancesRepo,
      existingRow: kasbon,
      patch: kasbonAllocationPatch(kasbon, applied, payrollId, paidAt),
    })),
    {
      repo: PayrollRepo,
      existingRow: currentRow,
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
// daily row in [dateFrom, dateTo] in one shot, regardless of division/pay
// source. Re-derives each day fresh right before writing (same safety
// pattern as markAsPaid) and batches every touched row — work logs or
// attendance, kasbon, and Payroll, across however many days/employees are in
// range — into a single Sheets API call.
export async function markRangeAsPaid(dateFrom, dateTo, employeeId, divisi, adminId) {
  // reconcileDaily's list view deliberately hides an unpaid row once a paid
  // sibling exists for the same employee/day/source (see reconcileDaily) —
  // right for what an admin should be offered to pay, wrong for cleanup,
  // which needs to actually find and delete a genuinely empty leftover.
  // Read straight from the sheet here instead of through
  // getOrGeneratePayrollForRange so this pass can see every row, hidden or
  // not — deliberately NOT filtered by employeeId/divisi, since cleanup is
  // safe regardless of which slice of employees this call happens to be
  // paying; only the final `unpaidRows` actually offered for payment below
  // gets narrowed to this call's employeeId/divisi scope.
  const [allPayrollRows, workLogs, attendance] = await Promise.all([
    PayrollRepo.getAll({ fresh: true }),
    WorkLogsRepo.getAll({ fresh: true }),
    AttendanceRepo.getAll({ fresh: true }),
  ]);
  const matchesRange = (dateStr) => dateStr && dateStr !== '0' && dateStr >= dateFrom && dateStr <= dateTo;
  const rows = allPayrollRows.filter((r) => matchesRange(r.pay_date));

  // A day CAN legitimately carry more than one row for the same
  // employee/source — e.g. one batch of work gets paid, then more work is
  // logged for that same date afterward and reconciles onto a fresh row of
  // its own (findDayRow only ever matches an UNPAID row, by design — see
  // reconcileDaily). What's never legitimate is an unpaid row with ZERO
  // real unassigned work/attendance behind it: that can only be a phantom
  // left over from a race (two reconcile calls both deciding "no row yet"
  // and both inserting). Check the real source data directly instead of
  // inferring "duplicate = phantom" from row shape alone — that inference
  // is what deleted real income the first time this was attempted.
  const rowsToDelete = [];
  let unpaidRows = [];
  for (const row of rows) {
    if (row.payment_status !== 'unpaid') continue;
    const hasRealWork =
      row.pay_source === 'attendance'
        ? attendance.some((a) => String(a.employee_id) === String(row.employee_id) && !a.payroll_id && a.check_out && a.date === row.pay_date)
        : workLogs.some((l) => String(l.employee_id) === String(row.employee_id) && !l.payroll_id && l.work_date === row.pay_date);
    if (hasRealWork) {
      unpaidRows.push(row);
    } else {
      rowsToDelete.push(row);
    }
  }
  for (const dupe of rowsToDelete) {
    await PayrollRepo.deleteById(dupe.id);
  }
  if (unpaidRows.length === 0) return [];

  const [employees, cashAdvances, payrollRows] = await Promise.all([
    EmployeesRepo.getAll(),
    CashAdvancesRepo.getAll({ fresh: true }),
    PayrollRepo.getAll({ fresh: true }),
  ]);
  const employeeMap = new Map(employees.map((e) => [String(e.id), e]));
  // getOrGeneratePayrollForRange returns public (cleaned) rows with no
  // _rowNumber — batchUpdateRows needs the raw row to address the sheet, so
  // re-map each unpaid row back to its raw counterpart before writing.
  const rawPayrollMap = new Map(payrollRows.map((p) => [String(p.id), p]));

  // Cleanup above deliberately ran unscoped; actual payment stays scoped to
  // this call's employeeId/divisi, same as before.
  unpaidRows = unpaidRows.filter((row) => {
    if (employeeId && String(row.employee_id) !== String(employeeId)) return false;
    if (divisi && employeeMap.get(String(row.employee_id))?.divisi !== divisi) return false;
    return true;
  });
  if (unpaidRows.length === 0) return [];

  const paidAt = new Date().toISOString();
  const entries = [];
  const kasbonAlreadyQueued = new Set();
  const kasbonRemainingByEmployee = new Map();

  // Process each employee's days oldest-first so a kasbon remainder that one
  // day's earnings couldn't fully cover rolls forward onto their next day,
  // not backward onto an earlier one that's already been decided.
  unpaidRows = [...unpaidRows].sort((a, b) => (a.pay_date < b.pay_date ? -1 : 1));

  for (const row of unpaidRows) {
    const usesAttendance = row.pay_source === 'attendance';
    const employee = employeeMap.get(String(row.employee_id));

    let finalTotal;
    if (usesAttendance) {
      const hourlyRate = Number(employee?.hourly_rate || 0);
      const unassignedAttendance = attendance.filter(
        (a) =>
          String(a.employee_id) === String(row.employee_id) && !a.payroll_id && a.check_out && a.date === row.pay_date
      );
      const hours = unassignedAttendance.reduce((sum, a) => sum + Number(a.hours || 0), 0);
      finalTotal = hours * hourlyRate;
      entries.push(
        ...unassignedAttendance.map((a) => ({ repo: AttendanceRepo, existingRow: a, patch: { payroll_id: row.id } }))
      );
    } else {
      const unassignedLogs = workLogs.filter(
        (l) => String(l.employee_id) === String(row.employee_id) && !l.payroll_id && l.work_date === row.pay_date
      );
      finalTotal = unassignedLogs.reduce((sum, l) => sum + Number(l.total), 0);
      entries.push(
        ...unassignedLogs.map((l) => ({ repo: WorkLogsRepo, existingRow: l, patch: { payroll_id: row.id } }))
      );
    }

    // reconcileDaily only ever flags the single earliest open day as the
    // one carrying a kasbon preview — but capping that day's deduction at
    // its own earnings (see capKasbonDeduction) can leave a remainder that
    // day alone can't absorb. Rather than strand that remainder until a
    // whole separate payroll run, let it roll forward into the NEXT day
    // this same batch pays for that employee: track running outstanding
    // kasbon per employee (kasbonRemainingByEmployee) instead of a
    // one-shot per-employee flag, and keep offering it to each subsequent
    // day (in date order) until it's fully absorbed or the batch ends.
    let kasbonDeduction = 0;
    const hasPendingKasbon = Number(row.kasbon_deduction) > 0 || kasbonRemainingByEmployee.has(String(row.employee_id));
    if (hasPendingKasbon) {
      const approvedUnpaidKasbon = cashAdvances.filter(
        (c) =>
          String(c.employee_id) === String(row.employee_id) &&
          c.status === 'approved' &&
          !kasbonAlreadyQueued.has(String(c.id))
      );
      const totalOutstanding = approvedUnpaidKasbon.reduce((sum, c) => sum + outstandingAmount(c), 0);
      kasbonDeduction = capKasbonDeduction(totalOutstanding, finalTotal);
      let stillOutstanding = totalOutstanding;
      for (const { kasbon, applied } of allocateKasbonDeduction(approvedUnpaidKasbon, kasbonDeduction)) {
        stillOutstanding -= applied;
        const patch = kasbonAllocationPatch(kasbon, applied, row.id, paidAt);
        // Only remove a kasbon from further consideration in this batch once
        // it's actually fully paid off — a partial application must stay
        // available for the next day to keep chipping away at.
        if (patch.status === 'paid') kasbonAlreadyQueued.add(String(kasbon.id));
        entries.push({ repo: CashAdvancesRepo, existingRow: kasbon, patch });
      }
      if (stillOutstanding > 0) {
        kasbonRemainingByEmployee.set(String(row.employee_id), stillOutstanding);
      } else {
        kasbonRemainingByEmployee.delete(String(row.employee_id));
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

  // Re-verify every payroll row's status right before writing, not just at
  // the top of this function — everything above is async and can span many
  // employees/days, which is exactly the window a second concurrent call
  // (double-click on "Ya, Tandai Semua", or the same race across two
  // requests) can slip through: it would independently see the same rows as
  // still-unpaid from its own snapshot, recompute totals against work logs
  // the first call already claimed — finding none left, landing on 0 — and
  // write that 0 over an already-correct payment. Drop any Payroll entry
  // whose row has been paid since `payrollRows` was fetched; its work-log/
  // attendance/kasbon entries are dropped too so nothing gets double-tagged.
  const freshPayrollRows = await PayrollRepo.getAll({ fresh: true });
  const freshStatusById = new Map(freshPayrollRows.map((p) => [String(p.id), p.payment_status]));
  const stillUnpaidIds = new Set(
    entries.filter((e) => e.repo === PayrollRepo).map((e) => String(e.existingRow.id)).filter((id) => freshStatusById.get(id) === 'unpaid')
  );
  const safeEntries = entries.filter((e) => {
    if (e.repo === PayrollRepo) return stillUnpaidIds.has(String(e.existingRow.id));
    return stillUnpaidIds.has(String(e.patch.payroll_id));
  });

  await batchUpdateRows(safeEntries);

  return getOrGeneratePayrollForRange(dateFrom, dateTo, employeeId, divisi);
}

export async function getPayrollDetail(payrollId) {
  const row = await PayrollRepo.getById(payrollId);
  if (!row) throw new ApiError(404, 'Data payroll tidak ditemukan');

  const usesAttendance = row.pay_source === 'attendance';
  const usesDailyPayDate = row.pay_date && row.pay_date !== '0';
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
    const dateField = usesAttendance ? r.date : r.work_date;
    if (usesDailyPayDate) {
      return dateField === row.pay_date;
    }
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
  // Date range only ever matches daily rows (pay_date) — mirrors the Payroll
  // page's "Range Tanggal" view, which covers every division now.
  if (filters.date_from) {
    rows = rows.filter((p) => isDailyRow(p) && p.pay_date >= filters.date_from);
  }
  if (filters.date_to) {
    rows = rows.filter((p) => isDailyRow(p) && p.pay_date <= filters.date_to);
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
    if (isDailyRow(a) && isDailyRow(b)) return a.pay_date < b.pay_date ? 1 : -1;
    return Number(b.year) - Number(a.year) || Number(b.month) - Number(a.month);
  });

  const expanded = rows.map((row) => {
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

  // A date-range export/print should read as one slip per employee covering
  // the whole range, not one page per paid day — merge same-employee,
  // same-pay-source daily rows into a single combined row with all items and
  // summed totals, tagged with the range's start/end for the period label.
  if (!filters.date_from && !filters.date_to) return expanded;

  const merged = new Map();
  for (const row of expanded) {
    const key = `${row.employee_id}:${row.items_type}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...row,
        items: [...row.items],
        total_salary: Number(row.total_salary),
        kasbon_deduction: Number(row.kasbon_deduction || 0),
        net_salary: Number(row.net_salary),
        pay_date_from: row.pay_date,
        pay_date_to: row.pay_date,
      });
    } else {
      existing.items.push(...row.items);
      existing.total_salary += Number(row.total_salary);
      existing.kasbon_deduction += Number(row.kasbon_deduction || 0);
      existing.net_salary += Number(row.net_salary);
      if (row.pay_date < existing.pay_date_from) existing.pay_date_from = row.pay_date;
      if (row.pay_date > existing.pay_date_to) existing.pay_date_to = row.pay_date;
    }
  }

  return [...merged.values()].map((row) => ({
    ...row,
    items: row.items.sort((a, b) => {
      const da = a.work_date || a.date;
      const db = b.work_date || b.date;
      return da < db ? -1 : da > db ? 1 : 0;
    }),
  }));
}

export async function getEmployeePayrollHistory(employeeId) {
  const rows = await PayrollRepo.getAll();
  return rows
    .filter((r) => String(r.employee_id) === String(employeeId))
    .sort(
      (a, b) =>
        Number(b.year) - Number(a.year) ||
        Number(b.month) - Number(a.month) ||
        (b.pay_date > a.pay_date ? 1 : -1)
    )
    .map(clean);
}
