import { AppSettingsRepo, WATemplatesRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';

const BANK_ACCOUNT_KEY = 'rekening_bank';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

// AppSettings is a generic key/value store — get/setSetting upserts by key
// rather than requiring callers to know a row id, since there's always at
// most one row per key.
async function getSettingValue(key) {
  const rows = await AppSettingsRepo.getAll();
  return rows.find((r) => r.key === key)?.value || '';
}

async function setSettingValue(key, value) {
  const rows = await AppSettingsRepo.getAll({ fresh: true });
  const existing = rows.find((r) => r.key === key);
  if (existing) {
    await AppSettingsRepo.updateById(existing.id, { value });
  } else {
    await AppSettingsRepo.insert({ key, value });
  }
}

export async function getBankAccountText() {
  return getSettingValue(BANK_ACCOUNT_KEY);
}

export async function setBankAccountText(value) {
  await setSettingValue(BANK_ACCOUNT_KEY, value || '');
  return getBankAccountText();
}

export async function listWATemplates() {
  const rows = await WATemplatesRepo.getAll();
  return rows.map(clean);
}

export async function updateWATemplate(templateKey, { label, content }) {
  const rows = await WATemplatesRepo.getAll({ fresh: true });
  const existing = rows.find((r) => r.template_key === templateKey);
  if (!existing) throw new ApiError(404, 'Template tidak ditemukan');

  const patch = {};
  if (label !== undefined) patch.label = label;
  if (content !== undefined) patch.content = content;

  const updated = await WATemplatesRepo.updateById(existing.id, patch);
  return clean(updated);
}
