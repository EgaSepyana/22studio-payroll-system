import { api } from './api'
import type { ApiResponse, CashAdvance, CashAdvanceStatus, Divisi } from '@/types'

export interface CashAdvanceInput {
  amount: number
  reason?: string
}

export interface CashAdvanceFilters {
  employee_id?: string
  status?: CashAdvanceStatus
  date_from?: string
  date_to?: string
  divisi?: Divisi
}

export async function createCashAdvance(data: CashAdvanceInput) {
  const res = await api.post<ApiResponse<CashAdvance>>('/cashadvances', data)
  return res.data.data
}

export async function listCashAdvances(filters: CashAdvanceFilters = {}) {
  const res = await api.get<ApiResponse<CashAdvance[]>>('/cashadvances', { params: filters })
  return res.data.data
}

export async function listMyCashAdvances(filters: CashAdvanceFilters = {}) {
  const res = await api.get<ApiResponse<CashAdvance[]>>('/cashadvances/mine', { params: filters })
  return res.data.data
}

export async function getCashAdvanceDetail(id: string) {
  const res = await api.get<ApiResponse<CashAdvance>>(`/cashadvances/${id}`)
  return res.data.data
}

export async function approveCashAdvance(id: string) {
  const res = await api.patch<ApiResponse<CashAdvance>>(`/cashadvances/${id}/approve`)
  return res.data.data
}

export async function rejectCashAdvance(id: string) {
  const res = await api.patch<ApiResponse<CashAdvance>>(`/cashadvances/${id}/reject`)
  return res.data.data
}
