import { api } from './api'
import type { ApiResponse, Customer, CustomerCategory } from '@/types'

export interface CustomerInput {
  name: string
  pic?: string
  alamat?: string
  no_hp?: string
  category?: CustomerCategory
}

export async function listCustomers() {
  const res = await api.get<ApiResponse<Customer[]>>('/customers')
  return res.data.data
}

export async function createCustomer(data: CustomerInput) {
  const res = await api.post<ApiResponse<Customer>>('/customers', data)
  return res.data.data
}

export async function updateCustomer(id: string, data: Partial<CustomerInput>) {
  const res = await api.put<ApiResponse<Customer>>(`/customers/${id}`, data)
  return res.data.data
}

export async function deleteCustomer(id: string) {
  await api.delete(`/customers/${id}`)
}

export async function setCustomerCategories(id: string, categoryIds: string[]) {
  const res = await api.put<ApiResponse<{ customer_id: string; category_ids: string[] }>>(
    `/customers/${id}/categories`,
    { category_ids: categoryIds }
  )
  return res.data.data
}
