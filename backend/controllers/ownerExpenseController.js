import { z } from 'zod';
import * as ownerExpenseService from '../services/ownerExpenseService.js';
import { ok, created } from '../utils/response.js';

const createSchema = z.object({
  date: z.string().min(1),
  category_id: z.string().min(1),
  account_id: z.string().min(1),
  order_id: z.string().optional(),
  amount: z.number().positive(),
  description: z.string().optional(),
});

export async function list(req, res, next) {
  try {
    const { category_id, order_search, account_id } = req.query;
    ok(res, await ownerExpenseService.listExpenses({ category_id, order_search, account_id }));
  } catch (err) {
    next(err);
  }
}

export async function listOrderPicker(req, res, next) {
  try {
    ok(res, await ownerExpenseService.listInProgressOrdersForPicker(req.query.search));
  } catch (err) {
    next(err);
  }
}

export async function getOrderProfitability(req, res, next) {
  try {
    ok(res, await ownerExpenseService.getOrderProfitability(req.params.orderId));
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    created(res, await ownerExpenseService.createExpense(createSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await ownerExpenseService.deleteExpense(req.params.id);
    ok(res, { message: 'Pengeluaran dihapus' });
  } catch (err) {
    next(err);
  }
}
