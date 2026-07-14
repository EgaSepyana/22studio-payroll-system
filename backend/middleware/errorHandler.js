import { ZodError } from 'zod';
import multer from 'multer';

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
}

export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: err.message });
  }

  const status = err.status || 500;
  if (status >= 500) console.error(err);

  res.status(status).json({ success: false, message: err.message || 'Internal server error' });
}
