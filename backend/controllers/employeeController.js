import { z } from 'zod';
import * as employeeService from '../services/employeeService.js';
import { DIVISIONS } from '../google-sheet/models.js';
import { ok, created } from '../utils/response.js';

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  status: z.enum(['active', 'inactive']).optional(),
  username: z.string().min(3),
  password: z.string().min(6),
  divisi: z.enum(DIVISIONS).optional(),
  hourly_rate: z.coerce.number().nonnegative().optional(),
  upah_lembur_per_jam: z.coerce.number().nonnegative().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  username: z.string().min(3).optional(),
  password: z.string().min(6).optional(),
  divisi: z.enum(DIVISIONS).optional(),
  hourly_rate: z.coerce.number().nonnegative().optional(),
  upah_lembur_per_jam: z.coerce.number().nonnegative().optional(),
});

export async function list(req, res, next) {
  try {
    ok(res, await employeeService.listEmployees());
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    ok(res, await employeeService.getEmployee(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const data = createSchema.parse(req.body);
    created(res, await employeeService.createEmployee(data));
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const data = updateSchema.parse(req.body);
    ok(res, await employeeService.updateEmployee(req.params.id, data));
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await employeeService.deleteEmployee(req.params.id);
    ok(res, { message: 'Karyawan dihapus' });
  } catch (err) {
    next(err);
  }
}
