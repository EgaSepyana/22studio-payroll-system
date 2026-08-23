import { api } from './api'
import type {
  ApiResponse,
  OwnerCashAccount,
  OwnerCashBalances,
  OwnerCashTransfer,
  OwnerCashReconciliation,
} from '@/types'

export interface OwnerCashAccountInput {
  name: string
}

export interface OwnerCashAccountUpdateInput {
  name?: string
  is_active?: boolean
}

export async function listAccounts() {
  const res = await api.get<ApiResponse<OwnerCashAccount[]>>('/owner/cash/accounts')
  return res.data.data
}

export async function createAccount(data: OwnerCashAccountInput) {
  const res = await api.post<ApiResponse<OwnerCashAccount>>('/owner/cash/accounts', data)
  return res.data.data
}

export async function updateAccount(id: string, data: OwnerCashAccountUpdateInput) {
  const res = await api.put<ApiResponse<OwnerCashAccount>>(`/owner/cash/accounts/${id}`, data)
  return res.data.data
}

export async function deleteAccount(id: string) {
  await api.delete(`/owner/cash/accounts/${id}`)
}

export async function getBalances() {
  const res = await api.get<ApiResponse<OwnerCashBalances>>('/owner/cash/accounts/balances')
  return res.data.data
}

export interface OwnerCashTransferInput {
  date: string
  from_account_id: string
  to_account_id: string
  amount: number
  description?: string
}

export async function listTransfers() {
  const res = await api.get<ApiResponse<OwnerCashTransfer[]>>('/owner/cash/transfers')
  return res.data.data
}

export async function createTransfer(data: OwnerCashTransferInput) {
  const res = await api.post<ApiResponse<OwnerCashTransfer>>('/owner/cash/transfers', data)
  return res.data.data
}

export async function updateTransfer(id: string, data: Partial<OwnerCashTransferInput>) {
  const res = await api.put<ApiResponse<OwnerCashTransfer>>(`/owner/cash/transfers/${id}`, data)
  return res.data.data
}

export async function deleteTransfer(id: string) {
  await api.delete(`/owner/cash/transfers/${id}`)
}

export interface OwnerCashReconciliationInput {
  date: string
  account_id: string
  actual_balance: number
  description?: string
}

export async function listReconciliations() {
  const res = await api.get<ApiResponse<OwnerCashReconciliation[]>>('/owner/cash/reconciliations')
  return res.data.data
}

export async function previewSystemBalance(accountId: string) {
  const res = await api.get<ApiResponse<{ system_balance: number }>>('/owner/cash/reconciliations/preview-balance', {
    params: { account_id: accountId },
  })
  return res.data.data
}

export async function createReconciliation(data: OwnerCashReconciliationInput) {
  const res = await api.post<ApiResponse<OwnerCashReconciliation>>('/owner/cash/reconciliations', data)
  return res.data.data
}

export async function deleteReconciliation(id: string) {
  await api.delete(`/owner/cash/reconciliations/${id}`)
}
