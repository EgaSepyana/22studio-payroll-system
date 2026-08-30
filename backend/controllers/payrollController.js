import { z } from 'zod';
import * as payrollService from '../services/payrollService.js';
import * as workLogExportService from '../services/workLogExportService.js';
import { DIVISIONS } from '../google-sheet/models.js';
import { ok } from '../utils/response.js';

const filterSchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000),
  employee_id: z.string().optional(),
  divisi: z.enum(DIVISIONS).optional(),
});

const exportSchema = z.object({
  id: z.string().optional(),
  month: z.coerce.number().min(1).max(12).optional(),
  year: z.coerce.number().min(2000).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  employee_id: z.string().optional(),
  divisi: z.enum(DIVISIONS).optional(),
  format: z.enum(['pdf', 'excel']),
});

const rangeFilterSchema = z.object({
  date_from: z.string().min(1),
  date_to: z.string().min(1),
  employee_id: z.string().optional(),
  divisi: z.enum(DIVISIONS).optional(),
});

const markRangePaidSchema = rangeFilterSchema.extend({
  account_id: z.string().min(1),
});

const markPaidSchema = z.object({
  kasbon_deduction: z.coerce.number().min(0).optional(),
  account_id: z.string().min(1),
});

export async function list(req, res, next) {
  try {
    const { month, year, employee_id, divisi } = filterSchema.parse(req.query);
    ok(res, await payrollService.getOrGeneratePayroll(month, year, employee_id, divisi));
  } catch (err) {
    next(err);
  }
}

export async function listRange(req, res, next) {
  try {
    const { date_from, date_to, employee_id, divisi } = rangeFilterSchema.parse(req.query);
    ok(res, await payrollService.getOrGeneratePayrollForRange(date_from, date_to, employee_id, divisi));
  } catch (err) {
    next(err);
  }
}

export async function markRangePaid(req, res, next) {
  try {
    const { date_from, date_to, employee_id, divisi, account_id } = markRangePaidSchema.parse(req.body);
    ok(res, await payrollService.markRangeAsPaid(date_from, date_to, employee_id, divisi, req.user.id, account_id));
  } catch (err) {
    next(err);
  }
}

export async function exportPaid(req, res, next) {
  try {
    const { format, ...filters } = exportSchema.parse(req.query);
    const rows = await payrollService.listPaidPayrollForExport(filters);

    if (format === 'excel') {
      const buffer = await workLogExportService.payrollToExcel(rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="slip-gaji-payroll.xlsx"');
      res.send(buffer);
    } else {
      const buffer = await workLogExportService.payrollToPdf(rows);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="slip-gaji-payroll.pdf"');
      res.send(buffer);
    }
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
    const { kasbon_deduction, account_id } = markPaidSchema.parse(req.body || {});
    ok(res, await payrollService.markAsPaid(req.params.id, req.user.id, kasbon_deduction, account_id));
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
