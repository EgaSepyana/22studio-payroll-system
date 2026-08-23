import { api } from './api'
import type { ApiResponse, OwnerDashboard } from '@/types'

export async function getDashboard() {
  const res = await api.get<ApiResponse<OwnerDashboard>>('/owner/dashboard')
  return res.data.data
}
