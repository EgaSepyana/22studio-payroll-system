import { z } from 'zod';
import * as reportService from '../services/reportService.js';
import * as exportService from '../services/exportService.js';
import { ok } from '../utils/response.js';

const filterSchema = z.object({
  groupBy: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'customer', 'article', 'employee']),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  employee_id: z.string().optional(),
  customer_id: z.string().optional(),
  article_id: z.string().optional(),
});

export async function generate(req, res, next) {
  try {
    const filters = filterSchema.parse(req.query);
    ok(res, await reportService.buildReport(filters));
  } catch (err) {
    next(err);
  }
}

export async function exportReport(req, res, next) {
  try {
    const { format, ...rest } = req.query;
    const filters = filterSchema.parse(rest);
    const report = await reportService.buildReport(filters);

    if (format === 'excel') {
      const buffer = await exportService.reportToExcel(report);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="laporan-${filters.groupBy}.xlsx"`);
      res.send(buffer);
    } else if (format === 'pdf') {
      const buffer = await exportService.reportToPdf(report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="laporan-${filters.groupBy}.pdf"`);
      res.send(buffer);
    } else {
      res.status(400).json({ success: false, message: 'format harus pdf atau excel' });
    }
  } catch (err) {
    next(err);
  }
}
