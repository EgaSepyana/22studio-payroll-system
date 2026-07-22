import { api } from './api'
import type { ApiResponse, WATemplate } from '@/types'

export async function getBankAccount() {
  const res = await api.get<ApiResponse<{ value: string }>>('/settings/bank-account')
  return res.data.data.value
}

export async function updateBankAccount(value: string) {
  const res = await api.put<ApiResponse<{ value: string }>>('/settings/bank-account', { value })
  return res.data.data.value
}

export async function listWATemplates() {
  const res = await api.get<ApiResponse<WATemplate[]>>('/settings/wa-templates')
  return res.data.data
}

export async function updateWATemplate(templateKey: string, data: { label?: string; content?: string }) {
  const res = await api.put<ApiResponse<WATemplate>>(`/settings/wa-templates/${templateKey}`, data)
  return res.data.data
}
