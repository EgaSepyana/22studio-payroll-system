import { CustomersRepo, CustomerArticlesRepo, ArticlesCategoryRepo, OrdersRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

// terakhir_order (date of the customer's most recent order) and
// order_terakhir (that order's name) are derived from Orders, never stored —
// always accurate, no risk of drifting out of sync with the real order data.
// category_ids/category_names are the ArticleCategories this customer is
// linked to via CustomerArticles — which article categories it can use.
function enrichCustomer(customer, { orders, categories, customerArticles }) {
  const customerOrders = orders
    .filter((o) => String(o.customer_id) === String(customer.id))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const latest = customerOrders[0];

  const links = customerArticles.filter((ca) => String(ca.customer_id) === String(customer.id));
  const categoryIds = links.map((ca) => String(ca.category_id));
  const categoryNames = categoryIds.map((id) => categories.find((c) => String(c.id) === id)?.name || null);

  return {
    ...clean(customer),
    terakhir_order: latest?.created_at || null,
    order_terakhir: latest?.order_name || null,
    category_ids: categoryIds,
    category_names: categoryNames,
  };
}

async function fetchEnrichContext() {
  const [orders, categories, customerArticles] = await Promise.all([
    OrdersRepo.getAll(),
    ArticlesCategoryRepo.getAll(),
    CustomerArticlesRepo.getAll(),
  ]);
  return { orders, categories, customerArticles };
}

export async function listCustomers() {
  const [customers, ctx] = await Promise.all([CustomersRepo.getAll(), fetchEnrichContext()]);
  return customers.map((c) => enrichCustomer(c, ctx));
}

export async function createCustomer({ name, pic, alamat, no_hp, category }) {
  const customer = await CustomersRepo.insert({
    name,
    pic: pic || '',
    alamat: alamat || '',
    no_hp: no_hp || '',
    category: category || '',
  });
  return enrichCustomer(customer, { orders: [], categories: [], customerArticles: [] });
}

export async function updateCustomer(id, { name, pic, alamat, no_hp, category }) {
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (pic !== undefined) patch.pic = pic;
  if (alamat !== undefined) patch.alamat = alamat;
  if (no_hp !== undefined) patch.no_hp = no_hp;
  if (category !== undefined) patch.category = category;

  const updated = await CustomersRepo.updateById(id, patch);
  if (!updated) throw new ApiError(404, 'Customer tidak ditemukan');

  const ctx = await fetchEnrichContext();
  return enrichCustomer(updated, ctx);
}

export async function deleteCustomer(id) {
  const customerArticles = await CustomerArticlesRepo.getAll();
  if (customerArticles.some((ca) => String(ca.customer_id) === String(id))) {
    throw new ApiError(400, 'Customer masih memiliki artikel, hapus artikel terlebih dahulu');
  }
  const deleted = await CustomersRepo.deleteById(id);
  if (!deleted) throw new ApiError(404, 'Customer tidak ditemukan');
}
