import { api } from './api'
import type { ApiResponse, AppNotification } from '@/types'

export async function listNotifications(unreadOnly = false) {
  const res = await api.get<ApiResponse<AppNotification[]>>('/notifications', {
    params: unreadOnly ? { unread_only: 'true' } : undefined,
  })
  return res.data.data
}

export async function getUnreadCount() {
  const res = await api.get<ApiResponse<{ count: number }>>('/notifications/unread-count')
  return res.data.data.count
}

export async function markAsRead(id: string) {
  const res = await api.post<ApiResponse<AppNotification>>(`/notifications/${id}/read`)
  return res.data.data
}

export async function markAllAsRead() {
  const res = await api.post<ApiResponse<{ updated: number }>>('/notifications/read-all')
  return res.data.data
}
