// Short, redacted description of a request body for the AuditLog sheet.

const MAX_SUMMARY_LENGTH = 500;
const MAX_STRING_LENGTH = 100;
const MAX_ARRAY_ITEMS = 10;
const MAX_DEPTH = 4;

// Field names that may hold credentials: dropped entirely, not masked.
const SENSITIVE_KEY = /pass|secret|token|authorization|api_?key|hash|^key$/i;

function redact(value, depth) {
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
  }
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '…';
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((v) => redact(v, depth + 1));
    return value.length > MAX_ARRAY_ITEMS ? [...items, `…(+${value.length - MAX_ARRAY_ITEMS})`] : items;
  }
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    if (!SENSITIVE_KEY.test(key)) out[key] = redact(v, depth + 1);
  }
  return out;
}

export function buildAuditSummary(body) {
  if (body === undefined || body === null || body === '') return '';
  if (typeof body === 'object' && Object.keys(body).length === 0) return '';
  const text = JSON.stringify(redact(body, 0));
  return text.length > MAX_SUMMARY_LENGTH ? `${text.slice(0, MAX_SUMMARY_LENGTH - 1)}…` : text;
}
