import { z } from 'zod';
import * as ownerAssetService from '../services/ownerAssetService.js';
import { ok, created } from '../utils/response.js';

const registerSchema = z.object({
  date: z.string().min(1),
  name: z.string().min(1),
  category_id: z.string().min(1),
  location_id: z.string().min(1),
  description: z.string().optional(),
});

const fundingFields = {
  funding_source: z.enum(['cash', 'payable', 'capital']),
  account_id: z.string().optional(),
  creditor_name: z.string().optional(),
  creditor_address: z.string().optional(),
  due_date: z.string().optional(),
  capital_source_name: z.string().optional(),
  capital_note: z.string().optional(),
};

const buySchema = z.object({
  asset_id: z.string().min(1),
  date: z.string().min(1),
  qty: z.number().positive(),
  unit_price: z.number().nonnegative(),
  ...fundingFields,
});

const sellSchema = z.object({
  asset_id: z.string().min(1),
  date: z.string().min(1),
  qty: z.number().positive(),
  sale_price: z.number().nonnegative().optional(),
  account_id: z.string().min(1),
});

export async function list(req, res, next) {
  try {
    const { search, category_id, location_id, sort } = req.query;
    ok(res, await ownerAssetService.listAssets({ search, category_id, location_id, sort }));
  } catch (err) {
    next(err);
  }
}

export async function getDetail(req, res, next) {
  try {
    ok(res, await ownerAssetService.getAssetDetail(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function register(req, res, next) {
  try {
    created(res, await ownerAssetService.registerAsset(registerSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function buy(req, res, next) {
  try {
    created(res, await ownerAssetService.buyAsset(buySchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function sell(req, res, next) {
  try {
    created(res, await ownerAssetService.sellAsset(sellSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await ownerAssetService.deleteAsset(req.params.id);
    ok(res, { message: 'Aset dihapus' });
  } catch (err) {
    next(err);
  }
}
