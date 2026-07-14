import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { ApiError } from '../utils/response.js';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    throw new ApiError(500, 'Cloudinary belum dikonfigurasi di server');
  }
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
  });
  configured = true;
}

// Google Drive was tried first but service accounts have no storage quota
// of their own (Shared Drives / domain-wide delegation are Workspace-only),
// so uploads go to Cloudinary's free tier instead — a single authenticated
// API call, no OAuth consent flow, returns a public HTTPS URL directly
// usable in <img> tags and the PDF export's raw fetch().
export async function uploadDesignImage(file) {
  ensureConfigured();
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new ApiError(400, 'File harus berupa gambar (JPEG, PNG, WEBP, atau GIF)');
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new ApiError(400, 'Ukuran file maksimal 10MB');
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: '22studio-order-designs', resource_type: 'image' },
      (err, result) => {
        if (err) return reject(new ApiError(502, `Upload ke Cloudinary gagal: ${err.message}`));
        resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });
}
