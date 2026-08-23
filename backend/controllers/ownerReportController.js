import { z } from 'zod';
import * as ownerReportService from '../services/ownerReportService.js';
import { ok } from '../utils/response.js';

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Format bulan tidak valid (YYYY-MM)');

export async function getProfitLoss(req, res, next) {
  try {
    const month = monthSchema.parse(req.query.month);
    ok(res, await ownerReportService.getProfitLoss(month));
  } catch (err) {
    next(err);
  }
}

export async function getBalanceSheet(req, res, next) {
  try {
    ok(res, await ownerReportService.getBalanceSheet());
  } catch (err) {
    next(err);
  }
}
