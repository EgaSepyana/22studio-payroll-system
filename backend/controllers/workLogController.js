import { z } from 'zod';
import * as workLogService from '../services/workLogService.js';
import { ok, created } from '../utils/response.js';

const createSchema = z.object({
  employee_id: z.union([z.string(), z.number()]).optional(),
  customer_id: z.union([z.string(), z.number()]),
  article_id: z.union([z.string(), z.number()]),
  work_date: z.string().min(1),
  quantity: z.coerce.number().positive(),
  notes: z.string().optional(),
});

const filterSchema = z.object({
  employee_id: z.string().optional(),
  customer_id: z.string().optional(),
  article_id: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

export async function create(req, res, next) {
  try {
    const data = createSchema.parse(req.body);
    const employeeId = req.user.role === 'admin' ? req.body.employee_id : req.user.employee_id;
    if (!employeeId) throw new Error('employee_id is required');
    created(res, await workLogService.createWorkLog(employeeId, data));
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const data = createSchema.partial().parse(req.body);
    ok(res, await workLogService.updateWorkLog(req.params.id, req.user.employee_id, req.user.role, data));
  } catch (err) {
    next(err);
  }
}

export async function listAll(req, res, next) {
  try {
    const filters = filterSchema.parse(req.query);
    ok(res, await workLogService.listWorkLogs(filters));
  } catch (err) {
    next(err);
  }
}

export async function listMine(req, res, next) {
  try {
    const filters = filterSchema.parse(req.query);
    filters.employee_id = req.user.employee_id;
    ok(res, await workLogService.listWorkLogs(filters));
  } catch (err) {
    next(err);
  }
}
