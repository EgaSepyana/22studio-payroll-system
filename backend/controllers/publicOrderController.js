import { z } from 'zod';
import * as publicOrderTrackingService from '../services/publicOrderTrackingService.js';
import { ok } from '../utils/response.js';

const trackingQuerySchema = z.object({
  noWa: z.string().min(1),
  invoiceId: z.string().min(1),
});

const approveSchema = z.object({
  noWa: z.string().min(1),
  invoiceId: z.string().min(1),
  note: z.string().optional(),
});

export async function timeline(req, res, next) {
  try {
    const { noWa, invoiceId } = trackingQuerySchema.parse(req.query);
    ok(res, await publicOrderTrackingService.getPublicOrderTimeline(noWa, invoiceId));
  } catch (err) {
    next(err);
  }
}

export async function approveDesign(req, res, next) {
  try {
    const { noWa, invoiceId, note } = approveSchema.parse(req.body);
    ok(res, await publicOrderTrackingService.approveDesignPublic(noWa, invoiceId, note));
  } catch (err) {
    next(err);
  }
}
