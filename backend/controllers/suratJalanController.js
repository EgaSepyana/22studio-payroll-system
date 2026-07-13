import { z } from 'zod';
import * as suratJalanService from '../services/suratJalanService.js';
import * as suratJalanExportService from '../services/suratJalanExportService.js';
import { ok, created } from '../utils/response.js';

const headerSchema = z.object({
  customer_id: z.union([z.string(), z.number()]),
  penerima_nama: z.string().optional(),
  penerima_telepon: z.string().optional(),
  penerima_alamat: z.string().optional(),
});

const headerUpdateSchema = z.object({
  customer_id: z.union([z.string(), z.number()]).optional(),
  penerima_nama: z.string().optional(),
  penerima_telepon: z.string().optional(),
  penerima_alamat: z.string().optional(),
});

const itemSchema = z.object({
  nama_item: z.string().min(1),
  harga: z.coerce.number().min(0),
  qty: z.coerce.number().positive(),
});

const itemUpdateSchema = z.object({
  nama_item: z.string().min(1).optional(),
  harga: z.coerce.number().min(0).optional(),
  qty: z.coerce.number().positive().optional(),
});

const filterSchema = z.object({
  customer_id: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

export async function create(req, res, next) {
  try {
    created(res, await suratJalanService.createSuratJalan(headerSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    ok(res, await suratJalanService.listSuratJalan(filterSchema.parse(req.query)));
  } catch (err) {
    next(err);
  }
}

export async function detail(req, res, next) {
  try {
    ok(res, await suratJalanService.getSuratJalanDetail(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    ok(res, await suratJalanService.updateSuratJalan(req.params.id, headerUpdateSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await suratJalanService.deleteSuratJalan(req.params.id);
    ok(res, { message: 'Surat Jalan dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function pdf(req, res, next) {
  try {
    const data = await suratJalanService.getSuratJalanDetail(req.params.id);
    const buffer = await suratJalanExportService.suratJalanToPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${data.no_document}.pdf"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function addItem(req, res, next) {
  try {
    created(res, await suratJalanService.addSuratJalanItem(req.params.id, itemSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function updateItem(req, res, next) {
  try {
    ok(
      res,
      await suratJalanService.updateSuratJalanItem(req.params.id, req.params.itemId, itemUpdateSchema.parse(req.body))
    );
  } catch (err) {
    next(err);
  }
}

export async function removeItem(req, res, next) {
  try {
    await suratJalanService.deleteSuratJalanItem(req.params.id, req.params.itemId);
    ok(res, { message: 'Item dihapus' });
  } catch (err) {
    next(err);
  }
}
