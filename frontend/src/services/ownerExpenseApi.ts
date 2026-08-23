import { api } from './api'
import type { ApiResponse, OwnerExpense, OwnerExpensePickerOrder, OwnerOrderProfitability } from '@/types'

export interface OwnerExpenseFilters {
  category_id?: string
  order_search?: string
  account_id?: string
}

export interface OwnerExpenseInput {
  date: string
  category_id: string
  account_id: string
  order_id?: string
  amount: number
  description?: string
}

export async function listExpenses(filters: OwnerExpenseFilters = {}) {
  const res = await api.get<ApiResponse<OwnerExpense[]>>('/owner/expenses', { params: filters })
  return res.data.data
}

export async function listOrderPicker(search?: string) {
  const res = await api.get<ApiResponse<OwnerExpensePickerOrder[]>>('/owner/expenses/order-picker', {
    params: { search },
  })
  return res.data.data
}

export async function getOrderProfitability(orderId: string) {
  const res = await api.get<ApiResponse<OwnerOrderProfitability>>(`/owner/expenses/order-profitability/${orderId}`)
  return res.data.data
}

export async function createExpense(data: OwnerExpenseInput) {
  const res = await api.post<ApiResponse<OwnerExpense>>('/owner/expenses', data)
  return res.data.data
}

export async function deleteExpense(id: string) {
  await api.delete(`/owner/expenses/${id}`)
}
