import { z } from 'zod';
import * as ownerCashService from '../services/ownerCashService.js';
import { ok, created } from '../utils/response.js';

const accountSchema = z.object({ name: z.string().min(1) });
const updateAccountSchema = z.object({ name: z.string().min(1).optional(), is_active: z.boolean().optional() });

const transferSchema = z.object({
  date: z.string().min(1),
  from_account_id: z.string().min(1),
  to_account_id: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().optional(),
});
const updateTransferSchema = transferSchema.partial();

const reconciliationSchema = z.object({
  date: z.string().min(1),
  account_id: z.string().min(1),
  actual_balance: z.number(),
  description: z.string().optional(),
});

export async function listAccounts(req, res, next) {
  try {
    ok(res, await ownerCashService.listAccounts());
  } catch (err) {
    next(err);
  }
}

export async function createAccount(req, res, next) {
  try {
    created(res, await ownerCashService.createAccount(accountSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function updateAccount(req, res, next) {
  try {
    ok(res, await ownerCashService.updateAccount(req.params.id, updateAccountSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function removeAccount(req, res, next) {
  try {
    await ownerCashService.deleteAccount(req.params.id);
    ok(res, { message: 'Akun kas dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function getBalances(req, res, next) {
  try {
    ok(res, await ownerCashService.getAccountBalances());
  } catch (err) {
    next(err);
  }
}

export async function listTransfers(req, res, next) {
  try {
    ok(res, await ownerCashService.listTransfers());
  } catch (err) {
    next(err);
  }
}

export async function createTransfer(req, res, next) {
  try {
    created(res, await ownerCashService.createTransfer(transferSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function updateTransfer(req, res, next) {
  try {
    ok(res, await ownerCashService.updateTransfer(req.params.id, updateTransferSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function removeTransfer(req, res, next) {
  try {
    await ownerCashService.deleteTransfer(req.params.id);
    ok(res, { message: 'Mutasi kas dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function listReconciliations(req, res, next) {
  try {
    ok(res, await ownerCashService.listReconciliations());
  } catch (err) {
    next(err);
  }
}

export async function previewSystemBalance(req, res, next) {
  try {
    ok(res, await ownerCashService.previewSystemBalance(req.query.account_id));
  } catch (err) {
    next(err);
  }
}

export async function createReconciliation(req, res, next) {
  try {
    created(res, await ownerCashService.createReconciliation(reconciliationSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function removeReconciliation(req, res, next) {
  try {
    await ownerCashService.deleteReconciliation(req.params.id);
    ok(res, { message: 'Penyesuaian kas dihapus' });
  } catch (err) {
    next(err);
  }
}
