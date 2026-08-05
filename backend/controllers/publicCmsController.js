import * as cmsService from '../services/cmsService.js';
import { ok } from '../utils/response.js';

export async function getContent(req, res, next) {
  try {
    ok(res, await cmsService.getPublicCmsContent());
  } catch (err) {
    next(err);
  }
}
