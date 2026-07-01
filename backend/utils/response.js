export function ok(res, data, meta) {
  return res.json({ success: true, data, ...(meta ? { meta } : {}) });
}

export function created(res, data) {
  return res.status(201).json({ success: true, data });
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
