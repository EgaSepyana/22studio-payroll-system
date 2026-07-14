import { api } from './api'
import type { ApiResponse, LembarPO } from '@/types'

export interface LembarPOInput {
  order_id: string
  sablon_bordir?: string
  catatan?: string
  label?: boolean
  bahan_tipe?: string
  pola_potong?: string
  hangtag?: boolean
}

export async function listLembarPO() {
  const res = await api.get<ApiResponse<LembarPO[]>>('/lembar-po')
  return res.data.data
}

export async function getLembarPODetail(id: string) {
  const res = await api.get<ApiResponse<LembarPO>>(`/lembar-po/${id}`)
  return res.data.data
}

export async function createLembarPO(data: LembarPOInput) {
  const res = await api.post<ApiResponse<LembarPO>>('/lembar-po', data)
  return res.data.data
}

export async function updateLembarPO(id: string, data: Partial<LembarPOInput>) {
  const res = await api.put<ApiResponse<LembarPO>>(`/lembar-po/${id}`, data)
  return res.data.data
}

export async function deleteLembarPO(id: string) {
  await api.delete(`/lembar-po/${id}`)
}

export async function printLembarPO(id: string) {
  const res = await api.get(`/lembar-po/${id}/pdf`, { responseType: 'blob' })
  const blob = new Blob([res.data], { type: 'application/pdf' })
  const url = window.URL.createObjectURL(blob)
  window.open(url, '_blank')
}

export async function downloadLembarPOPdf(id: string, orderName: string) {
  const res = await api.get(`/lembar-po/${id}/pdf`, { responseType: 'blob' })
  const blob = new Blob([res.data], { type: 'application/pdf' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `Lembar PO - ${orderName}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
