import { z } from 'zod';
import * as ownerInventoryService from '../services/ownerInventoryService.js';
import { ok, created } from '../utils/response.js';

const fundingFields = {
  funding_source: z.enum(['cash', 'payable', 'capital']),
  account_id: z.string().optional(),
  creditor_name: z.string().optional(),
  creditor_address: z.string().optional(),
  due_date: z.string().optional(),
  capital_source_name: z.string().optional(),
  capital_note: z.string().optional(),
};

const registerSchema = z.object({
  date: z.string().min(1),
  name: z.string().min(1),
  category_id: z.string().min(1),
  location_id: z.string().min(1),
  item_type: z.enum(['raw_material', 'finished_good']),
  qty: z.number().positive(),
  unit_price: z.number().nonnegative(),
  description: z.string().optional(),
  ...fundingFields,
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  category_id: z.string().min(1).optional(),
  location_id: z.string().min(1).optional(),
  description: z.string().optional(),
});

const stockInSchema = z.object({
  item_id: z.string().min(1),
  date: z.string().min(1),
  qty: z.number().positive(),
  unit_price: z.number().nonnegative().optional(),
  ...fundingFields,
});

const stockOutSchema = z.object({
  item_id: z.string().min(1),
  date: z.string().min(1),
  qty: z.number().positive(),
  exit_type: z.enum(['production', 'sold', 'damaged']),
  description: z.string().optional(),
  // production
  output_code: z.string().optional(),
  output_name: z.string().optional(),
  output_category_id: z.string().optional(),
  output_location_id: z.string().optional(),
  // sold
  sale_price: z.number().nonnegative().optional(),
  sale_method: z.enum(['cash', 'credit']).optional(),
  account_id: z.string().optional(),
  // damaged
  loss_value: z.number().nonnegative().optional(),
});

export async function list(req, res, next) {
  try {
    const { search, category_id, location_id, item_type, sort } = req.query;
    ok(res, await ownerInventoryService.listItems({ search, category_id, location_id, item_type, sort }));
  } catch (err) {
    next(err);
  }
}

export async function getDetail(req, res, next) {
  try {
    ok(res, await ownerInventoryService.getItemDetail(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function register(req, res, next) {
  try {
    created(res, await ownerInventoryService.registerItem(registerSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    ok(res, await ownerInventoryService.updateItem(req.params.id, updateSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function stockIn(req, res, next) {
  try {
    created(res, await ownerInventoryService.stockIn(stockInSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function stockOut(req, res, next) {
  try {
    created(res, await ownerInventoryService.stockOut(stockOutSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await ownerInventoryService.deleteItem(req.params.id);
    ok(res, { message: 'Item stok dihapus' });
  } catch (err) {
    next(err);
  }
}
