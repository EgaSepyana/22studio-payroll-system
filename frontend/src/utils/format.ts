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
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr))
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
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

export const WORK_STATUS_OPTIONS: { value: WorkStatus; label: string }[] = [
  { value: 'on_progress', label: 'On Progress' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'belum_selesai', label: 'Belum Selesai' },
]

export function workStatusLabel(status: string): string {
  return WORK_STATUS_OPTIONS.find((o) => o.value === status)?.label || 'Selesai'
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
