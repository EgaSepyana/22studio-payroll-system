export type Role = 'admin' | 'employee'
export type Status = 'active' | 'inactive'
export type PaymentStatus = 'unpaid' | 'paid'
export type WorkStatus = 'on_progress' | 'selesai' | 'belum_selesai'
export type CashAdvanceStatus = 'pending' | 'approved' | 'rejected' | 'paid'
export type Divisi = 'Jahit' | 'Sablon' | 'Cutting' | 'Finishing'
export type PaySource = 'worklog' | 'attendance'
export type OrderStatus = 'Desain Fix' | 'On Progress' | 'Done' | 'Di Ambil Costumer'
export type TaskStatus = 'open' | 'in_progress' | 'completed'

export interface AuthUser {
  id: string
  username: string
  role: Role
  employee_id: string | null
  name: string
  phone: string | null
  divisi: Divisi | null
}

export interface Employee {
  id: string
  name: string
  phone: string
  status: Status
  username: string | null
  divisi: Divisi | ''
  hourly_rate: number | null
}

export interface Customer {
  id: string
  name: string
}

export interface Article {
  id: string
  customer_id: string
  article_name: string
  price: number
  status: Status
  divisi: Divisi | ''
  customer_name: string | null
}

export interface WorkLog {
  id: string
  employee_id: string
  customer_id: string
  article_id: string
  work_date: string
  quantity: number
  price: number
  total: number
  notes: string
  payroll_id?: string
  status: WorkStatus
  task_id?: string
  employee_name: string | null
  customer_name: string | null
  article_name: string | null
}

export interface OrderItem {
  id: string
  order_id: string
  nama_item: string
  harga: number
  qty: number
  total: number
}

export interface Order {
  id: string
  customer_id: string
  order_name: string
  status: OrderStatus
  created_at: string
  notes: string
  deadline: string
  customer_name: string | null
  task_count: number
  completed_task_count: number
  progress: number
  item_count: number
  items_total: number
}

export interface OrderDetail extends Order {
  tasks: Task[]
  items: OrderItem[]
}

export interface Task {
  id: string
  order_id: string
  divisi: Divisi
  description: string
  target_qty: number
  completed_qty: number
  remaining_qty: number
  progress: number
  assigned_to: string
  assigned_to_name: string | null
  status: TaskStatus
  created_at: string
  order_name?: string | null
  customer_id?: string | null
  customer_name?: string | null
}

export interface Attendance {
  id: string
  employee_id: string
  date: string
  check_in: string
  check_out: string
  hours: number | null
  payroll_id?: string
  notes: string
  employee_name: string | null
}

export interface PayrollRow {
  id: string
  employee_id: string
  month: number
  year: number
  total_salary: number
  payment_status: PaymentStatus
  paid_at: string
  paid_by: string
  kasbon_deduction: number
  net_salary: number
  pay_source: PaySource
  /** Specific date this row pays for. Only meaningful when pay_source is 'attendance' (daily pay) — 0 for worklog (monthly) rows. */
  pay_date: string | number
  employee_name: string
}

export interface PayrollDetail extends PayrollRow {
  items_type: PaySource
  items: (WorkLog | Attendance)[]
}

export interface CashAdvance {
  id: string
  employee_id: string
  amount: number
  reason: string
  status: CashAdvanceStatus
  requested_at: string
  approved_at: string
  approved_by: string
  paid_at: string
  payroll_id?: string
  employee_name: string | null
}

export interface AdminDashboard {
  total_employees: number
  total_customers: number
  total_articles: number
  total_work_today: number
  total_revenue_today: number
  total_payroll_this_month: number
  recent_activity: {
    employee_name: string
    work_date: string
    quantity: number
    total: number
  }[]
  top_productivity: { employee_name: string; quantity: number }[]
  monthly_chart: { label: string; total: number }[]
}

export interface EmployeeDashboard {
  pay_source: PaySource
  income_today: number
  income_this_month: number
  work_count_this_month: number
  total_quantity_this_month: number
  hours_today?: number
  hours_this_month?: number
}

export type ReportGroupBy =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'customer'
  | 'article'
  | 'employee'

export interface ReportRow {
  key: string
  label: string
  quantity: number
  total: number
  count: number
}

export interface Report {
  groupBy: ReportGroupBy
  rows: ReportRow[]
  grand_total: number
  grand_quantity: number
}

export interface SuratJalanItem {
  id: string
  surat_jalan_id: string
  nama_item: string
  qty: number
}

export interface SuratJalan {
  id: string
  no_document: string
  customer_id: string
  customer_name: string | null
  penerima_nama: string
  penerima_telepon: string
  penerima_alamat: string
  created_at: string
  item_count: number
}

export interface SuratJalanDetail extends SuratJalan {
  items: SuratJalanItem[]
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}
