import { api } from './api'
import type { ApiResponse, Attendance, Divisi } from '@/types'

export interface AttendanceInput {
  employee_id: string
  date: string
  check_in?: string
  check_out?: string
  notes?: string
}

export interface AttendanceFilters {
  employee_id?: string
  date_from?: string
  date_to?: string
  divisi?: Divisi
}

export async function checkIn() {
  const res = await api.post<ApiResponse<Attendance>>('/attendance/check-in')
  return res.data.data
}

export async function checkOut() {
  const res = await api.patch<ApiResponse<Attendance>>('/attendance/check-out')
  return res.data.data
}

export async function getTodayAttendance() {
  const res = await api.get<ApiResponse<Attendance | null>>('/attendance/today')
  return res.data.data
}

export async function listMyAttendance(filters: AttendanceFilters = {}) {
  const res = await api.get<ApiResponse<Attendance[]>>('/attendance/mine', { params: filters })
  return res.data.data
}

export async function listAttendance(filters: AttendanceFilters = {}) {
  const res = await api.get<ApiResponse<Attendance[]>>('/attendance', { params: filters })
  return res.data.data
}

export async function createAttendance(data: AttendanceInput) {
  const res = await api.post<ApiResponse<Attendance>>('/attendance', data)
  return res.data.data
}

export async function updateAttendance(id: string, data: Partial<AttendanceInput>) {
  const res = await api.put<ApiResponse<Attendance>>(`/attendance/${id}`, data)
  return res.data.data
}

export async function deleteAttendance(id: string) {
  await api.delete(`/attendance/${id}`)
}
