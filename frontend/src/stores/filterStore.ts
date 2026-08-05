import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CashAdvanceStatus, Divisi, OrderStatus, ReportGroupBy } from '@/types'

const ALL = 'all'

// Order.tsx and Orders.tsx use an identical filter shape — they share one
// slice so setting a filter on either page is reflected on the other.
type OrderSortField = 'order_name' | 'customer_name' | 'deadline'
type SortDirection = 'asc' | 'desc'
type TaskSortField = 'divisi' | 'description' | 'progress' | 'assigned_to_name' | 'status'

interface OrderFilterState {
  customerFilter: string
  statusFilter: OrderStatus[]
  jenisCategoryFilter: string
  search: string
  sortField: OrderSortField
  sortDir: SortDirection
}

interface PayrollFilterState {
  viewMode: 'month' | 'range'
  employeeId: string
  divisiFilter: string
  paymentStatusFilter: string
  search: string
}

interface ArticlesFilterState {
  divisiFilter: string
  search: string
}

interface WorkLogsFilterState {
  employeeId: string
  customerId: string
  articleId: string
  divisiFilter: string
}

interface KasbonFilterState {
  search: string
  statusFilter: CashAdvanceStatus | typeof ALL
  divisiFilter: string
}

interface AttendanceFilterState {
  employeeId: string
}

interface ReportsFilterState {
  groupBy: ReportGroupBy
  divisiFilter: Divisi | typeof ALL
}

interface SuratJalanFilterState {
  customerFilter: string
}

interface TaskDetailFilterState {
  sortField: TaskSortField
  sortDir: SortDirection
}

interface FilterStore {
  order: OrderFilterState
  setOrder: (patch: Partial<OrderFilterState>) => void
  resetOrder: () => void

  payroll: PayrollFilterState
  setPayroll: (patch: Partial<PayrollFilterState>) => void

  articles: ArticlesFilterState
  setArticles: (patch: Partial<ArticlesFilterState>) => void

  workLogs: WorkLogsFilterState
  setWorkLogs: (patch: Partial<WorkLogsFilterState>) => void

  kasbon: KasbonFilterState
  setKasbon: (patch: Partial<KasbonFilterState>) => void

  attendance: AttendanceFilterState
  setAttendance: (patch: Partial<AttendanceFilterState>) => void

  reports: ReportsFilterState
  setReports: (patch: Partial<ReportsFilterState>) => void

  suratJalan: SuratJalanFilterState
  setSuratJalan: (patch: Partial<SuratJalanFilterState>) => void

  taskDetail: TaskDetailFilterState
  setTaskDetail: (patch: Partial<TaskDetailFilterState>) => void
}

const ORDER_STATUSES: OrderStatus[] = [
  'Belum Di Proses',
  'Desain Fix',
  'On Progress',
  'Done',
  'Dikirim',
  'Di Ambil Costumer',
]
const DEFAULT_ORDER_STATUS_FILTER = ORDER_STATUSES.filter((s) => s !== 'Done')

const defaultOrderState: OrderFilterState = {
  customerFilter: ALL,
  statusFilter: DEFAULT_ORDER_STATUS_FILTER,
  jenisCategoryFilter: ALL,
  search: '',
  sortField: 'deadline',
  sortDir: 'asc',
}

// Persisted via localStorage (same mechanism this app already uses for the
// auth token/user — see hooks/useAuth.tsx) so filters survive navigating
// between pages and full page reloads alike. Date/month/year fields are
// deliberately excluded from every slice below — persisting a value that
// defaulted to "today" would otherwise silently show a stale date next time
// the page is opened, so those always reset to "now" per page load.
export const useFilterStore = create<FilterStore>()(
  persist(
    (set) => ({
      order: defaultOrderState,
      setOrder: (patch) => set((state) => ({ order: { ...state.order, ...patch } })),
      resetOrder: () => set({ order: defaultOrderState }),

      payroll: {
        viewMode: 'month',
        employeeId: ALL,
        divisiFilter: ALL,
        paymentStatusFilter: ALL,
        search: '',
      },
      setPayroll: (patch) => set((state) => ({ payroll: { ...state.payroll, ...patch } })),

      articles: { divisiFilter: ALL, search: '' },
      setArticles: (patch) => set((state) => ({ articles: { ...state.articles, ...patch } })),

      workLogs: { employeeId: ALL, customerId: ALL, articleId: ALL, divisiFilter: ALL },
      setWorkLogs: (patch) => set((state) => ({ workLogs: { ...state.workLogs, ...patch } })),

      kasbon: { search: '', statusFilter: ALL, divisiFilter: ALL },
      setKasbon: (patch) => set((state) => ({ kasbon: { ...state.kasbon, ...patch } })),

      attendance: { employeeId: ALL },
      setAttendance: (patch) => set((state) => ({ attendance: { ...state.attendance, ...patch } })),

      reports: { groupBy: 'monthly', divisiFilter: ALL },
      setReports: (patch) => set((state) => ({ reports: { ...state.reports, ...patch } })),

      suratJalan: { customerFilter: ALL },
      setSuratJalan: (patch) => set((state) => ({ suratJalan: { ...state.suratJalan, ...patch } })),

      taskDetail: { sortField: 'status', sortDir: 'asc' },
      setTaskDetail: (patch) => set((state) => ({ taskDetail: { ...state.taskDetail, ...patch } })),
    }),
    { name: 'admin-filter-store' }
  )
)
