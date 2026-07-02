import { ArticlesRepo, CustomersRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

async function attachCustomerName(article) {
  const customer = await CustomersRepo.getById(article.customer_id);
  return { ...clean(article), customer_name: customer?.name || null };
}

export async function listArticles(filters = {}) {
  let articles = await ArticlesRepo.getAll();
  if (filters.divisi) {
    articles = articles.filter((a) => a.divisi === filters.divisi);
  }
  return Promise.all(articles.map(attachCustomerName));
}

export async function createArticle({ customer_id, article_name, price, status, divisi }) {
  const customer = await CustomersRepo.getById(customer_id);
  if (!customer) throw new ApiError(400, 'Customer tidak valid');

  const article = await ArticlesRepo.insert({
    customer_id,
    article_name,
    price,
    status: status || 'active',
    divisi: divisi || '',
  });
  return attachCustomerName(article);
}

export async function updateArticle(id, { customer_id, article_name, price, status, divisi }) {
  if (customer_id !== undefined) {
    const customer = await CustomersRepo.getById(customer_id);
    if (!customer) throw new ApiError(400, 'Customer tidak valid');
  }
  const patch = {};
  if (customer_id !== undefined) patch.customer_id = customer_id;
  if (article_name !== undefined) patch.article_name = article_name;
  if (price !== undefined) patch.price = price;
  if (status !== undefined) patch.status = status;
  if (divisi !== undefined) patch.divisi = divisi;

  const updated = await ArticlesRepo.updateById(id, patch);
  if (!updated) throw new ApiError(404, 'Artikel tidak ditemukan');
  return attachCustomerName(updated);
}

export async function deleteArticle(id) {
  const deleted = await ArticlesRepo.deleteById(id);
  if (!deleted) throw new ApiError(404, 'Artikel tidak ditemukan');
}
