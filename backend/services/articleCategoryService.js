import { ArticlesCategoryRepo, ArticlesRepo, CustomersRepo, CustomerArticlesRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

// A category is the sharing unit — every customer linked to a category via
// CustomerArticles can use every Article in that category. This attaches
// each category's linked customer_ids/customer_names for display/management
// in the admin UI, same enrichment shape articleService uses for Articles.
function attachCustomers(category, { customers, customerArticles }) {
  const links = customerArticles.filter((ca) => String(ca.category_id) === String(category.id));
  const ids = links.map((ca) => String(ca.customer_id));
  const names = ids.map((id) => customers.find((c) => String(c.id) === id)?.name || null);
  return { ...clean(category), customer_ids: ids, customer_names: names };
}

export async function listCategories() {
  const [categories, customers, customerArticles] = await Promise.all([
    ArticlesCategoryRepo.getAll(),
    CustomersRepo.getAll(),
    CustomerArticlesRepo.getAll(),
  ]);
  return categories.map((c) => attachCustomers(c, { customers, customerArticles }));
}

export async function createCategory({ name }) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new ApiError(400, 'Nama kategori wajib diisi');
  const category = await ArticlesCategoryRepo.insert({ name: trimmed });
  return attachCustomers(category, { customers: [], customerArticles: [] });
}

export async function updateCategory(id, { name }) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new ApiError(400, 'Nama kategori wajib diisi');
  const updated = await ArticlesCategoryRepo.updateById(id, { name: trimmed });
  if (!updated) throw new ApiError(404, 'Kategori tidak ditemukan');
  const [customers, customerArticles] = await Promise.all([CustomersRepo.getAll(), CustomerArticlesRepo.getAll()]);
  return attachCustomers(updated, { customers, customerArticles });
}

export async function deleteCategory(id) {
  const articles = await ArticlesRepo.getAll();
  if (articles.some((a) => String(a.category_id) === String(id))) {
    throw new ApiError(400, 'Kategori masih dipakai oleh artikel, ubah artikel terlebih dahulu');
  }
  const deleted = await ArticlesCategoryRepo.deleteById(id);
  if (!deleted) throw new ApiError(404, 'Kategori tidak ditemukan');

  const links = await CustomerArticlesRepo.getAll();
  const ownLinks = links.filter((ca) => String(ca.category_id) === String(id));
  for (const link of ownLinks) {
    await CustomerArticlesRepo.deleteById(link.id);
  }
}

// Diffs against existing CustomerArticles rows for this category (delete
// removed links, insert added ones) rather than blindly wiping and
// re-inserting — keeps row ids stable and avoids unnecessary writes.
export async function setCategoryCustomers(categoryId, customerIds) {
  const [category, customers, allLinks] = await Promise.all([
    ArticlesCategoryRepo.getById(categoryId),
    CustomersRepo.getAll(),
    CustomerArticlesRepo.getAll(),
  ]);
  if (!category) throw new ApiError(404, 'Kategori tidak ditemukan');

  for (const id of customerIds || []) {
    if (!customers.some((c) => String(c.id) === String(id))) {
      throw new ApiError(400, `Customer tidak valid: ${id}`);
    }
  }

  const existingLinks = allLinks.filter((ca) => String(ca.category_id) === String(categoryId));
  const currentIds = new Set(existingLinks.map((l) => String(l.customer_id)));
  const nextIds = new Set((customerIds || []).map(String));

  const toRemove = existingLinks.filter((l) => !nextIds.has(String(l.customer_id)));
  const toAdd = [...nextIds].filter((id) => !currentIds.has(id));

  for (const link of toRemove) {
    await CustomerArticlesRepo.deleteById(link.id);
  }
  for (const customerId of toAdd) {
    await CustomerArticlesRepo.insert({
      category_id: categoryId,
      customer_id: customerId,
      created_at: new Date().toISOString(),
    });
  }

  const freshLinks = await CustomerArticlesRepo.getAll({ fresh: true });
  return attachCustomers(category, { customers, customerArticles: freshLinks });
}
