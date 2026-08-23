export type Role = 'admin' | 'employee' | 'admin_produksi' | 'owner'
export type Status = 'active' | 'inactive'
export type PaymentStatus = 'unpaid' | 'paid'
export type WorkStatus = 'on_progress' | 'selesai' | 'belum_selesai'
export type CashAdvanceStatus = 'pending' | 'approved' | 'rejected' | 'paid'
export type Divisi = 'Jahit' | 'Sablon' | 'Cutting' | 'Finishing'
export type PaySource = 'worklog' | 'attendance'
export type OrderStatus = 'Belum Di Proses' | 'Desain Fix' | 'On Progress' | 'Done' | 'Dikirim' | 'Di Ambil Costumer'
export type TaskStatus = 'open' | 'in_progress' | 'completed'

export type OrderJenisCategory =
  | 'ATRIBUT SEKOLAH'
  | 'CMT (cutting-finishing)'
  | 'JAKET'
  | 'JAS ALMAMATER'
  | 'JERSEY'
  | 'KAOS'
  | 'KAOS POLOS'
  | 'KAOS SATUAN'
  | 'KAOS WISATA'
  | 'KEMEJA'
  | 'MAKLON BORDIR'
  | 'MAKLON JAHIT'
  | 'MAKLON SABLON'
  | 'PENDAPATAN LAINNYA'
  | 'SERAGAM SEKOLAH'

export type OrderFrom = 'SHOPEE' | 'TIKTOK' | 'WHATSAPP' | 'WORKSHOP'

export type CustomerCategory =
  | 'BRAND OWNER'
  | 'KAOS ANAK'
  | 'KAOS EVENT'
  | 'KAOS WISATA'
  | 'SERAGAM KOMUNITAS'
  | 'SERAGAM PERUSAHAAN'
  | 'SERAGAM SEKOLAH'

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
  /** Rate for hours beyond 8 in a single day — Finishing division only. */
  upah_lembur_per_jam: number | null
}

export interface Customer {
  id: string
  name: string
  pic: string
  alamat: string
  no_hp: string
  category: CustomerCategory | ''
  /** Derived from the customer's most recent Order — never stored, always fresh. */
  terakhir_order: string | null
  order_terakhir: string | null
  category_ids: string[]
  category_names: (string | null)[]
}

export interface Article {
  id: string
  customer_ids: string[]
  article_name: string
  price: number
  status: Status
  divisi: Divisi | ''
  customer_names: (string | null)[]
  category_id: string
  category_name: string | null
}

export interface ArticleCategory {
  id: string
  name: string
  customer_ids: string[]
  customer_names: (string | null)[]
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
  /** Via task_id -> Tasks.order_id -> Orders. Null if task_id is missing/stale. */
  order_id: string | null
  order_name: string | null
}

export interface OrderItemSize {
  id: string
  order_item_id: string
  size: string
  harga: number
  qty: number
  total: number
}

export interface OrderItem {
  id: string
  order_id: string
  nama_item: string
  warna: string
  /** Never stored — always the sum/breakdown of this item's sizes. */
  sizes: OrderItemSize[]
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
  jenis_category: OrderJenisCategory | ''
  order_from: OrderFrom | ''
  broker: string
  desain_fix_url: string
  customer_name: string | null
  task_count: number
  completed_task_count: number
  progress: number
  item_count: number
  items_total: number
  /** Never stored — always the sum of this order's DP entries. */
  total_dp: number
  /** items_total - total_dp — what's still owed after any down payments. */
  sisa_pembayaran: number
}

export interface OrderDP {
  id: string
  order_id: string
  dp_at: string
  total_dp: number
}

export interface OrderDetail extends Order {
  tasks: Task[]
  items: OrderItem[]
  dp: OrderDP[]
}

export interface OrderTimelineEntry {
  id: string
  order_id: string
  stage: OrderStatus
  sub_stage: string
  note: string
  actor: 'system' | 'admin' | 'customer'
  created_at: string
}

export interface OrderShippingInfo {
  id: string
  order_id: string
  method: string
  resi: string
  note: string
  shipped_at: string
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
  deadline?: string | null
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
  /** Cumulative amount already deducted across possibly several partial payroll payments. */
  paid_amount: number
  /** amount - paid_amount — what's left to collect; status stays 'approved' until this reaches 0. */
  outstanding: number
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

export interface LembarPO {
  id: string
  order_id: string
  order_name: string | null
  customer_name: string | null
  sablon_bordir: string
  catatan: string
  label: boolean
  bahan_tipe: string
  pola_potong: string
  hangtag: boolean
  created_at: string
}

// Full print/preview shape — same data the PDF export renders, used by both
// the admin PDF/print flow and the employee-facing "Lihat Lembar PO" modal.
export interface LembarPODetail extends LembarPO {
  order: OrderDetail & { invoice_no: string }
}

export type WATemplateKey =
  | 'invoice'
  | 'payment_confirmation'
  | 'production_started'
  | 'order_completed'
  | 'payment_reminder'
  | 'picked_up'
  | 'qc_report'
  | 'design_confirmation'

export interface WATemplate {
  id: string
  template_key: WATemplateKey
  label: string
  content: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

// Landing-page CMS (content.js) — one interface per section, matching the
// sheet columns 1:1 (see backend/google-sheet/models.js SHEET_SCHEMAS).
export type CmsSection =
  | 'nav-links'
  | 'ink-swatches'
  | 'hero-stats'
  | 'hero-slides'
  | 'clients'
  | 'services'
  | 'projects'
  | 'steps'
  | 'stats-band'
  | 'faqs'

export interface CmsNavLink {
  id: string
  href: string
  label: string
}

export interface CmsInkSwatch {
  id: string
  code: string
  name: string
  css_var: string
}

export interface CmsHeroStat {
  id: string
  label: string
  value: string
}

export interface CmsHeroSlide {
  id: string
  image_url: string
  alt: string
}

export interface CmsClient {
  id: string
  name: string
  logo_url: string
}

export interface CmsService {
  id: string
  icon: string
  css_var: string
  title: string
  description: string
  points: string[]
}

export interface CmsProject {
  id: string
  title: string
  description: string
  image_url: string
}

export interface CmsStep {
  id: string
  stage: string
  title: string
  description: string
}

export interface CmsStatsBandItem {
  id: string
  value: string | number
  prefix: string
  suffix: string
  label: string
}

export interface CmsFaq {
  id: string
  question: string
  answer: string
}

export interface CmsGeneralSettings {
  wa_phone: string
  wa_default_message: string
  form_endpoint: string
}

export interface CmsFoundersPromise {
  quote: string
  name: string
  role: string
}

export interface CmsContactInfo {
  address: string
  phone: string
  email: string
  hours: string[]
  map_embed: string
}

// --- Owner (Keuangan) module ---

export type OwnerCategoryType = 'income' | 'expense' | 'asset' | 'inventory' | 'liability'

export type OwnerCogsBucket = 'fabric_purchase' | 'production_cost' | 'generic'

export interface OwnerCategory {
  id: string
  type: OwnerCategoryType
  name: string
  is_active: boolean
  /** Only meaningful for type 'income' — drives the Pemasukan page's sales-vs-other summary split. */
  is_sales_category: boolean
  /** Only meaningful for type 'liability' — the COGS bucket its auto-synced entry falls into. */
  cogs_bucket: OwnerCogsBucket | null
  created_at: string
}

export interface OwnerLocation {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface OwnerBusinessSettings {
  name: string
  address: string
  phone: string
  monthly_revenue_target: string
  daily_target: string
  monthly_target: string
  notes: string
  logo_url: string
  owner_name: string
  admin_name: string
}

export interface OwnerIncome {
  id: string
  date: string
  category_id: string
  account_id: string
  description: string
  amount: number
  created_at: string
  category_name: string | null
  is_sales_category: boolean
  account_name: string | null
}

export interface OwnerExpense {
  id: string
  date: string
  category_id: string
  account_id: string
  order_id: string
  description: string
  amount: number
  created_at: string
  category_name: string | null
  account_name: string | null
  order_name: string | null
  customer_name: string | null
  invoice_no: string | null
}

export interface OwnerExpensePickerOrder {
  id: string
  invoice_no: string
  order_name: string
  customer_name: string | null
  items_total: number
}

export interface OwnerOrderProfitability {
  order_id: string
  invoice_no: string
  order_name: string
  customer_name: string | null
  invoice_total: number
  total_expenses: number
  estimated_profit: number
}

export interface OwnerCashAccount {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface OwnerCashAccountBalance {
  id: string
  name: string
  balance: number
}

export interface OwnerCashBalances {
  accounts: OwnerCashAccountBalance[]
  total: number
}

export interface OwnerCashTransfer {
  id: string
  date: string
  from_account_id: string
  to_account_id: string
  amount: number
  description: string
  created_at: string
  from_account_name: string | null
  to_account_name: string | null
}

export type OwnerCashReconciliationStatus = 'over' | 'short' | 'matched'

export interface OwnerCashReconciliation {
  id: string
  date: string
  account_id: string
  system_balance: number
  actual_balance: number
  difference: number
  status: OwnerCashReconciliationStatus
  description: string
  created_at: string
  account_name: string | null
}

export type OwnerLiabilityStatus = 'unpaid' | 'partial' | 'paid'

export interface OwnerLiability {
  id: string
  code: string
  date: string
  due_date: string
  creditor_name: string
  creditor_address: string
  category_id: string
  qty: number
  unit_price: number
  value: number
  amount_paid: number
  remaining: number
  status: OwnerLiabilityStatus
  description: string
  cogs_entry_id: string
  created_at: string
  updated_at: string
  category_name: string | null
}

export interface OwnerLiabilityPayment {
  id: string
  liability_id: string
  date: string
  amount: number
  account_id: string
  description: string
  created_at: string
  account_name: string | null
}

export interface OwnerLiabilityDetail extends OwnerLiability {
  payments: OwnerLiabilityPayment[]
}

export type OwnerFundingSource = 'cash' | 'payable' | 'capital'

export interface OwnerFundingInput {
  funding_source: OwnerFundingSource
  account_id?: string
  creditor_name?: string
  creditor_address?: string
  due_date?: string
  capital_source_name?: string
  capital_note?: string
}

// --- Aset (Fixed Assets) ---

export interface OwnerFixedAsset {
  id: string
  code: string
  date: string
  name: string
  category_id: string
  location_id: string
  description: string
  created_at: string
  category_name: string | null
  location_name: string | null
  qty: number
  value: number
  unit_price: number
}

export interface OwnerFixedAssetTransaction {
  id: string
  asset_id: string
  date: string
  type: 'opening' | 'purchase' | 'sale'
  qty: number
  unit_price: number
  total_value: number
  funding_source: OwnerFundingSource | ''
  account_id: string
  liability_id: string
  capital_entry_id: string
  description: string
  created_at: string
}

export interface OwnerFixedAssetDetail extends OwnerFixedAsset {
  transactions: OwnerFixedAssetTransaction[]
}

// --- Stok Persediaan (Inventory) ---

export type OwnerInventoryItemType = 'raw_material' | 'finished_good'
export type OwnerInventoryExitType = 'production' | 'sold' | 'damaged'
export type OwnerInventorySaleMethod = 'cash' | 'credit'

export interface OwnerInventoryItem {
  id: string
  code: string
  date: string
  name: string
  category_id: string
  location_id: string
  item_type: OwnerInventoryItemType
  description: string
  created_at: string
  category_name: string | null
  location_name: string | null
  qty: number
  value: number
  unit_price: number
}

export interface OwnerInventoryTransaction {
  id: string
  item_id: string
  date: string
  type: 'opening' | 'stock_in' | 'stock_out'
  qty: number
  unit_price: number
  total_value: number
  funding_source: OwnerFundingSource | ''
  account_id: string
  liability_id: string
  capital_entry_id: string
  exit_type: OwnerInventoryExitType | ''
  sale_method: OwnerInventorySaleMethod | ''
  linked_transaction_id: string
  description: string
  created_at: string
}

export interface OwnerInventoryItemDetail extends OwnerInventoryItem {
  transactions: OwnerInventoryTransaction[]
}

// --- Dashboard ---

export interface OwnerDashboardRecentOrder {
  id: string
  order_name: string
  customer_name: string | null
  item_count: number
  items_total: number
  created_at: string
}

export interface OwnerDashboardTrendPoint {
  label: string
  revenue: number
  expense: number
}

export interface OwnerDashboard {
  revenue: number
  expense: number
  gross_profit: number
  cash_accounts: OwnerCashAccountBalance[]
  total_cash: number
  unpaid_receivables: number
  recent_orders: OwnerDashboardRecentOrder[]
  monthly_trend: OwnerDashboardTrendPoint[]
}

// --- Laba Rugi (P&L) / Neraca (Balance Sheet) ---

export interface OwnerReportRow {
  label: string
  total: number
}

export interface OwnerProfitLoss {
  month: string
  revenue: { rows: OwnerReportRow[]; total: number }
  cogs: { rows: OwnerReportRow[]; total: number }
  gross_profit: number
  expenses: { rows: OwnerReportRow[]; total: number }
  net_profit: number
}

export interface OwnerBalanceSheet {
  assets: {
    cash: { rows: OwnerReportRow[]; total: number }
    inventory: { total: number }
    fixed_assets: { total: number }
    receivables: { total: number }
    total: number
  }
  liabilities: { total: number }
  equity: {
    capital: number
    retained_earnings: number
    total: number
  }
  total_liabilities_and_equity: number
  discrepancy: number
  is_balanced: boolean
}
