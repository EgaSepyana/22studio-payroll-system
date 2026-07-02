import { SheetRepository } from './SheetRepository.js';

export const WORK_STATUSES = ['on_progress', 'selesai', 'belum_selesai'];
export const DEFAULT_WORK_STATUS = 'selesai';

export const CASH_ADVANCE_STATUSES = ['pending', 'approved', 'rejected', 'paid'];

export const SHEET_SCHEMAS = {
  Users: ['id', 'username', 'password', 'role', 'employee_id'],
  Employees: ['id', 'name', 'phone', 'status'],
  Customers: ['id', 'name'],
  Articles: ['id', 'customer_id', 'article_name', 'price', 'status'],
  WorkLogs: [
    'id',
    'employee_id',
    'customer_id',
    'article_id',
    'work_date',
    'quantity',
    'price',
    'total',
    'notes',
    'payroll_id',
    'status',
  ],
  Payroll: [
    'id',
    'employee_id',
    'month',
    'year',
    'total_salary',
    'payment_status',
    'paid_at',
    'paid_by',
    'kasbon_deduction',
    'net_salary',
  ],
  CashAdvances: [
    'id',
    'employee_id',
    'amount',
    'reason',
    'status',
    'requested_at',
    'approved_at',
    'approved_by',
    'paid_at',
    'payroll_id',
  ],
};

export const UsersRepo = new SheetRepository('Users', SHEET_SCHEMAS.Users);
export const EmployeesRepo = new SheetRepository('Employees', SHEET_SCHEMAS.Employees);
export const CustomersRepo = new SheetRepository('Customers', SHEET_SCHEMAS.Customers);
export const ArticlesRepo = new SheetRepository('Articles', SHEET_SCHEMAS.Articles);
export const WorkLogsRepo = new SheetRepository('WorkLogs', SHEET_SCHEMAS.WorkLogs);
export const PayrollRepo = new SheetRepository('Payroll', SHEET_SCHEMAS.Payroll);
export const CashAdvancesRepo = new SheetRepository('CashAdvances', SHEET_SCHEMAS.CashAdvances);
