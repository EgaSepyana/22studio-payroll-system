import { HppFabricsRepo, HppThreadsRepo, HppCalculationsRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';

// Google Sheets caps a cell at 50,000 characters; stay well under it.
export const MAX_CALCULATION_DATA_LENGTH = 40000;
export const CALCULATION_LIST_LIMIT = 50;

const byText = (key) => (a, b) => a[key].localeCompare(b[key], 'id', { sensitivity: 'base' });

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toFabric(row) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    supplier: row.supplier,
    price: num(row.price),
    gsm: num(row.gsm),
    date: row.date,
    note: row.note,
  };
}

function toThread(row) {
  return {
    id: row.id,
    brand: row.brand,
    code: row.code,
    name: row.name,
    hex: row.hex || '#eeeeee',
    price: num(row.price),
    yield: num(row.yield),
    note: row.note,
  };
}

function toCalculationSummary(row) {
  return {
    id: row.id,
    created_at: row.created_at,
    created_by: row.created_by,
    tab: row.tab,
    name: row.name,
    qty: num(row.qty),
    hpp: num(row.hpp),
    total: num(row.total),
    sale: num(row.sale),
  };
}

// ---- Bahan (fabrics) ---------------------------------------------------------

export async function listFabrics() {
  return (await HppFabricsRepo.getAll()).map(toFabric).sort(byText('name'));
}

export async function createFabric(input) {
  return toFabric(await HppFabricsRepo.insert(input));
}

export async function updateFabric(id, input) {
  const updated = await HppFabricsRepo.updateById(id, input);
  if (!updated) throw new ApiError(404, 'Bahan tidak ditemukan');
  return toFabric(updated);
}

export async function deleteFabric(id) {
  if (!(await HppFabricsRepo.deleteById(id))) throw new ApiError(404, 'Bahan tidak ditemukan');
}

// ---- Kode warna benang (threads) ----------------------------------------------

async function assertThreadUnique({ brand, code }, ownId) {
  const clash = (await HppThreadsRepo.getAll({ fresh: true })).some(
    (t) =>
      String(t.id) !== String(ownId) &&
      t.brand.trim().toLowerCase() === brand.toLowerCase() &&
      t.code.trim().toLowerCase() === code.toLowerCase()
  );
  if (clash) throw new ApiError(400, 'Kombinasi merek dan kode benang sudah ada');
}

export async function listThreads() {
  return (await HppThreadsRepo.getAll()).map(toThread).sort(byText('brand'));
}

export async function createThread(input) {
  await assertThreadUnique(input);
  return toThread(await HppThreadsRepo.insert(input));
}

export async function updateThread(id, input) {
  await assertThreadUnique(input, id);
  const updated = await HppThreadsRepo.updateById(id, input);
  if (!updated) throw new ApiError(404, 'Kode benang tidak ditemukan');
  return toThread(updated);
}

export async function deleteThread(id) {
  if (!(await HppThreadsRepo.deleteById(id))) throw new ApiError(404, 'Kode benang tidak ditemukan');
}

// ---- Riwayat perhitungan -----------------------------------------------------

// Newest first, summaries only; the saved input state is fetched per item.
export async function listCalculations() {
  return (await HppCalculationsRepo.getAll())
    .map(toCalculationSummary)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
    .slice(0, CALCULATION_LIST_LIMIT);
}

export async function createCalculation({ tab, name, qty, hpp, total, sale, data }, { username }) {
  const json = JSON.stringify(data);
  if (json.length > MAX_CALCULATION_DATA_LENGTH) throw new ApiError(400, 'Data perhitungan terlalu besar');
  const row = await HppCalculationsRepo.insert({
    created_at: new Date().toISOString(),
    created_by: username,
    tab,
    name,
    qty,
    hpp,
    total,
    sale,
    data: json,
  });
  return toCalculationSummary(row);
}

export async function getCalculation(id) {
  const row = await HppCalculationsRepo.getById(id);
  if (!row) throw new ApiError(404, 'Perhitungan tidak ditemukan');
  let data = null;
  try {
    data = JSON.parse(row.data);
  } catch {
    data = null;
  }
  return { ...toCalculationSummary(row), data };
}

export async function deleteCalculation(id) {
  if (!(await HppCalculationsRepo.deleteById(id))) throw new ApiError(404, 'Perhitungan tidak ditemukan');
}
