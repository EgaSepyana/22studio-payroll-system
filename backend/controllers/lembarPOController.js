import { z } from 'zod';
import * as lembarPOService from '../services/lembarPOService.js';
import * as lembarPOExportService from '../services/lembarPOExportService.js';
import { ok, created } from '../utils/response.js';

const createSchema = z.object({
  order_id: z.union([z.string(), z.number()]),
  sablon_bordir: z.string().optional(),
  catatan: z.string().optional(),
  label: z.boolean().optional(),
  bahan_tipe: z.string().optional(),
  pola_potong: z.string().optional(),
  hangtag: z.boolean().optional(),
});

const updateSchema = z.object({
  order_id: z.union([z.string(), z.number()]).optional(),
  sablon_bordir: z.string().optional(),
  catatan: z.string().optional(),
  label: z.boolean().optional(),
  bahan_tipe: z.string().optional(),
  pola_potong: z.string().optional(),
  hangtag: z.boolean().optional(),
});

export async function create(req, res, next) {
  try {
    created(res, await lembarPOService.createLembarPO(createSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    ok(res, await lembarPOService.listLembarPO());
  } catch (err) {
    next(err);
  }
}

export async function detail(req, res, next) {
  try {
    ok(res, await lembarPOService.getLembarPODetail(req.params.id));
  } catch (err) {
    next(err);
  }
}

// Employee-facing "Lihat Lembar PO": looked up by order_id (from the task
// they selected), returning the same full order/items/sizes shape the PDF
// export uses so the frontend can render an equivalent preview.
export async function detailByOrder(req, res, next) {
  try {
    ok(res, await lembarPOService.getLembarPOForOrder(req.params.orderId));
  } catch (err) {
    next(err);
  }
}

// Lightweight existence check for the Tugas page's task cards — returns
// which order_ids have a Lembar PO so the "Lihat PO" button can show/hide
// per card from one request instead of one lookup per task.
export async function orderIdsWithLembarPO(req, res, next) {
  try {
    ok(res, await lembarPOService.listOrderIdsWithLembarPO());
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    ok(res, await lembarPOService.updateLembarPO(req.params.id, updateSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await lembarPOService.deleteLembarPO(req.params.id);
    ok(res, { message: 'Lembar PO dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function pdf(req, res, next) {
  try {
    const data = await lembarPOService.getLembarPOForPrint(req.params.id);
    const buffer = await lembarPOExportService.lembarPOToPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Lembar PO - ${data.order.invoice_no}.pdf"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}
