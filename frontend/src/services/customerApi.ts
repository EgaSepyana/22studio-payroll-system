import { api } from './api'
import type { ApiResponse, Customer } from '@/types'

export async function listCustomers() {
  const res = await api.get<ApiResponse<Customer[]>>('/customers')
  return res.data.data
}

export async function createCustomer(name: string) {
  const res = await api.post<ApiResponse<Customer>>('/customers', { name })
  return res.data.data
}

export async function updateCustomer(id: string, name: string) {
  const res = await api.put<ApiResponse<Customer>>(`/customers/${id}`, { name })
  return res.data.data
}

export async function deleteCustomer(id: string) {
  await api.delete(`/customers/${id}`)
}
