import { api } from './api'
import type { ApiResponse, OwnerLiability, OwnerLiabilityDetail, OwnerLiabilityPayment, OwnerLiabilityStatus } from '@/types'

export interface OwnerLiabilityFilters {
  search?: string
  category_id?: string
  status?: OwnerLiabilityStatus
}

export interface OwnerLiabilityInput {
  date: string
  due_date?: string
  creditor_name: string
  creditor_address?: string
  category_id: string
  qty: number
  unit_price: number
  description?: string
}

export interface OwnerLiabilityPaymentInput {
  date: string
  amount: number
  account_id: string
  description?: string
}

export async function listLiabilities(filters: OwnerLiabilityFilters = {}) {
  const res = await api.get<ApiResponse<OwnerLiability[]>>('/owner/liabilities', { params: filters })
  return res.data.data
}

export async function getLiabilityDetail(id: string) {
  const res = await api.get<ApiResponse<OwnerLiabilityDetail>>(`/owner/liabilities/${id}`)
  return res.data.data
}

export async function createLiability(data: OwnerLiabilityInput) {
  const res = await api.post<ApiResponse<OwnerLiability>>('/owner/liabilities', data)
  return res.data.data
}

export async function updateLiability(id: string, data: Partial<OwnerLiabilityInput>) {
  const res = await api.put<ApiResponse<OwnerLiability>>(`/owner/liabilities/${id}`, data)
  return res.data.data
}

export async function deleteLiability(id: string) {
  await api.delete(`/owner/liabilities/${id}`)
}

export async function createPayment(liabilityId: string, data: OwnerLiabilityPaymentInput) {
  const res = await api.post<ApiResponse<OwnerLiabilityPayment>>(`/owner/liabilities/${liabilityId}/payments`, data)
  return res.data.data
}

export async function deletePayment(liabilityId: string, paymentId: string) {
  await api.delete(`/owner/liabilities/${liabilityId}/payments/${paymentId}`)
}
