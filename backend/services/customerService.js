import { CustomersRepo, ArticlesRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

export async function listCustomers() {
  const customers = await CustomersRepo.getAll();
  return customers.map(clean);
}

export async function createCustomer({ name }) {
  const customer = await CustomersRepo.insert({ name });
  return clean(customer);
}

export async function updateCustomer(id, { name }) {
  const updated = await CustomersRepo.updateById(id, { name });
  if (!updated) throw new ApiError(404, 'Customer tidak ditemukan');
  return clean(updated);
}

export async function deleteCustomer(id) {
  const articles = await ArticlesRepo.getAll();
  if (articles.some((a) => String(a.customer_id) === String(id))) {
    throw new ApiError(400, 'Customer masih memiliki artikel, hapus artikel terlebih dahulu');
  }
  const deleted = await CustomersRepo.deleteById(id);
  if (!deleted) throw new ApiError(404, 'Customer tidak ditemukan');
}
