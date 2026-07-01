import { api } from './api'
import type { ApiResponse, Article } from '@/types'

export interface ArticleInput {
  customer_id: string
  article_name: string
  price: number
  status?: 'active' | 'inactive'
}

export async function listArticles() {
  const res = await api.get<ApiResponse<Article[]>>('/articles')
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
