import { z } from 'zod';
import * as ownerSettingsService from '../services/ownerSettingsService.js';
import { OWNER_CATEGORY_TYPES, OWNER_COGS_BUCKETS } from '../google-sheet/models.js';
import { ok, created } from '../utils/response.js';

const createCategorySchema = z.object({
  type: z.enum(OWNER_CATEGORY_TYPES),
  name: z.string().min(1),
  is_sales_category: z.boolean().optional(),
  cogs_bucket: z.enum(OWNER_COGS_BUCKETS).optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
  is_sales_category: z.boolean().optional(),
  cogs_bucket: z.enum(OWNER_COGS_BUCKETS).optional(),
});

const locationSchema = z.object({
  name: z.string().min(1),
});

const updateLocationSchema = z.object({
  name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
});

const businessSettingsSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  monthly_revenue_target: z.string().optional(),
  daily_target: z.string().optional(),
  monthly_target: z.string().optional(),
  notes: z.string().optional(),
  logo_url: z.string().optional(),
  owner_name: z.string().optional(),
  admin_name: z.string().optional(),
});

export async function listCategories(req, res, next) {
  try {
    ok(res, await ownerSettingsService.listCategories(req.query.type));
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req, res, next) {
  try {
    created(res, await ownerSettingsService.createCategory(createCategorySchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function updateCategory(req, res, next) {
  try {
    ok(res, await ownerSettingsService.updateCategory(req.params.id, updateCategorySchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function removeCategory(req, res, next) {
  try {
    await ownerSettingsService.deleteCategory(req.params.id);
    ok(res, { message: 'Kategori dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function listLocations(req, res, next) {
  try {
    ok(res, await ownerSettingsService.listLocations());
  } catch (err) {
    next(err);
  }
}

export async function createLocation(req, res, next) {
  try {
    created(res, await ownerSettingsService.createLocation(locationSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function updateLocation(req, res, next) {
  try {
    ok(res, await ownerSettingsService.updateLocation(req.params.id, updateLocationSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function removeLocation(req, res, next) {
  try {
    await ownerSettingsService.deleteLocation(req.params.id);
    ok(res, { message: 'Lokasi dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function getBusinessSettings(req, res, next) {
  try {
    ok(res, await ownerSettingsService.getBusinessSettings());
  } catch (err) {
    next(err);
  }
}

export async function updateBusinessSettings(req, res, next) {
  try {
    ok(res, await ownerSettingsService.updateBusinessSettings(businessSettingsSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}
