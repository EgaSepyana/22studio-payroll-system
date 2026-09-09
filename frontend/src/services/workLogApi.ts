import { api } from './api'
import type { ApiResponse, Divisi, WorkLog, WorkStatus } from '@/types'

export interface WorkLogInput {
  task_id: string
  article_id: string
  work_date: string
  quantity: number
  notes?: string
  employee_id?: string
  status?: WorkStatus
  // Required only for Cutting division tasks — see workLogService.createWorkLog.
  laporan_pengerjaan_foto?: string
  // Cutting-only audit checkboxes, optional at creation, editable later.
  acc_owner?: boolean
  is_jumlah_size_sesuai?: boolean
  is_size_tertempel?: boolean
}

export interface WorkLogFilters {
  task_id?: string
  employee_id?: string
  customer_id?: string
  article_id?: string
  date_from?: string
  date_to?: string
  divisi?: Divisi
  status?: WorkStatus
}

// Single-item fetch — used by the notification click-through to load a
// specific WorkLog that may not be on the current filtered/paginated list.
export async function getWorkLog(id: string) {
  const res = await api.get<ApiResponse<WorkLog>>(`/worklogs/${id}`)
  return res.data.data
}

export async function createWorkLog(data: WorkLogInput) {
  const res = await api.post<ApiResponse<WorkLog>>('/worklogs', data)
  return res.data.data
}

export async function updateWorkLog(id: string, data: Partial<WorkLogInput>) {
  const res = await api.put<ApiResponse<WorkLog>>(`/worklogs/${id}`, data)
  return res.data.data
}

export async function deleteWorkLog(id: string) {
  await api.delete(`/worklogs/${id}`)
}

export async function listAllWorkLogs(filters: WorkLogFilters = {}) {
  const res = await api.get<ApiResponse<WorkLog[]>>('/worklogs', { params: filters })
  return res.data.data
}

export async function listMyWorkLogs(filters: WorkLogFilters = {}) {
  const res = await api.get<ApiResponse<WorkLog[]>>('/worklogs/mine', { params: filters })
  return res.data.data
}

export async function exportWorkLogs(filters: WorkLogFilters, format: 'pdf' | 'excel') {
  const res = await api.get('/worklogs/export', {
    params: { ...filters, format },
    responseType: 'blob',
  })
  const blob = new Blob([res.data])
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `slip-gaji.${format === 'excel' ? 'xlsx' : 'pdf'}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
