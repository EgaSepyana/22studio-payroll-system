import { api } from './api'
import type {
  ApiResponse,
  OwnerCategory,
  OwnerCategoryType,
  OwnerCogsBucket,
  OwnerLocation,
  OwnerBusinessSettings,
} from '@/types'

export interface OwnerCategoryInput {
  type: OwnerCategoryType
  name: string
  is_sales_category?: boolean
  cogs_bucket?: OwnerCogsBucket
}

export interface OwnerCategoryUpdateInput {
  name?: string
  is_active?: boolean
  is_sales_category?: boolean
  cogs_bucket?: OwnerCogsBucket
}

export async function listCategories(type?: OwnerCategoryType) {
  const res = await api.get<ApiResponse<OwnerCategory[]>>('/owner/settings/categories', { params: { type } })
  return res.data.data
}

export async function createCategory(data: OwnerCategoryInput) {
  const res = await api.post<ApiResponse<OwnerCategory>>('/owner/settings/categories', data)
  return res.data.data
}

export async function updateCategory(id: string, data: OwnerCategoryUpdateInput) {
  const res = await api.put<ApiResponse<OwnerCategory>>(`/owner/settings/categories/${id}`, data)
  return res.data.data
}

export async function deleteCategory(id: string) {
  await api.delete(`/owner/settings/categories/${id}`)
}

export interface OwnerLocationInput {
  name: string
}

export interface OwnerLocationUpdateInput {
  name?: string
  is_active?: boolean
}

export async function listLocations() {
  const res = await api.get<ApiResponse<OwnerLocation[]>>('/owner/settings/locations')
  return res.data.data
}

export async function createLocation(data: OwnerLocationInput) {
  const res = await api.post<ApiResponse<OwnerLocation>>('/owner/settings/locations', data)
  return res.data.data
}

export async function updateLocation(id: string, data: OwnerLocationUpdateInput) {
  const res = await api.put<ApiResponse<OwnerLocation>>(`/owner/settings/locations/${id}`, data)
  return res.data.data
}

export async function deleteLocation(id: string) {
  await api.delete(`/owner/settings/locations/${id}`)
}

export async function getBusinessSettings() {
  const res = await api.get<ApiResponse<OwnerBusinessSettings>>('/owner/settings/business')
  return res.data.data
}

export async function updateBusinessSettings(data: Partial<OwnerBusinessSettings>) {
  const res = await api.put<ApiResponse<OwnerBusinessSettings>>('/owner/settings/business', data)
  return res.data.data
}
