import { api } from './api'
import type { ApiResponse, WorkLog } from '@/types'

export interface WorkLogInput {
  customer_id: string
  article_id: string
  work_date: string
  quantity: number
  notes?: string
  employee_id?: string
}

export interface WorkLogFilters {
  employee_id?: string
  customer_id?: string
  article_id?: string
  date_from?: string
  date_to?: string
}

export async function createWorkLog(data: WorkLogInput) {
  const res = await api.post<ApiResponse<WorkLog>>('/worklogs', data)
  return res.data.data
}

export async function updateWorkLog(id: string, data: Partial<WorkLogInput>) {
  const res = await api.put<ApiResponse<WorkLog>>(`/worklogs/${id}`, data)
  return res.data.data
}

export async function listAllWorkLogs(filters: WorkLogFilters = {}) {
  const res = await api.get<ApiResponse<WorkLog[]>>('/worklogs', { params: filters })
  return res.data.data
}

export async function listMyWorkLogs(filters: WorkLogFilters = {}) {
  const res = await api.get<ApiResponse<WorkLog[]>>('/worklogs/mine', { params: filters })
  return res.data.data
}
