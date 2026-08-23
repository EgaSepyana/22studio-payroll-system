import { api } from './api'
import type { ApiResponse, OwnerIncome } from '@/types'

export interface OwnerIncomeFilters {
  category_id?: string
  month?: string
  account_id?: string
}

export interface OwnerIncomeInput {
  date: string
  category_id: string
  account_id: string
  amount: number
  description?: string
}

export async function listIncome(filters: OwnerIncomeFilters = {}) {
  const res = await api.get<ApiResponse<OwnerIncome[]>>('/owner/income', { params: filters })
  return res.data.data
}

export async function createIncome(data: OwnerIncomeInput) {
  const res = await api.post<ApiResponse<OwnerIncome>>('/owner/income', data)
  return res.data.data
}

export async function deleteIncome(id: string) {
  await api.delete(`/owner/income/${id}`)
}
