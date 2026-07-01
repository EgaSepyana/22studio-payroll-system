import { z } from 'zod';
import * as payrollService from '../services/payrollService.js';
import { ok } from '../utils/response.js';

const filterSchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000),
  employee_id: z.string().optional(),
});

export async function list(req, res, next) {
  try {
    const { month, year, employee_id } = filterSchema.parse(req.query);
    ok(res, await payrollService.getOrGeneratePayroll(month, year, employee_id));
  } catch (err) {
    next(err);
  }
}

export async function detail(req, res, next) {
  try {
    ok(res, await payrollService.getPayrollDetail(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function markPaid(req, res, next) {
  try {
    ok(res, await payrollService.markAsPaid(req.params.id, req.user.id));
  } catch (err) {
    next(err);
  }
}

export async function myHistory(req, res, next) {
  try {
    ok(res, await payrollService.getEmployeePayrollHistory(req.user.employee_id));
  } catch (err) {
    next(err);
  }
}
