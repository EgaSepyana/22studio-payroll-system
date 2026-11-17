import { z } from 'zod';
import * as hppService from '../services/hppService.js';
import { ok, created } from '../utils/response.js';

const text = (max) => z.string().trim().max(max);
const money = z.coerce.number().min(0).max(1e12);

export const fabricSchema = z.object({
  name: text(200).min(1, 'Nama bahan wajib diisi'),
  color: text(200).default(''),
  supplier: text(200).default(''),
  price: money,
  gsm: z.coerce.number().min(0).max(10000).default(0),
  date: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')]).default(''),
  note: text(500).default(''),
});

export const threadSchema = z.object({
  brand: text(200).min(1, 'Merek wajib diisi'),
  code: text(100).min(1, 'Kode warna wajib diisi'),
  name: text(200).default(''),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use #RRGGBB').default('#222222'),
  price: money,
  yield: z.coerce.number().positive().max(1e9),
  note: text(500).default(''),
});

export const CALCULATION_TABS = ['kaos', 'produk', 'sablon', 'gabung'];

export const calculationSchema = z.object({
  tab: z.enum(CALCULATION_TABS),
  name: text(200).default(''),
  qty: z.coerce.number().int().min(1).max(1e8),
  hpp: z.number().min(0).max(1e13),
  total: z.number().min(0).max(1e16),
  sale: z.number().min(0).max(1e13),
  // The calculator's own input state; the service enforces the size limit.
  data: z.object({ version: z.literal(1) }).passthrough(),
});

function handler(fn, status = ok) {
  return async (req, res, next) => {
    try {
      status(res, await fn(req));
    } catch (err) {
      next(err);
    }
  };
}

export const listFabrics = handler(() => hppService.listFabrics());
export const createFabric = handler((req) => hppService.createFabric(fabricSchema.parse(req.body)), created);
export const updateFabric = handler((req) => hppService.updateFabric(req.params.id, fabricSchema.parse(req.body)));
export const removeFabric = handler(async (req) => {
  await hppService.deleteFabric(req.params.id);
  return { message: 'Bahan dihapus' };
});

export const listThreads = handler(() => hppService.listThreads());
export const createThread = handler((req) => hppService.createThread(threadSchema.parse(req.body)), created);
export const updateThread = handler((req) => hppService.updateThread(req.params.id, threadSchema.parse(req.body)));
export const removeThread = handler(async (req) => {
  await hppService.deleteThread(req.params.id);
  return { message: 'Kode benang dihapus' };
});

export const listCalculations = handler(() => hppService.listCalculations());
export const getCalculation = handler((req) => hppService.getCalculation(req.params.id));
export const createCalculation = handler(
  (req) => hppService.createCalculation(calculationSchema.parse(req.body), { username: req.user.username }),
  created
);
export const removeCalculation = handler(async (req) => {
  await hppService.deleteCalculation(req.params.id);
  return { message: 'Perhitungan dihapus' };
});
