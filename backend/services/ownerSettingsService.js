import {
  OwnerCategoriesRepo,
  OwnerLocationsRepo,
  OWNER_CATEGORY_TYPES,
  OWNER_COGS_BUCKETS,
} from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';
import * as settingsService from './settingsService.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

// --- Categories (master data feeding every Keuangan module's dropdowns) ---

function enrichCategory(row) {
  return {
    ...clean(row),
    is_active: row.is_active !== 'false',
    is_sales_category: row.is_sales_category === 'true',
    cogs_bucket: row.cogs_bucket || null,
  };
}

export async function listCategories(type) {
  const rows = await OwnerCategoriesRepo.getAll();
  const filtered = type ? rows.filter((c) => c.type === type) : rows;
  return filtered.map(enrichCategory);
}

export async function createCategory({ type, name, is_sales_category, cogs_bucket }) {
  if (!OWNER_CATEGORY_TYPES.includes(type)) throw new ApiError(400, 'Tipe kategori tidak valid');
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new ApiError(400, 'Nama kategori wajib diisi');
  if (cogs_bucket !== undefined && cogs_bucket !== null && !OWNER_COGS_BUCKETS.includes(cogs_bucket)) {
    throw new ApiError(400, 'Kategori HPP tidak valid');
  }

  const row = await OwnerCategoriesRepo.insert({
    type,
    name: trimmed,
    is_active: 'true',
    is_sales_category: String(!!is_sales_category && type === 'income'),
    cogs_bucket: type === 'liability' ? cogs_bucket || 'generic' : '',
    created_at: new Date().toISOString(),
  });
  return enrichCategory(row);
}

export async function updateCategory(id, { name, is_active, is_sales_category, cogs_bucket }) {
  const patch = {};
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) throw new ApiError(400, 'Nama kategori wajib diisi');
    patch.name = trimmed;
  }
  if (is_active !== undefined) patch.is_active = String(!!is_active);
  if (is_sales_category !== undefined) patch.is_sales_category = String(!!is_sales_category);
  if (cogs_bucket !== undefined) {
    if (!OWNER_COGS_BUCKETS.includes(cogs_bucket)) throw new ApiError(400, 'Kategori HPP tidak valid');
    patch.cogs_bucket = cogs_bucket;
  }

  const updated = await OwnerCategoriesRepo.updateById(id, patch);
  if (!updated) throw new ApiError(404, 'Kategori tidak ditemukan');
  return enrichCategory(updated);
}

export async function deleteCategory(id) {
  const deleted = await OwnerCategoriesRepo.deleteById(id);
  if (!deleted) throw new ApiError(404, 'Kategori tidak ditemukan');
}

// --- Locations (shared across Aset/Stok Persediaan) ---

export async function listLocations() {
  const rows = await OwnerLocationsRepo.getAll();
  return rows.map((l) => ({ ...clean(l), is_active: l.is_active !== 'false' }));
}

export async function createLocation({ name }) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new ApiError(400, 'Nama lokasi wajib diisi');
  const row = await OwnerLocationsRepo.insert({ name: trimmed, is_active: 'true', created_at: new Date().toISOString() });
  return { ...clean(row), is_active: true };
}

export async function updateLocation(id, { name, is_active }) {
  const patch = {};
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) throw new ApiError(400, 'Nama lokasi wajib diisi');
    patch.name = trimmed;
  }
  if (is_active !== undefined) patch.is_active = String(!!is_active);

  const updated = await OwnerLocationsRepo.updateById(id, patch);
  if (!updated) throw new ApiError(404, 'Lokasi tidak ditemukan');
  return { ...clean(updated), is_active: updated.is_active !== 'false' };
}

export async function deleteLocation(id) {
  const deleted = await OwnerLocationsRepo.deleteById(id);
  if (!deleted) throw new ApiError(404, 'Lokasi tidak ditemukan');
}

// --- Business profile (AppSettings key/value, same pattern as
// settingsService's getBankAccountText/setBankAccountText) ---

const BUSINESS_SETTINGS_KEYS = {
  name: 'owner_business_name',
  address: 'owner_business_address',
  phone: 'owner_business_phone',
  monthly_revenue_target: 'owner_business_monthly_revenue_target',
  daily_target: 'owner_business_daily_target',
  monthly_target: 'owner_business_monthly_target',
  notes: 'owner_business_notes',
  logo_url: 'owner_business_logo_url',
  owner_name: 'owner_business_owner_name',
  admin_name: 'owner_business_admin_name',
};

export async function getBusinessSettings() {
  const entries = await Promise.all(
    Object.entries(BUSINESS_SETTINGS_KEYS).map(async ([field, key]) => [field, await settingsService.getSettingValue(key)])
  );
  return Object.fromEntries(entries);
}

export async function updateBusinessSettings(patch) {
  for (const [field, value] of Object.entries(patch)) {
    const key = BUSINESS_SETTINGS_KEYS[field];
    if (!key) continue;
    await settingsService.setSettingValue(key, value ?? '');
  }
  return getBusinessSettings();
}
