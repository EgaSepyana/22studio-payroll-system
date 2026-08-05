import { ArticlesRepo, CustomersRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

// Google Sheets cells are scalar-only, so an Article's many customers are
// stored as a comma-joined string in one cell (e.g. "3,7,12") and
// parsed/serialized only here — every other consumer works with a real
// string[] once it comes through this service.
export function parseCustomerIds(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function serializeCustomerIds(ids) {
  return (ids || []).map(String).join(',');
}

function attachCustomerNames(article, customers) {
  const ids = parseCustomerIds(article.customer_ids);
  const names = ids.map((id) => customers.find((c) => String(c.id) === id)?.name || null);
  return { ...clean(article), customer_ids: ids, customer_names: names };
}

async function validateCustomerIds(ids) {
  if (!ids || ids.length === 0) throw new ApiError(400, 'Pilih minimal satu customer');
  const customers = await CustomersRepo.getAll();
  for (const id of ids) {
    if (!customers.some((c) => String(c.id) === String(id))) {
      throw new ApiError(400, `Customer tidak valid: ${id}`);
    }
  }
  return customers;
}

export async function listArticles(filters = {}) {
  let articles = await ArticlesRepo.getAll();
  if (filters.divisi) {
    articles = articles.filter((a) => a.divisi === filters.divisi);
  }
  const customers = await CustomersRepo.getAll();
  return articles.map((a) => attachCustomerNames(a, customers));
}

export async function createArticle({ customer_ids, article_name, price, status, divisi }) {
  const customers = await validateCustomerIds(customer_ids);

  const article = await ArticlesRepo.insert({
    customer_ids: serializeCustomerIds(customer_ids),
    article_name,
    price,
    status: status || 'active',
    divisi: divisi || '',
  });
  return attachCustomerNames(article, customers);
}

export async function updateArticle(id, { customer_ids, article_name, price, status, divisi }) {
  let customers;
  if (customer_ids !== undefined) {
    customers = await validateCustomerIds(customer_ids);
  } else {
    customers = await CustomersRepo.getAll();
  }

  const patch = {};
  if (customer_ids !== undefined) patch.customer_ids = serializeCustomerIds(customer_ids);
  if (article_name !== undefined) patch.article_name = article_name;
  if (price !== undefined) patch.price = price;
  if (status !== undefined) patch.status = status;
  if (divisi !== undefined) patch.divisi = divisi;

  const updated = await ArticlesRepo.updateById(id, patch);
  if (!updated) throw new ApiError(404, 'Artikel tidak ditemukan');
  return attachCustomerNames(updated, customers);
}

export async function deleteArticle(id) {
  const deleted = await ArticlesRepo.deleteById(id);
  if (!deleted) throw new ApiError(404, 'Artikel tidak ditemukan');
}
