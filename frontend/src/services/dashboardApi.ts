import { api } from './api'
import type { AdminDashboard, ApiResponse, EmployeeDashboard } from '@/types'

export async function getAdminDashboard() {
  const res = await api.get<ApiResponse<AdminDashboard>>('/dashboard/admin')
  return res.data.data
}

export async function getEmployeeDashboard() {
  const res = await api.get<ApiResponse<EmployeeDashboard>>('/dashboard/employee')
  return res.data.data
}
