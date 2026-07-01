import { api } from './api'
import type { ApiResponse, Employee } from '@/types'

export interface EmployeeInput {
  name: string
  phone: string
  status?: 'active' | 'inactive'
  username: string
  password?: string
}

export async function listEmployees() {
  const res = await api.get<ApiResponse<Employee[]>>('/employees')
  return res.data.data
}

export async function createEmployee(data: EmployeeInput) {
  const res = await api.post<ApiResponse<Employee>>('/employees', data)
  return res.data.data
}

export async function updateEmployee(id: string, data: Partial<EmployeeInput>) {
  const res = await api.put<ApiResponse<Employee>>(`/employees/${id}`, data)
  return res.data.data
}

export async function deleteEmployee(id: string) {
  await api.delete(`/employees/${id}`)
}
