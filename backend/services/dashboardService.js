import {
  EmployeesRepo,
  CustomersRepo,
  ArticlesRepo,
  WorkLogsRepo,
  PayrollRepo,
  AttendanceRepo,
  FINISHING_DIVISION,
} from '../google-sheet/models.js';
import { batchGetAll } from '../google-sheet/SheetRepository.js';
import { computeAttendancePay } from './payrollService.js';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// The 8h overtime threshold is per calendar day (see payrollService.js), so
// a monthly total can't just sum every record's hours and multiply once —
// that would apply the threshold to the whole month instead of each day.
// Group by date first, run each day through the same pay math payroll
// itself uses, then sum the days.
function sumAttendancePayByDay(records, hourlyRate, overtimeRate) {
  const hoursByDate = new Map();
  for (const a of records) {
    hoursByDate.set(a.date, (hoursByDate.get(a.date) || 0) + Number(a.hours || 0));
  }
  let total = 0;
  for (const hours of hoursByDate.values()) {
    total += computeAttendancePay(hours, hourlyRate, overtimeRate);
  }
  return total;
}

export async function getAdminDashboard() {
  // One Sheets API call fetches all five sheets instead of five separate ones.
  const [employees, customers, articles, logs, payroll] = await batchGetAll([
    EmployeesRepo,
    CustomersRepo,
    ArticlesRepo,
    WorkLogsRepo,
    PayrollRepo,
  ]);

  const today = todayStr();
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();

  const logsToday = logs.filter((l) => l.work_date === today);
  const revenueToday = logsToday.reduce((s, l) => s + Number(l.total), 0);

  const payrollThisMonth = payroll
    .filter((p) => Number(p.month) === curMonth && Number(p.year) === curYear)
    .reduce((s, p) => s + Number(p.total_salary), 0);

  const employeeMap = new Map(employees.map((e) => [String(e.id), e.name]));

  const recentActivity = [...logs]
    .sort((a, b) => (a.work_date < b.work_date ? 1 : -1))
    .slice(0, 8)
    .map((l) => ({
      employee_name: employeeMap.get(String(l.employee_id)) || 'Unknown',
      work_date: l.work_date,
      quantity: Number(l.quantity),
      total: Number(l.total),
    }));

  const productivityMap = new Map();
  for (const log of logs) {
    const key = String(log.employee_id);
    productivityMap.set(key, (productivityMap.get(key) || 0) + Number(log.quantity));
  }
  const topProductivity = Array.from(productivityMap.entries())
    .map(([id, quantity]) => ({ employee_name: employeeMap.get(id) || 'Unknown', quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const monthlyChart = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(curYear, curMonth - 1 - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const total = logs
      .filter((l) => {
        const ld = new Date(l.work_date);
        return ld.getMonth() + 1 === m && ld.getFullYear() === y;
      })
      .reduce((s, l) => s + Number(l.total), 0);
    monthlyChart.push({ label: `${y}-${String(m).padStart(2, '0')}`, total });
  }

  return {
    total_employees: employees.filter((e) => e.status === 'active').length,
    total_customers: customers.length,
    total_articles: articles.length,
    total_work_today: logsToday.length,
    total_revenue_today: revenueToday,
    total_payroll_this_month: payrollThisMonth,
    recent_activity: recentActivity,
    top_productivity: topProductivity,
    monthly_chart: monthlyChart,
  };
}

export async function getEmployeeDashboard(employeeId) {
  const employee = await EmployeesRepo.getById(employeeId);
  const today = todayStr();
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();

  if (employee?.divisi === FINISHING_DIVISION) {
    const attendance = await AttendanceRepo.getAll();
    const mine = attendance.filter((a) => String(a.employee_id) === String(employeeId));
    const todayRecords = mine.filter((a) => a.date === today);
    const monthRecords = mine.filter((a) => {
      const d = new Date(a.date);
      return d.getMonth() + 1 === curMonth && d.getFullYear() === curYear;
    });

    const hourlyRate = Number(employee.hourly_rate || 0);
    const overtimeRate = Number(employee.upah_lembur_per_jam || 0);
    const hoursToday = todayRecords.reduce((s, a) => s + Number(a.hours || 0), 0);
    const hoursThisMonth = monthRecords.reduce((s, a) => s + Number(a.hours || 0), 0);

    return {
      pay_source: 'attendance',
      income_today: computeAttendancePay(hoursToday, hourlyRate, overtimeRate),
      income_this_month: sumAttendancePayByDay(monthRecords, hourlyRate, overtimeRate),
      hours_today: hoursToday,
      hours_this_month: hoursThisMonth,
      work_count_this_month: monthRecords.length,
      total_quantity_this_month: 0,
    };
  }

  const logs = await WorkLogsRepo.getAll();
  const mine = logs.filter((l) => String(l.employee_id) === String(employeeId));

  const todayLogs = mine.filter((l) => l.work_date === today);
  const monthLogs = mine.filter((l) => {
    const d = new Date(l.work_date);
    return d.getMonth() + 1 === curMonth && d.getFullYear() === curYear;
  });

  return {
    pay_source: 'worklog',
    income_today: todayLogs.reduce((s, l) => s + Number(l.total), 0),
    income_this_month: monthLogs.reduce((s, l) => s + Number(l.total), 0),
    work_count_this_month: monthLogs.length,
    total_quantity_this_month: monthLogs.reduce((s, l) => s + Number(l.quantity), 0),
  };
}
