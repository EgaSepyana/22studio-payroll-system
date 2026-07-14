import { CustomersRepo, ArticlesRepo, OrdersRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

// terakhir_order (date of the customer's most recent order) and
// order_terakhir (that order's name) are derived from Orders, never stored —
// always accurate, no risk of drifting out of sync with the real order data.
function enrichCustomer(customer, orders) {
  const customerOrders = orders
    .filter((o) => String(o.customer_id) === String(customer.id))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const latest = customerOrders[0];

  return {
    ...clean(customer),
    terakhir_order: latest?.created_at || null,
    order_terakhir: latest?.order_name || null,
  };
}

export async function listCustomers() {
  const [customers, orders] = await Promise.all([CustomersRepo.getAll(), OrdersRepo.getAll()]);
  return customers.map((c) => enrichCustomer(c, orders));
}

export async function createCustomer({ name, pic, alamat, no_hp, category }) {
  const customer = await CustomersRepo.insert({
    name,
    pic: pic || '',
    alamat: alamat || '',
    no_hp: no_hp || '',
    category: category || '',
  });
  return enrichCustomer(customer, []);
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

  const orders = await OrdersRepo.getAll();
  return enrichCustomer(updated, orders);
}

export async function deleteCustomer(id) {
  const articles = await ArticlesRepo.getAll();
  if (articles.some((a) => String(a.customer_id) === String(id))) {
    throw new ApiError(400, 'Customer masih memiliki artikel, hapus artikel terlebih dahulu');
  }
  const deleted = await CustomersRepo.deleteById(id);
  if (!deleted) throw new ApiError(404, 'Customer tidak ditemukan');
}
