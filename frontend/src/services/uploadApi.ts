import { api } from './api'
import type { ApiResponse } from '@/types'

export async function uploadDesignImage(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post<ApiResponse<{ url: string }>>('/uploads/design', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data.url
}
