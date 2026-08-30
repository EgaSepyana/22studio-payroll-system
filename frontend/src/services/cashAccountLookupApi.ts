import { api } from './api'
import type { ApiResponse } from '@/types'

export interface CashAccountOption {
  id: string
  name: string
}

// Read-only list of active Owner Keuangan cash accounts, reachable by
// admin/admin_produksi/owner — used to tag which account a payment (Order
// Pembayaran, Payroll mark-as-paid) went through. Deliberately separate
// from ownerCashApi.ts's owner-only account management.
export async function listActiveCashAccounts() {
  const res = await api.get<ApiResponse<CashAccountOption[]>>('/cash-accounts')
  return res.data.data
}
