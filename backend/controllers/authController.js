import { z } from 'zod';
import * as authService from '../services/authService.js';
import { ok } from '../utils/response.js';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export async function loginHandler(req, res, next) {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const result = await authService.login(username, password);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export function logoutHandler(req, res) {
  ok(res, { message: 'Logged out' });
}

export async function changePasswordHandler(req, res, next) {
  try {
    const { oldPassword, newPassword } = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.user.id, oldPassword, newPassword);
    ok(res, { message: 'Password updated' });
  } catch (err) {
    next(err);
  }
}

export function meHandler(req, res) {
  ok(res, req.user);
}
