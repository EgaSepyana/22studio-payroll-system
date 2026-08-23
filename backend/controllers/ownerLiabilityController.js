import { z } from 'zod';
import * as ownerLiabilityService from '../services/ownerLiabilityService.js';
import { ok, created } from '../utils/response.js';

const liabilitySchema = z.object({
  date: z.string().min(1),
  due_date: z.string().optional(),
  creditor_name: z.string().min(1),
  creditor_address: z.string().optional(),
  category_id: z.string().min(1),
  qty: z.number().positive(),
  unit_price: z.number().nonnegative(),
  description: z.string().optional(),
});
const updateLiabilitySchema = liabilitySchema.partial();

const paymentSchema = z.object({
  date: z.string().min(1),
  amount: z.number().positive(),
  account_id: z.string().min(1),
  description: z.string().optional(),
});

export async function list(req, res, next) {
  try {
    const { search, category_id, status } = req.query;
    ok(res, await ownerLiabilityService.listLiabilities({ search, category_id, status }));
  } catch (err) {
    next(err);
  }
}

export async function getDetail(req, res, next) {
  try {
    ok(res, await ownerLiabilityService.getLiabilityDetail(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    created(res, await ownerLiabilityService.createLiability(liabilitySchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    ok(res, await ownerLiabilityService.updateLiability(req.params.id, updateLiabilitySchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await ownerLiabilityService.deleteLiability(req.params.id);
    ok(res, { message: 'Kewajiban dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function createPayment(req, res, next) {
  try {
    created(res, await ownerLiabilityService.createPayment(req.params.id, paymentSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function removePayment(req, res, next) {
  try {
    await ownerLiabilityService.deletePayment(req.params.id, req.params.paymentId);
    ok(res, { message: 'Pembayaran dihapus' });
  } catch (err) {
    next(err);
  }
}
