import { z } from 'zod';
import * as cashAdvanceService from '../services/cashAdvanceService.js';
import { CASH_ADVANCE_STATUSES } from '../google-sheet/models.js';
import { ok, created } from '../utils/response.js';

const createSchema = z.object({
  amount: z.coerce.number().positive('Nominal harus lebih dari Rp0'),
  reason: z.string().optional(),
});

const filterSchema = z.object({
  employee_id: z.string().optional(),
  status: z.enum(CASH_ADVANCE_STATUSES).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

export async function create(req, res, next) {
  try {
    const data = createSchema.parse(req.body);
    created(res, await cashAdvanceService.createCashAdvance(req.user.employee_id, data));
  } catch (err) {
    next(err);
  }
}

export async function listAll(req, res, next) {
  try {
    const filters = filterSchema.parse(req.query);
    ok(res, await cashAdvanceService.listCashAdvances(filters));
  } catch (err) {
    next(err);
  }
}

export async function listMine(req, res, next) {
  try {
    const filters = filterSchema.parse(req.query);
    filters.employee_id = req.user.employee_id;
    ok(res, await cashAdvanceService.listCashAdvances(filters));
  } catch (err) {
    next(err);
  }
}

export async function detail(req, res, next) {
  try {
    ok(res, await cashAdvanceService.getCashAdvanceDetail(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function approve(req, res, next) {
  try {
    ok(res, await cashAdvanceService.approveCashAdvance(req.params.id, req.user.id));
  } catch (err) {
    next(err);
  }
}

export async function reject(req, res, next) {
  try {
    ok(res, await cashAdvanceService.rejectCashAdvance(req.params.id, req.user.id));
  } catch (err) {
    next(err);
  }
}
