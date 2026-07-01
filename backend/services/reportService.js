import { WorkLogsRepo, EmployeesRepo, CustomersRepo, ArticlesRepo } from '../google-sheet/models.js';
import { dayKey, isoWeekKey, monthKey, yearKey } from '../utils/dateUtils.js';
import { ApiError } from '../utils/response.js';

const GROUPERS = {
  daily: dayKey,
  weekly: isoWeekKey,
  monthly: monthKey,
  yearly: yearKey,
};

export async function buildReport({ groupBy, date_from, date_to, employee_id, customer_id, article_id }) {
  const [logs, employees, customers, articles] = await Promise.all([
    WorkLogsRepo.getAll(),
    EmployeesRepo.getAll(),
    CustomersRepo.getAll(),
    ArticlesRepo.getAll(),
  ]);

  const employeeMap = new Map(employees.map((e) => [String(e.id), e.name]));
  const customerMap = new Map(customers.map((c) => [String(c.id), c.name]));
  const articleMap = new Map(articles.map((a) => [String(a.id), a.article_name]));

  let filtered = logs;
  if (date_from) filtered = filtered.filter((l) => l.work_date >= date_from);
  if (date_to) filtered = filtered.filter((l) => l.work_date <= date_to);
  if (employee_id) filtered = filtered.filter((l) => String(l.employee_id) === String(employee_id));
  if (customer_id) filtered = filtered.filter((l) => String(l.customer_id) === String(customer_id));
  if (article_id) filtered = filtered.filter((l) => String(l.article_id) === String(article_id));

  let keyFn;
  let labelFn;

  if (GROUPERS[groupBy]) {
    keyFn = (l) => GROUPERS[groupBy](l.work_date);
    labelFn = (key) => key;
  } else if (groupBy === 'customer') {
    keyFn = (l) => String(l.customer_id);
    labelFn = (key) => customerMap.get(key) || `#${key}`;
  } else if (groupBy === 'article') {
    keyFn = (l) => String(l.article_id);
    labelFn = (key) => articleMap.get(key) || `#${key}`;
  } else if (groupBy === 'employee') {
    keyFn = (l) => String(l.employee_id);
    labelFn = (key) => employeeMap.get(key) || `#${key}`;
  } else {
    throw new ApiError(400, 'groupBy tidak valid');
  }

  const groups = new Map();
  for (const log of filtered) {
    const key = keyFn(log);
    const existing = groups.get(key) || { key, label: labelFn(key), quantity: 0, total: 0, count: 0 };
    existing.quantity += Number(log.quantity);
    existing.total += Number(log.total);
    existing.count += 1;
    groups.set(key, existing);
  }

  const rows = Array.from(groups.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
  const grandQuantity = rows.reduce((sum, r) => sum + r.quantity, 0);

  return { groupBy, rows, grand_total: grandTotal, grand_quantity: grandQuantity };
}
