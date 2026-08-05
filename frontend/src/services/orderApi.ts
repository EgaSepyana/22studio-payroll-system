import { api } from './api'
import type {
  ApiResponse,
  Order,
  OrderDetail,
  OrderDP,
  OrderFrom,
  OrderItem,
  OrderJenisCategory,
  OrderShippingInfo,
  OrderStatus,
  OrderTimelineEntry,
} from '@/types'

export interface OrderInput {
  customer_id: string
  order_name: string
  notes?: string
  deadline?: string
  jenis_category?: OrderJenisCategory
  order_from?: OrderFrom
  broker?: string
  desain_fix_url?: string
}

export interface OrderUpdateInput extends Partial<OrderInput> {
  status?: OrderStatus
  note?: string
  resi?: string
  shipping_method?: string
}

export interface OrderFilters {
  customer_id?: string
  status?: OrderStatus
}

export interface OrderItemInput {
  nama_item: string
  warna?: string
}

export interface OrderItemSizeInput {
  size: string
  harga: number
  qty: number
}

export interface OrderItemTemplateInput {
  nama_item: string
  warna?: string
  sizes: { size: string; harga?: number; qty: number }[]
}

export interface OrderDPInput {
  dp_at: string
  total_dp: number
}

export async function createOrder(data: OrderInput) {
  const res = await api.post<ApiResponse<Order>>('/orders', data)
  return res.data.data
}

export async function listOrders(filters: OrderFilters = {}) {
  const res = await api.get<ApiResponse<Order[]>>('/orders', { params: filters })
  return res.data.data
}

export async function getOrderDetail(id: string) {
  const res = await api.get<ApiResponse<OrderDetail>>(`/orders/${id}`)
  return res.data.data
}

export async function updateOrder(id: string, data: OrderUpdateInput) {
  const res = await api.put<ApiResponse<Order>>(`/orders/${id}`, data)
  return res.data.data
}

export async function deleteOrder(id: string) {
  await api.delete(`/orders/${id}`)
}

export async function addOrderItem(orderId: string, data: OrderItemInput) {
  const res = await api.post<ApiResponse<OrderItem>>(`/orders/${orderId}/items`, data)
  return res.data.data
}

export async function updateOrderItem(orderId: string, itemId: string, data: Partial<OrderItemInput>) {
  const res = await api.put<ApiResponse<OrderItem>>(`/orders/${orderId}/items/${itemId}`, data)
  return res.data.data
}

export async function deleteOrderItem(orderId: string, itemId: string) {
  await api.delete(`/orders/${orderId}/items/${itemId}`)
}

export async function addOrderItemFromTemplate(orderId: string, data: OrderItemTemplateInput) {
  const res = await api.post<ApiResponse<OrderItem>>(`/orders/${orderId}/items/template`, data)
  return res.data.data
}

export async function addOrderItemSize(orderId: string, itemId: string, data: OrderItemSizeInput) {
  const res = await api.post<ApiResponse<OrderItem>>(`/orders/${orderId}/items/${itemId}/sizes`, data)
  return res.data.data
}

export async function updateOrderItemSize(
  orderId: string,
  itemId: string,
  sizeId: string,
  data: Partial<OrderItemSizeInput>
) {
  const res = await api.put<ApiResponse<OrderItem>>(`/orders/${orderId}/items/${itemId}/sizes/${sizeId}`, data)
  return res.data.data
}

export async function deleteOrderItemSize(orderId: string, itemId: string, sizeId: string) {
  await api.delete(`/orders/${orderId}/items/${itemId}/sizes/${sizeId}`)
}

export async function addOrderDP(orderId: string, data: OrderDPInput) {
  const res = await api.post<ApiResponse<OrderDP>>(`/orders/${orderId}/dp`, data)
  return res.data.data
}

export async function updateOrderDP(orderId: string, dpId: string, data: Partial<OrderDPInput>) {
  const res = await api.put<ApiResponse<OrderDP>>(`/orders/${orderId}/dp/${dpId}`, data)
  return res.data.data
}

export async function deleteOrderDP(orderId: string, dpId: string) {
  await api.delete(`/orders/${orderId}/dp/${dpId}`)
}

export async function getOrderTimeline(orderId: string) {
  const res = await api.get<ApiResponse<{ timeline: OrderTimelineEntry[]; shipping: OrderShippingInfo | null }>>(
    `/orders/${orderId}/timeline`
  )
  return res.data.data
}

export async function getTrackingLink(orderId: string) {
  const res = await api.get<ApiResponse<{ url: string }>>(`/orders/${orderId}/tracking-link`)
  return res.data.data
}

export async function resolveFollowUpMessage(
  orderId: string,
  templateKey: string,
  fields: Record<string, string> = {}
) {
  const res = await api.post<ApiResponse<{ phone: string; message: string }>>(`/orders/${orderId}/follow-up`, {
    template_key: templateKey,
    fields,
  })
  return res.data.data
}

export async function printOrderInvoice(id: string) {
  const res = await api.get(`/orders/${id}/invoice-pdf`, { responseType: 'blob' })
  const blob = new Blob([res.data], { type: 'application/pdf' })
  const url = window.URL.createObjectURL(blob)
  window.open(url, '_blank')
}

export async function downloadOrderInvoicePdf(id: string, orderName: string) {
  const res = await api.get(`/orders/${id}/invoice-pdf`, { responseType: 'blob' })
  const blob = new Blob([res.data], { type: 'application/pdf' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `Invoice - ${orderName}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function downloadOrderInvoiceExcel(id: string, orderName: string) {
  const res = await api.get(`/orders/${id}/invoice-excel`, { responseType: 'blob' })
  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `Invoice - ${orderName}.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
