import * as cloudinaryUploadService from '../services/cloudinaryUploadService.js';
import { ApiError, ok } from '../utils/response.js';

export async function uploadDesign(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'File wajib diunggah');
    const url = await cloudinaryUploadService.uploadDesignImage(req.file);
    ok(res, { url });
  } catch (err) {
    next(err);
  }
}
