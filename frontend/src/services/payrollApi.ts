import { api } from './api'
import type { ApiResponse, PayrollDetail, PayrollRow } from '@/types'

export async function listPayroll(month: number, year: number, employeeId?: string) {
  const res = await api.get<ApiResponse<PayrollRow[]>>('/payroll', {
    params: { month, year, employee_id: employeeId },
  })
  return res.data.data
}

export async function getPayrollDetail(id: string) {
  const res = await api.get<ApiResponse<PayrollDetail>>(`/payroll/${id}`)
  return res.data.data
}

export async function markPayrollPaid(id: string) {
  const res = await api.patch<ApiResponse<PayrollRow>>(`/payroll/${id}/pay`)
  return res.data.data
}

export async function listMyPayrollHistory() {
  const res = await api.get<ApiResponse<PayrollRow[]>>('/payroll/mine')
  return res.data.data
}
