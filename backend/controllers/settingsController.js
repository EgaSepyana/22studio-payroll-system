import { z } from 'zod';
import * as settingsService from '../services/settingsService.js';
import { ok } from '../utils/response.js';

const bankAccountSchema = z.object({
  value: z.string(),
});

const templateUpdateSchema = z.object({
  label: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
});

export async function getBankAccount(req, res, next) {
  try {
    ok(res, { value: await settingsService.getBankAccountText() });
  } catch (err) {
    next(err);
  }
}

export async function updateBankAccount(req, res, next) {
  try {
    const { value } = bankAccountSchema.parse(req.body);
    ok(res, { value: await settingsService.setBankAccountText(value) });
  } catch (err) {
    next(err);
  }
}

export async function listWATemplates(req, res, next) {
  try {
    ok(res, await settingsService.listWATemplates());
  } catch (err) {
    next(err);
  }
}

export async function updateWATemplate(req, res, next) {
  try {
    ok(res, await settingsService.updateWATemplate(req.params.templateKey, templateUpdateSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}
