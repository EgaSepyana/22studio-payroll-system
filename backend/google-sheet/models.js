import { SheetRepository } from './SheetRepository.js';

export const WORK_STATUSES = ['on_progress', 'selesai', 'belum_selesai'];
export const DEFAULT_WORK_STATUS = 'selesai';

export const CASH_ADVANCE_STATUSES = ['pending', 'approved', 'rejected', 'paid'];

export const DIVISIONS = ['Jahit', 'Sablon', 'Cutting', 'Finishing'];
export const FINISHING_DIVISION = 'Finishing';

export const PAY_SOURCES = ['worklog', 'attendance'];

export const ORDER_STATUSES = ['Desain Fix', 'On Progress', 'Done', 'Di Ambil Costumer'];
export const TASK_STATUSES = ['open', 'in_progress', 'completed'];

export const SHEET_SCHEMAS = {
  Users: ['id', 'username', 'password', 'role', 'employee_id'],
  Employees: ['id', 'name', 'phone', 'status', 'divisi', 'hourly_rate'],
  Customers: ['id', 'name'],
  Articles: ['id', 'customer_id', 'article_name', 'price', 'status', 'divisi'],
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
    'task_id',
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
    'pay_source',
    'pay_date',
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
  Attendance: ['id', 'employee_id', 'date', 'check_in', 'check_out', 'hours', 'payroll_id', 'notes'],
  Orders: ['id', 'customer_id', 'order_name', 'status', 'created_at', 'notes', 'deadline', 'invoice_no'],
  OrderItems: ['id', 'order_id', 'nama_item', 'harga', 'qty', 'total'],
  Tasks: [
    'id',
    'order_id',
    'article_id',
    'divisi',
    'description',
    'target_qty',
    'completed_qty',
    'assigned_to',
    'status',
    'created_at',
  ],
  SuratJalan: [
    'id',
    'no_document',
    'customer_id',
    'penerima_nama',
    'penerima_telepon',
    'penerima_alamat',
    'created_at',
  ],
  SuratJalanItems: ['id', 'surat_jalan_id', 'nama_item', 'harga', 'qty', 'jumlah'],
};

export const UsersRepo = new SheetRepository('Users', SHEET_SCHEMAS.Users);
export const EmployeesRepo = new SheetRepository('Employees', SHEET_SCHEMAS.Employees);
export const CustomersRepo = new SheetRepository('Customers', SHEET_SCHEMAS.Customers);
export const ArticlesRepo = new SheetRepository('Articles', SHEET_SCHEMAS.Articles);
export const WorkLogsRepo = new SheetRepository('WorkLogs', SHEET_SCHEMAS.WorkLogs);
export const PayrollRepo = new SheetRepository('Payroll', SHEET_SCHEMAS.Payroll);
export const CashAdvancesRepo = new SheetRepository('CashAdvances', SHEET_SCHEMAS.CashAdvances);
export const AttendanceRepo = new SheetRepository('Attendance', SHEET_SCHEMAS.Attendance);
export const OrdersRepo = new SheetRepository('Orders', SHEET_SCHEMAS.Orders);
export const OrderItemsRepo = new SheetRepository('OrderItems', SHEET_SCHEMAS.OrderItems);
export const TasksRepo = new SheetRepository('Tasks', SHEET_SCHEMAS.Tasks);
export const SuratJalanRepo = new SheetRepository('SuratJalan', SHEET_SCHEMAS.SuratJalan);
export const SuratJalanItemsRepo = new SheetRepository('SuratJalanItems', SHEET_SCHEMAS.SuratJalanItems);

