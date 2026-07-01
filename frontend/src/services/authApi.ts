import { api } from './api'
import type { ApiResponse, AuthUser } from '@/types'

export async function login(username: string, password: string) {
  const res = await api.post<ApiResponse<{ token: string; user: AuthUser }>>('/auth/login', {
    username,
    password,
  })
  return res.data.data
}

export async function logout() {
  await api.post('/auth/logout')
}

export async function changePassword(oldPassword: string, newPassword: string) {
  const res = await api.put<ApiResponse<{ message: string }>>('/auth/change-password', {
    oldPassword,
    newPassword,
  })
  return res.data.data
}
