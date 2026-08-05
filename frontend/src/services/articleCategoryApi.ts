import { api } from './api'
import type { ApiResponse, ArticleCategory } from '@/types'

export interface ArticleCategoryInput {
  name: string
}

export async function listArticleCategories() {
  const res = await api.get<ApiResponse<ArticleCategory[]>>('/article-categories')
  return res.data.data
}

export async function createArticleCategory(data: ArticleCategoryInput) {
  const res = await api.post<ApiResponse<ArticleCategory>>('/article-categories', data)
  return res.data.data
}

export async function updateArticleCategory(id: string, data: ArticleCategoryInput) {
  const res = await api.put<ApiResponse<ArticleCategory>>(`/article-categories/${id}`, data)
  return res.data.data
}

export async function deleteArticleCategory(id: string) {
  await api.delete(`/article-categories/${id}`)
}

export async function setArticleCategoryCustomers(id: string, customerIds: string[]) {
  const res = await api.put<ApiResponse<ArticleCategory>>(`/article-categories/${id}/customers`, {
    customer_ids: customerIds,
  })
  return res.data.data
}
