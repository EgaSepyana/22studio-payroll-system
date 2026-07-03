import { api } from './api'
import type { ApiResponse, Divisi, WorkLog, WorkStatus } from '@/types'

export interface WorkLogInput {
  customer_id: string
  article_id: string
  work_date: string
  quantity: number
  notes?: string
  employee_id?: string
  status?: WorkStatus
}

export interface WorkLogFilters {
  employee_id?: string
  customer_id?: string
  article_id?: string
  date_from?: string
  date_to?: string
  divisi?: Divisi
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
