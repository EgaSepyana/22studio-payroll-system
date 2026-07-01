import { z } from 'zod';
import * as customerService from '../services/customerService.js';
import { ok, created } from '../utils/response.js';

const schema = z.object({ name: z.string().min(1) });

export async function list(req, res, next) {
  try {
    ok(res, await customerService.listCustomers());
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    created(res, await customerService.createCustomer(schema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    ok(res, await customerService.updateCustomer(req.params.id, schema.parse(req.body)));
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
