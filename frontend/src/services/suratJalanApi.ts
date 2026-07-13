import { api } from './api'
import type { ApiResponse, SuratJalan, SuratJalanDetail, SuratJalanItem } from '@/types'

export interface SuratJalanInput {
  customer_id: string
  penerima_nama?: string
  penerima_telepon?: string
  penerima_alamat?: string
}

export interface SuratJalanFilters {
  customer_id?: string
  date_from?: string
  date_to?: string
}

export interface SuratJalanItemInput {
  nama_item: string
  harga: number
  qty: number
}

export async function createSuratJalan(data: SuratJalanInput) {
  const res = await api.post<ApiResponse<SuratJalan>>('/surat-jalan', data)
  return res.data.data
}

export async function listSuratJalan(filters: SuratJalanFilters = {}) {
  const res = await api.get<ApiResponse<SuratJalan[]>>('/surat-jalan', { params: filters })
  return res.data.data
}

export async function getSuratJalanDetail(id: string) {
  const res = await api.get<ApiResponse<SuratJalanDetail>>(`/surat-jalan/${id}`)
  return res.data.data
}

export async function updateSuratJalan(id: string, data: Partial<SuratJalanInput>) {
  const res = await api.put<ApiResponse<SuratJalan>>(`/surat-jalan/${id}`, data)
  return res.data.data
}

export async function deleteSuratJalan(id: string) {
  await api.delete(`/surat-jalan/${id}`)
}

export async function addSuratJalanItem(suratJalanId: string, data: SuratJalanItemInput) {
  const res = await api.post<ApiResponse<SuratJalanItem>>(`/surat-jalan/${suratJalanId}/items`, data)
  return res.data.data
}

export async function updateSuratJalanItem(suratJalanId: string, itemId: string, data: Partial<SuratJalanItemInput>) {
  const res = await api.put<ApiResponse<SuratJalanItem>>(`/surat-jalan/${suratJalanId}/items/${itemId}`, data)
  return res.data.data
}

export async function deleteSuratJalanItem(suratJalanId: string, itemId: string) {
  await api.delete(`/surat-jalan/${suratJalanId}/items/${itemId}`)
}

export async function downloadSuratJalanPdf(id: string, noDocument: string) {
  const res = await api.get(`/surat-jalan/${id}/pdf`, { responseType: 'blob' })
  const blob = new Blob([res.data], { type: 'application/pdf' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${noDocument}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function printSuratJalan(id: string) {
  const res = await api.get(`/surat-jalan/${id}/pdf`, { responseType: 'blob' })
  const blob = new Blob([res.data], { type: 'application/pdf' })
  const url = window.URL.createObjectURL(blob)
  window.open(url, '_blank')
}
