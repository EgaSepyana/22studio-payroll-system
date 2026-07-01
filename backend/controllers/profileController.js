import { z } from 'zod';
import * as profileService from '../services/profileService.js';
import { ok } from '../utils/response.js';

const updateSchema = z.object({ phone: z.string().min(1) });

export async function getMe(req, res, next) {
  try {
    ok(res, await profileService.getProfile(req.user));
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req, res, next) {
  try {
    const { phone } = updateSchema.parse(req.body);
    ok(res, await profileService.updatePhone(req.user, phone));
  } catch (err) {
    next(err);
  }
}
