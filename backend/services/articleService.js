import { ArticlesRepo, CustomersRepo, ArticlesCategoryRepo, CustomerArticlesRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

// An Article's customers are never stored on the Article itself — sharing
// happens at the category level (CustomerArticles links a category_id to a
// customer_id), so every Article in that category becomes usable by every
// customer linked to it. This derives customer_ids/customer_names from the
// article's own category_id, plus the category's own name.
function attachRelations(article, { customers, categories, customerArticles }) {
  const links = customerArticles.filter((ca) => String(ca.category_id) === String(article.category_id));
  const ids = links.map((ca) => String(ca.customer_id));
  const names = ids.map((id) => customers.find((c) => String(c.id) === id)?.name || null);
  const category = categories.find((c) => String(c.id) === String(article.category_id));

  return {
    ...clean(article),
    customer_ids: ids,
    customer_names: names,
    category_name: category?.name || null,
  };
}

async function fetchRelationContext() {
  const [customers, categories, customerArticles] = await Promise.all([
    CustomersRepo.getAll(),
    ArticlesCategoryRepo.getAll(),
    CustomerArticlesRepo.getAll(),
  ]);
  return { customers, categories, customerArticles };
}

async function validateCategoryId(categoryId, categories) {
  if (categoryId === undefined || categoryId === null || categoryId === '') return;
  if (!categories.some((c) => String(c.id) === String(categoryId))) {
    throw new ApiError(400, 'Kategori tidak valid');
  }
}

export async function listArticles(filters = {}) {
  let articles = await ArticlesRepo.getAll();
  if (filters.divisi) {
    articles = articles.filter((a) => a.divisi === filters.divisi);
  }
  const ctx = await fetchRelationContext();
  return articles.map((a) => attachRelations(a, ctx));
}

export async function createArticle({ category_id, article_name, price, status, divisi }) {
  const ctx = await fetchRelationContext();
  await validateCategoryId(category_id, ctx.categories);

  const article = await ArticlesRepo.insert({
    category_id: category_id || '',
    article_name,
    price,
    status: status || 'active',
    divisi: divisi || '',
  });

  return attachRelations(article, ctx);
}

export async function updateArticle(id, { category_id, article_name, price, status, divisi }) {
  const ctx = await fetchRelationContext();
  if (category_id !== undefined) await validateCategoryId(category_id, ctx.categories);

  const patch = {};
  if (category_id !== undefined) patch.category_id = category_id || '';
  if (article_name !== undefined) patch.article_name = article_name;
  if (price !== undefined) patch.price = price;
  if (status !== undefined) patch.status = status;
  if (divisi !== undefined) patch.divisi = divisi;

  const updated = await ArticlesRepo.updateById(id, patch);
  if (!updated) throw new ApiError(404, 'Artikel tidak ditemukan');
  return attachRelations(updated, ctx);
}

export async function deleteArticle(id) {
  const deleted = await ArticlesRepo.deleteById(id);
  if (!deleted) throw new ApiError(404, 'Artikel tidak ditemukan');
}
