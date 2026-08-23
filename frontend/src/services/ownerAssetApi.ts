import { api } from './api'
import type { ApiResponse, OwnerFixedAsset, OwnerFixedAssetDetail, OwnerFundingInput } from '@/types'

export interface OwnerAssetFilters {
  search?: string
  category_id?: string
  location_id?: string
  sort?: 'name' | 'qty_asc' | 'qty_desc'
}

export interface OwnerAssetRegisterInput {
  date: string
  name: string
  category_id: string
  location_id: string
  description?: string
}

export interface OwnerAssetBuyInput extends OwnerFundingInput {
  asset_id: string
  date: string
  qty: number
  unit_price: number
}

export interface OwnerAssetSellInput {
  asset_id: string
  date: string
  qty: number
  sale_price?: number
  account_id: string
}

export async function listAssets(filters: OwnerAssetFilters = {}) {
  const res = await api.get<ApiResponse<OwnerFixedAsset[]>>('/owner/assets', { params: filters })
  return res.data.data
}

export async function getAssetDetail(id: string) {
  const res = await api.get<ApiResponse<OwnerFixedAssetDetail>>(`/owner/assets/${id}`)
  return res.data.data
}

export async function registerAsset(data: OwnerAssetRegisterInput) {
  const res = await api.post<ApiResponse<OwnerFixedAssetDetail>>('/owner/assets', data)
  return res.data.data
}

export async function buyAsset(data: OwnerAssetBuyInput) {
  const res = await api.post<ApiResponse<OwnerFixedAssetDetail>>('/owner/assets/buy', data)
  return res.data.data
}

export async function sellAsset(data: OwnerAssetSellInput) {
  const res = await api.post<ApiResponse<OwnerFixedAssetDetail>>('/owner/assets/sell', data)
  return res.data.data
}

export async function deleteAsset(id: string) {
  await api.delete(`/owner/assets/${id}`)
}
