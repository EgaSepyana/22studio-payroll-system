import { z } from 'zod';
import * as ownerIncomeService from '../services/ownerIncomeService.js';
import { ok, created } from '../utils/response.js';

const createSchema = z.object({
  date: z.string().min(1),
  category_id: z.string().min(1),
  account_id: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().optional(),
});

export async function list(req, res, next) {
  try {
    const { category_id, month, account_id } = req.query;
    ok(res, await ownerIncomeService.listIncome({ category_id, month, account_id }));
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    created(res, await ownerIncomeService.createIncome(createSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await ownerIncomeService.deleteIncome(req.params.id);
    ok(res, { message: 'Pemasukan dihapus' });
  } catch (err) {
    next(err);
  }
}
