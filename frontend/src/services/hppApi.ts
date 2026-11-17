import { api } from './api'
import type {
  ApiResponse,
  HppCalculation,
  HppCalculationSummary,
  HppCalculationTab,
  HppFabric,
  HppThread,
} from '@/types'

export interface HppFabricInput {
  name: string
  color: string
  supplier: string
  price: number
  gsm: number
  date: string
  note: string
}

export interface HppThreadInput {
  brand: string
  code: string
  name: string
  hex: string
  price: number
  yield: number
  note: string
}

export interface HppCalculationInput {
  tab: HppCalculationTab
  name: string
  qty: number
  hpp: number
  total: number
  sale: number
  data: unknown
}

export async function listFabrics() {
  const res = await api.get<ApiResponse<HppFabric[]>>('/hpp/fabrics')
  return res.data.data
}

export async function createFabric(data: HppFabricInput) {
  const res = await api.post<ApiResponse<HppFabric>>('/hpp/fabrics', data)
  return res.data.data
}

export async function updateFabric(id: string, data: HppFabricInput) {
  const res = await api.put<ApiResponse<HppFabric>>(`/hpp/fabrics/${id}`, data)
  return res.data.data
}

export async function removeFabric(id: string) {
  await api.delete(`/hpp/fabrics/${id}`)
}

export async function listThreads() {
  const res = await api.get<ApiResponse<HppThread[]>>('/hpp/threads')
  return res.data.data
}

export async function createThread(data: HppThreadInput) {
  const res = await api.post<ApiResponse<HppThread>>('/hpp/threads', data)
  return res.data.data
}

export async function updateThread(id: string, data: HppThreadInput) {
  const res = await api.put<ApiResponse<HppThread>>(`/hpp/threads/${id}`, data)
  return res.data.data
}

export async function removeThread(id: string) {
  await api.delete(`/hpp/threads/${id}`)
}

export async function listCalculations() {
  const res = await api.get<ApiResponse<HppCalculationSummary[]>>('/hpp/calculations')
  return res.data.data
}

export async function getCalculation(id: string) {
  const res = await api.get<ApiResponse<HppCalculation>>(`/hpp/calculations/${id}`)
  return res.data.data
}

export async function saveCalculation(data: HppCalculationInput) {
  const res = await api.post<ApiResponse<HppCalculationSummary>>('/hpp/calculations', data)
  return res.data.data
}

export async function removeCalculation(id: string) {
  await api.delete(`/hpp/calculations/${id}`)
}
