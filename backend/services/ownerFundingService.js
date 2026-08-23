// Shared "funding source" branch (Cash / Payable / Capital) used by both
// Aset purchases and Stok Persediaan stock-in — owner.md §4.5/§4.6 describe
// the exact same three-way branch twice; this is the one implementation
// both call into instead of two copies.
import { OwnerCashAccountsRepo, OwnerCategoriesRepo, OwnerCapitalEntriesRepo } from '../google-sheet/models.js';
import { generateSequentialCode } from './codeGeneratorService.js';
import * as ownerLiabilityService from './ownerLiabilityService.js';
import { ApiError } from '../utils/response.js';

// Payable-funded purchases don't have a UI-selected liability category —
// owner.md just says "creates a matching Liability record" — so this picks
// the first active liability-type category as a sensible default. A real
// deployment should make sure at least one exists (Settings seeds none by
// default), same expectation as every other master-data dropdown.
async function defaultLiabilityCategoryId() {
  const categories = await OwnerCategoriesRepo.getAll();
  const fallback = categories.find((c) => c.type === 'liability' && c.is_active !== 'false');
  if (!fallback) {
    throw new ApiError(400, 'Belum ada kategori kewajiban aktif — tambahkan di Pengaturan Keuangan terlebih dahulu');
  }
  return fallback.id;
}

// `refType`/`refId` are purely for traceability (which asset/inventory
// transaction this funding call was for) — never read back to compute a
// balance.
export async function applyFunding({
  fundingSource,
  value,
  date,
  description,
  accountId,
  creditorName,
  creditorAddress,
  dueDate,
  capitalSourceName,
  capitalNote,
  refType,
}) {
  if (fundingSource === 'cash') {
    if (!accountId) throw new ApiError(400, 'Akun kas wajib dipilih');
    const accounts = await OwnerCashAccountsRepo.getAll();
    if (!accounts.some((a) => String(a.id) === String(accountId))) throw new ApiError(400, 'Akun kas tidak valid');
    return { accountId, liabilityId: null, capitalEntryId: null };
  }

  if (fundingSource === 'payable') {
    if (!creditorName) throw new ApiError(400, 'Nama kreditur wajib diisi untuk pembelian kredit');
    const categoryId = await defaultLiabilityCategoryId();
    const liability = await ownerLiabilityService.createLiability({
      date,
      due_date: dueDate,
      creditor_name: creditorName,
      creditor_address: creditorAddress,
      category_id: categoryId,
      qty: 1,
      unit_price: value,
      description,
      // No COGS entry here — the purchased asset/inventory already
      // represents this cost on the books; recognizing it again via COGS
      // would double-count against equity. See createLiability's comment.
      source: 'funding',
    });
    return { accountId: null, liabilityId: liability.id, capitalEntryId: null };
  }

  if (fundingSource === 'capital') {
    if (!capitalSourceName) throw new ApiError(400, 'Sumber modal wajib diisi');
    const code = await generateSequentialCode(OwnerCapitalEntriesRepo, 'code', 'MDL');
    const entry = await OwnerCapitalEntriesRepo.insert({
      code,
      date,
      source_name: capitalSourceName,
      description: capitalNote || description || '',
      amount: value,
      entry_type: refType,
      ref_type: refType,
      ref_id: '',
      created_at: new Date().toISOString(),
    });
    return { accountId: null, liabilityId: null, capitalEntryId: entry.id };
  }

  throw new ApiError(400, 'Sumber dana tidak valid');
}
