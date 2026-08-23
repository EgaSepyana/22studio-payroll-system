import { api } from './api'
import type {
  ApiResponse,
  OwnerFundingInput,
  OwnerInventoryExitType,
  OwnerInventoryItem,
  OwnerInventoryItemDetail,
  OwnerInventoryItemType,
  OwnerInventorySaleMethod,
} from '@/types'

export interface OwnerInventoryFilters {
  search?: string
  category_id?: string
  location_id?: string
  item_type?: OwnerInventoryItemType
  sort?: 'name' | 'qty_asc' | 'qty_desc'
}

export interface OwnerInventoryRegisterInput extends OwnerFundingInput {
  date: string
  name: string
  category_id: string
  location_id: string
  item_type: OwnerInventoryItemType
  qty: number
  unit_price: number
  description?: string
}

export interface OwnerInventoryUpdateInput {
  name?: string
  category_id?: string
  location_id?: string
  description?: string
}

export interface OwnerInventoryStockInInput extends OwnerFundingInput {
  item_id: string
  date: string
  qty: number
  unit_price?: number
}

export interface OwnerInventoryStockOutInput {
  item_id: string
  date: string
  qty: number
  exit_type: OwnerInventoryExitType
  description?: string
  output_code?: string
  output_name?: string
  output_category_id?: string
  output_location_id?: string
  sale_price?: number
  sale_method?: OwnerInventorySaleMethod
  account_id?: string
  loss_value?: number
}

export interface OwnerInventoryStockOutResult {
  source: OwnerInventoryItemDetail
  output?: OwnerInventoryItemDetail
}

export async function listItems(filters: OwnerInventoryFilters = {}) {
  const res = await api.get<ApiResponse<OwnerInventoryItem[]>>('/owner/inventory', { params: filters })
  return res.data.data
}

export async function getItemDetail(id: string) {
  const res = await api.get<ApiResponse<OwnerInventoryItemDetail>>(`/owner/inventory/${id}`)
  return res.data.data
}

export async function registerItem(data: OwnerInventoryRegisterInput) {
  const res = await api.post<ApiResponse<OwnerInventoryItemDetail>>('/owner/inventory', data)
  return res.data.data
}

export async function updateItem(id: string, data: OwnerInventoryUpdateInput) {
  const res = await api.put<ApiResponse<OwnerInventoryItemDetail>>(`/owner/inventory/${id}`, data)
  return res.data.data
}

export async function stockIn(data: OwnerInventoryStockInInput) {
  const res = await api.post<ApiResponse<OwnerInventoryItemDetail>>('/owner/inventory/stock-in', data)
  return res.data.data
}

export async function stockOut(data: OwnerInventoryStockOutInput) {
  const res = await api.post<ApiResponse<OwnerInventoryStockOutResult>>('/owner/inventory/stock-out', data)
  return res.data.data
}

export async function deleteItem(id: string) {
  await api.delete(`/owner/inventory/${id}`)
}
