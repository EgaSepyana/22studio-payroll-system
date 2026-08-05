import { api } from './api'
import type {
  ApiResponse,
  CmsSection,
  CmsContactInfo,
  CmsFoundersPromise,
  CmsGeneralSettings,
} from '@/types'

// Generic per-section CRUD — every list section (nav links, FAQs, services,
// ...) is shaped differently, so callers pass the concrete item type; the
// wire calls themselves are identical across sections.
export async function listSection<T>(section: CmsSection) {
  const res = await api.get<ApiResponse<T[]>>(`/cms/${section}`)
  return res.data.data
}

export async function createItem<T>(section: CmsSection, data: Partial<T>) {
  const res = await api.post<ApiResponse<T>>(`/cms/${section}`, data)
  return res.data.data
}

export async function updateItem<T>(section: CmsSection, id: string, data: Partial<T>) {
  const res = await api.put<ApiResponse<T>>(`/cms/${section}/${id}`, data)
  return res.data.data
}

export async function deleteItem(section: CmsSection, id: string) {
  await api.delete(`/cms/${section}/${id}`)
}

export async function reorderSection<T>(section: CmsSection, orderedIds: string[]) {
  const res = await api.put<ApiResponse<T[]>>(`/cms/${section}/reorder`, { orderedIds })
  return res.data.data
}

export async function getGeneralSettings() {
  const res = await api.get<ApiResponse<CmsGeneralSettings>>('/cms/general')
  return res.data.data
}

export async function updateGeneralSettings(data: Partial<CmsGeneralSettings>) {
  const res = await api.put<ApiResponse<CmsGeneralSettings>>('/cms/general', data)
  return res.data.data
}

export async function getFoundersPromise() {
  const res = await api.get<ApiResponse<CmsFoundersPromise>>('/cms/founders-promise')
  return res.data.data
}

export async function updateFoundersPromise(data: Partial<CmsFoundersPromise>) {
  const res = await api.put<ApiResponse<CmsFoundersPromise>>('/cms/founders-promise', data)
  return res.data.data
}

export async function getContactInfo() {
  const res = await api.get<ApiResponse<CmsContactInfo>>('/cms/contact-info')
  return res.data.data
}

export async function updateContactInfo(data: Partial<CmsContactInfo>) {
  const res = await api.put<ApiResponse<CmsContactInfo>>('/cms/contact-info', data)
  return res.data.data
}
