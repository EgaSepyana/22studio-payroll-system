import { z } from 'zod';
import * as workLogService from '../services/workLogService.js';
import * as workLogExportService from '../services/workLogExportService.js';
import { WORK_STATUSES, DIVISIONS } from '../google-sheet/models.js';
import { ok, created } from '../utils/response.js';

const createSchema = z.object({
  employee_id: z.union([z.string(), z.number()]).optional(),
  task_id: z.union([z.string(), z.number()]),
  article_id: z.union([z.string(), z.number()]),
  work_date: z.string().min(1),
  quantity: z.coerce.number().positive(),
  notes: z.string().optional(),
  status: z.enum(WORK_STATUSES).optional(),
});

const filterSchema = z.object({
  employee_id: z.string().optional(),
  customer_id: z.string().optional(),
  article_id: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  divisi: z.enum(DIVISIONS).optional(),
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

export async function remove(req, res, next) {
  try {
    await workLogService.deleteWorkLog(req.params.id);
    ok(res, { message: 'Pekerjaan dihapus' });
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

export async function exportWorkLogs(req, res, next) {
  try {
    const { format, ...rest } = req.query;
    const filters = filterSchema.parse(rest);
    const logs = await workLogService.listWorkLogs(filters);

    if (format === 'excel') {
      const buffer = await workLogExportService.workLogsToExcel(logs);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="slip-gaji.xlsx"');
      res.send(buffer);
    } else if (format === 'pdf') {
      const buffer = await workLogExportService.workLogsToPdf(logs);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="slip-gaji.pdf"');
      res.send(buffer);
    } else {
      res.status(400).json({ success: false, message: 'format harus pdf atau excel' });
    }
  } catch (err) {
    next(err);
  }
}
