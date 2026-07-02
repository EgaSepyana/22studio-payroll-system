import { api } from './api'
import type { ApiResponse, Divisi, Report, ReportGroupBy } from '@/types'

export interface ReportFilters {
  groupBy: ReportGroupBy
  date_from?: string
  date_to?: string
  employee_id?: string
  customer_id?: string
  article_id?: string
  divisi?: Divisi
}

export async function buildReport(filters: ReportFilters) {
  const res = await api.get<ApiResponse<Report>>('/reports', { params: filters })
  return res.data.data
}

export async function exportReport(filters: ReportFilters, format: 'pdf' | 'excel') {
  const res = await api.get('/reports/export', {
    params: { ...filters, format },
    responseType: 'blob',
  })
  const blob = new Blob([res.data])
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `laporan-${filters.groupBy}.${format === 'excel' ? 'xlsx' : 'pdf'}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
