import { z } from 'zod';
import * as articleCategoryService from '../services/articleCategoryService.js';
import { ok, created } from '../utils/response.js';

const createSchema = z.object({
  name: z.string().min(1),
});

const updateSchema = z.object({
  name: z.string().min(1),
});

const customersSchema = z.object({
  customer_ids: z.array(z.union([z.string(), z.number()])),
});

export async function list(req, res, next) {
  try {
    ok(res, await articleCategoryService.listCategories());
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    created(res, await articleCategoryService.createCategory(createSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    ok(res, await articleCategoryService.updateCategory(req.params.id, updateSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await articleCategoryService.deleteCategory(req.params.id);
    ok(res, { message: 'Kategori dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function setCustomers(req, res, next) {
  try {
    const { customer_ids } = customersSchema.parse(req.body);
    ok(res, await articleCategoryService.setCategoryCustomers(req.params.id, customer_ids));
  } catch (err) {
    next(err);
  }
}
