import { api } from './api'
import type { ApiResponse, Article, Divisi } from '@/types'

export interface ArticleInput {
  category_id?: string
  article_name: string
  price: number
  status?: 'active' | 'inactive'
  divisi?: Divisi
}

export interface ArticleFilters {
  divisi?: Divisi
}

export async function listArticles(filters: ArticleFilters = {}) {
  const res = await api.get<ApiResponse<Article[]>>('/articles', { params: filters })
  return res.data.data
}

export async function createArticle(data: ArticleInput) {
  const res = await api.post<ApiResponse<Article>>('/articles', data)
  return res.data.data
}

export async function updateArticle(id: string, data: Partial<ArticleInput>) {
  const res = await api.put<ApiResponse<Article>>(`/articles/${id}`, data)
  return res.data.data
}

export async function deleteArticle(id: string) {
  await api.delete(`/articles/${id}`)
}
