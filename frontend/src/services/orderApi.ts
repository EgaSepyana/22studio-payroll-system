import { api } from './api'
import type { ApiResponse, Order, OrderDetail, OrderItem, OrderStatus } from '@/types'

export interface OrderInput {
  customer_id: string
  order_name: string
  notes?: string
  deadline?: string
}

export interface OrderUpdateInput extends Partial<OrderInput> {
  status?: OrderStatus
}

export interface OrderFilters {
  customer_id?: string
  status?: OrderStatus
}

export interface OrderItemInput {
  nama_item: string
  harga: number
  qty: number
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
