import * as ownerDashboardService from '../services/ownerDashboardService.js';
import { ok } from '../utils/response.js';

export async function getDashboard(req, res, next) {
  try {
    ok(res, await ownerDashboardService.getDashboard());
  } catch (err) {
    next(err);
  }
}
