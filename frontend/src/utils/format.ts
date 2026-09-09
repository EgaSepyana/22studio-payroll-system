import type { WorkStatus, CashAdvanceStatus } from '@/types'

export function formatCurrency(value: number): string {
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0)
  // Join "Rp" to the number with a non-breaking space so narrow containers
  // never wrap between the currency symbol and its digits.
  return formatted.replace(/\s/g, ' ')
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatTime(dateStr: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(date)
}

// Short relative-time label (e.g. "5 menit lalu") for notification feeds,
// where an exact timestamp is less useful than "how recent is this". Falls
// back to formatDate once it's more than a day old — a notification from
// last week doesn't need to say "10080 menit lalu".
export function timeAgo(dateStr: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return '-'
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'Baru saja'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  return formatDate(dateStr)
}

export const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// pending_audit is deliberately excluded — it's system-derived only (see
// WorkStatus in types/index.ts), never a status the create/edit form lets
// anyone pick directly.
export const WORK_STATUS_OPTIONS: { value: WorkStatus; label: string }[] = [
  { value: 'on_progress', label: 'On Progress' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'belum_selesai', label: 'Belum Selesai' },
]

export function workStatusLabel(status: string): string {
  if (status === 'pending_audit') return 'Menunggu Audit'
  return WORK_STATUS_OPTIONS.find((o) => o.value === status)?.label || 'Selesai'
}

// The create/edit form's status dropdown can only ever show/hold one of the
// 3 real options — 'pending_audit' is system-derived and never selectable
// (see WORK_STATUS_OPTIONS above). For a Cutting log currently showing
// 'pending_audit', original_status is what the employee/admin actually
// intends and what the dropdown should populate with instead.
export function editableWorkStatus(log: {
  status: WorkStatus
  original_status?: WorkStatus
}): 'on_progress' | 'selesai' | 'belum_selesai' {
  const candidate = log.original_status || log.status
  return candidate === 'pending_audit' ? 'selesai' : candidate
}

export const CASH_ADVANCE_STATUS_OPTIONS: { value: CashAdvanceStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paid', label: 'Paid' },
]

export function cashAdvanceStatusLabel(status: string): string {
  return CASH_ADVANCE_STATUS_OPTIONS.find((o) => o.value === status)?.label || 'Pending'
}
