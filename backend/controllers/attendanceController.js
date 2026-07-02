import { z } from 'zod';
import * as attendanceService from '../services/attendanceService.js';
import { DIVISIONS } from '../google-sheet/models.js';
import { ok, created } from '../utils/response.js';

const filterSchema = z.object({
  employee_id: z.union([z.string(), z.number()]).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  divisi: z.enum(DIVISIONS).optional(),
});

const createSchema = z.object({
  employee_id: z.union([z.string(), z.number()]),
  date: z.string().min(1),
  check_in: z.string().optional(),
  check_out: z.string().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  date: z.string().min(1).optional(),
  check_in: z.string().optional(),
  check_out: z.string().optional(),
  notes: z.string().optional(),
});

export async function checkIn(req, res, next) {
  try {
    created(res, await attendanceService.checkIn(req.user.employee_id));
  } catch (err) {
    next(err);
  }
}

export async function checkOut(req, res, next) {
  try {
    ok(res, await attendanceService.checkOut(req.user.employee_id));
  } catch (err) {
    next(err);
  }
}

export async function today(req, res, next) {
  try {
    ok(res, await attendanceService.getTodayStatus(req.user.employee_id));
  } catch (err) {
    next(err);
  }
}

export async function mine(req, res, next) {
  try {
    const filters = filterSchema.parse(req.query);
    ok(res, await attendanceService.listAttendance({ ...filters, employee_id: req.user.employee_id }));
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const filters = filterSchema.parse(req.query);
    ok(res, await attendanceService.listAttendance(filters));
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    created(res, await attendanceService.createAttendance(createSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    ok(res, await attendanceService.updateAttendance(req.params.id, updateSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await attendanceService.deleteAttendance(req.params.id);
    ok(res, { message: 'Absensi dihapus' });
  } catch (err) {
    next(err);
  }
}
