import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UsersRepo, EmployeesRepo } from '../google-sheet/models.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/response.js';

// Display name for standalone (non-Employee-linked) roles — employee-linked
// users always get their real name from the Employees row instead (see
// login() below), this only ever applies to admin/admin_produksi/owner.
const STANDALONE_ROLE_NAMES = {
  admin: 'Admin',
  admin_produksi: 'Admin Produksi',
  owner: 'Owner',
};

function signToken(user, profile) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      employee_id: user.employee_id || null,
      divisi: profile?.divisi || null,
    },
    env.jwtSecret,
    { expiresIn: '12h' }
  );
}

export async function login(username, password) {
  const users = await UsersRepo.getAll({ fresh: true });
  const user = users.find((u) => u.username === username);
  if (!user) throw new ApiError(401, 'Username atau password salah');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new ApiError(401, 'Username atau password salah');

  let profile = null;
  if (user.role === 'employee' && user.employee_id) {
    profile = await EmployeesRepo.getById(user.employee_id);
    if (profile && profile.status !== 'active') {
      throw new ApiError(403, 'Akun karyawan tidak aktif');
    }
  }

  const token = signToken(user, profile);
  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      employee_id: user.employee_id || null,
      name: profile?.name || STANDALONE_ROLE_NAMES[user.role] || user.username,
      phone: profile?.phone || null,
      divisi: profile?.divisi || null,
    },
  };
}

export async function changePassword(userId, oldPassword, newPassword) {
  const user = await UsersRepo.getById(userId);
  if (!user) throw new ApiError(404, 'User tidak ditemukan');

  const valid = await bcrypt.compare(oldPassword, user.password);
  if (!valid) throw new ApiError(400, 'Password lama tidak sesuai');

  const hash = await bcrypt.hash(newPassword, 10);
  await UsersRepo.updateById(userId, { password: hash });
}
