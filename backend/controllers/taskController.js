import { z } from 'zod';
import * as taskService from '../services/taskService.js';
import { DIVISIONS, TASK_STATUSES } from '../google-sheet/models.js';
import { ok, created } from '../utils/response.js';

const createSchema = z.object({
  order_id: z.union([z.string(), z.number()]),
  divisi: z.enum(DIVISIONS),
  description: z.string().optional(),
  target_qty: z.coerce.number().positive(),
});

const updateSchema = z.object({
  divisi: z.enum(DIVISIONS).optional(),
  description: z.string().optional(),
  target_qty: z.coerce.number().positive().optional(),
});

const filterSchema = z.object({
  order_id: z.string().optional(),
  divisi: z.enum(DIVISIONS).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  assigned_to: z.string().optional(),
});

const progressSchema = z.object({
  quantity: z.coerce.number().positive(),
  employee_id: z.union([z.string(), z.number()]).optional(),
});

export async function create(req, res, next) {
  try {
    created(res, await taskService.createTask(createSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    ok(res, await taskService.listTasks(filterSchema.parse(req.query)));
  } catch (err) {
    next(err);
  }
}

export async function listAvailable(req, res, next) {
  try {
    ok(res, await taskService.listAvailableTasks(req.user.divisi));
  } catch (err) {
    next(err);
  }
}

export async function listMine(req, res, next) {
  try {
    ok(res, await taskService.listTasks({ assigned_to: req.user.employee_id }));
  } catch (err) {
    next(err);
  }
}

export async function detail(req, res, next) {
  try {
    ok(res, await taskService.getTaskDetail(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    ok(res, await taskService.updateTask(req.params.id, updateSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await taskService.deleteTask(req.params.id);
    ok(res, { message: 'Task dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function addProgress(req, res, next) {
  try {
    const { quantity, employee_id } = progressSchema.parse(req.body);
    const employeeId = req.user.role === 'admin' ? employee_id : req.user.employee_id;
    if (!employeeId) throw new Error('employee_id is required');
    ok(res, await taskService.addTaskProgress(req.params.id, employeeId, quantity));
  } catch (err) {
    next(err);
  }
}
