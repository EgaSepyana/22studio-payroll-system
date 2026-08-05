import { z } from 'zod';
import * as customerService from '../services/customerService.js';
import * as articleCategoryService from '../services/articleCategoryService.js';
import { CUSTOMER_CATEGORIES } from '../google-sheet/models.js';
import { ok, created } from '../utils/response.js';

const createSchema = z.object({
  name: z.string().min(1),
  pic: z.string().optional(),
  alamat: z.string().optional(),
  no_hp: z.string().optional(),
  category: z.enum(CUSTOMER_CATEGORIES).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  pic: z.string().optional(),
  alamat: z.string().optional(),
  no_hp: z.string().optional(),
  category: z.enum(CUSTOMER_CATEGORIES).optional(),
});

export async function list(req, res, next) {
  try {
    ok(res, await customerService.listCustomers());
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    created(res, await customerService.createCustomer(createSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    ok(res, await customerService.updateCustomer(req.params.id, updateSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await customerService.deleteCustomer(req.params.id);
    ok(res, { message: 'Customer dihapus' });
  } catch (err) {
    next(err);
  }
}

const categoriesSchema = z.object({
  category_ids: z.array(z.union([z.string(), z.number()])),
});

export async function setCategories(req, res, next) {
  try {
    const { category_ids } = categoriesSchema.parse(req.body);
    ok(res, await articleCategoryService.setCustomerCategories(req.params.id, category_ids));
  } catch (err) {
    next(err);
  }
}
