// WhatsApp deep links / phone matching need the number without a leading
// 0/+, prefixed with the country code — Indonesian numbers are stored
// locally as "08xxx".
export function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
}
