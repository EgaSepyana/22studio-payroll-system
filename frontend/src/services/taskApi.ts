import { api } from './api'
import type { ApiResponse, Divisi, Task, TaskStatus } from '@/types'

export interface TaskInput {
  order_id: string
  article_id: string
  divisi: Divisi
  description?: string
  target_qty: number
}

export interface TaskFilters {
  order_id?: string
  divisi?: Divisi
  status?: TaskStatus
  assigned_to?: string
}

export async function createTask(data: TaskInput) {
  const res = await api.post<ApiResponse<Task>>('/tasks', data)
  return res.data.data
}

export async function listTasks(filters: TaskFilters = {}) {
  const res = await api.get<ApiResponse<Task[]>>('/tasks', { params: filters })
  return res.data.data
}

export async function listAvailableTasks() {
  const res = await api.get<ApiResponse<Task[]>>('/tasks/available')
  return res.data.data
}

export async function listMyTasks() {
  const res = await api.get<ApiResponse<Task[]>>('/tasks/mine')
  return res.data.data
}

export async function getTaskDetail(id: string) {
  const res = await api.get<ApiResponse<Task>>(`/tasks/${id}`)
  return res.data.data
}

export async function updateTask(id: string, data: Partial<Omit<TaskInput, 'order_id'>>) {
  const res = await api.put<ApiResponse<Task>>(`/tasks/${id}`, data)
  return res.data.data
}

export async function deleteTask(id: string) {
  await api.delete(`/tasks/${id}`)
}
