import { api } from './api'
import type { ApiResponse } from '@/types'

export interface Profile {
  username: string
  role: string
  name?: string
  phone?: string
}

export async function getProfile() {
  const res = await api.get<ApiResponse<Profile>>('/profile')
  return res.data.data
}

export async function updateProfile(phone: string) {
  const res = await api.put<ApiResponse<{ name: string; phone: string }>>('/profile', { phone })
  return res.data.data
}
