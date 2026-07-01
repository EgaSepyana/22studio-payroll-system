import * as dashboardService from '../services/dashboardService.js';
import { ok } from '../utils/response.js';

export async function admin(req, res, next) {
  try {
    ok(res, await dashboardService.getAdminDashboard());
  } catch (err) {
    next(err);
  }
}

export async function employee(req, res, next) {
  try {
    ok(res, await dashboardService.getEmployeeDashboard(req.user.employee_id));
  } catch (err) {
    next(err);
  }
}
