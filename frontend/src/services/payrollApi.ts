import { api } from './api'
import type { ApiResponse, Divisi, PayrollDetail, PayrollRow } from '@/types'

export interface PayrollExportFilters {
  id?: string
  month?: number
  year?: number
  date_from?: string
  date_to?: string
  employee_id?: string
  divisi?: Divisi
}

export interface PayrollRangeFilters {
  date_from: string
  date_to: string
  employee_id?: string
  divisi?: Divisi
}

export interface MarkRangePaidInput extends PayrollRangeFilters {
  account_id: string
}

export async function listPayroll(month: number, year: number, employeeId?: string, divisi?: Divisi) {
  const res = await api.get<ApiResponse<PayrollRow[]>>('/payroll', {
    params: { month, year, employee_id: employeeId, divisi },
  })
  return res.data.data
}

// Every division's pay is daily now — this powers the Payroll page's
// date-range view, an alternative to listPayroll above for browsing/paying
// across an arbitrary span instead of one calendar month.
export async function listPayrollRange(filters: PayrollRangeFilters) {
  const res = await api.get<ApiResponse<PayrollRow[]>>('/payroll/range', { params: filters })
  return res.data.data
}

export async function markRangePaid(filters: MarkRangePaidInput) {
  const res = await api.patch<ApiResponse<PayrollRow[]>>('/payroll/range/pay', filters)
  return res.data.data
}

export async function exportPayroll(filters: PayrollExportFilters, format: 'pdf' | 'excel') {
  const res = await api.get('/payroll/export', {
    params: { ...filters, format },
    responseType: 'blob',
  })
  const blob = new Blob([res.data])
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `slip-gaji-payroll.${format === 'excel' ? 'xlsx' : 'pdf'}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function printPayroll(filters: PayrollExportFilters) {
  const res = await api.get('/payroll/export', {
    params: { ...filters, format: 'pdf' },
    responseType: 'blob',
  })
  const blob = new Blob([res.data], { type: 'application/pdf' })
  const url = window.URL.createObjectURL(blob)
  window.open(url, '_blank')
}

export async function getPayrollDetail(id: string) {
  const res = await api.get<ApiResponse<PayrollDetail>>(`/payroll/${id}`)
  return res.data.data
}

export async function markPayrollPaid(id: string, accountId: string, kasbonDeduction?: number) {
  const res = await api.patch<ApiResponse<PayrollRow>>(`/payroll/${id}/pay`, {
    account_id: accountId,
    ...(kasbonDeduction !== undefined ? { kasbon_deduction: kasbonDeduction } : {}),
  })
  return res.data.data
}

export async function listMyPayrollHistory() {
  const res = await api.get<ApiResponse<PayrollRow[]>>('/payroll/mine')
  return res.data.data
}
