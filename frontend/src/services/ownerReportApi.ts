import { api } from './api'
import type { ApiResponse, OwnerBalanceSheet, OwnerProfitLoss } from '@/types'

export async function getProfitLoss(month: string) {
  const res = await api.get<ApiResponse<OwnerProfitLoss>>('/owner/reports/profit-loss', { params: { month } })
  return res.data.data
}

export async function getBalanceSheet() {
  const res = await api.get<ApiResponse<OwnerBalanceSheet>>('/owner/reports/balance-sheet')
  return res.data.data
}
