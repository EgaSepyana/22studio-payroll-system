// Defaults for the columns appended to Users/Orders for agent access.
// Rows written before those columns existed have them empty.

export function parseScopes(value) {
  if (typeof value !== 'string') return [];
  return [...new Set(value.split(',').map((s) => s.trim()).filter(Boolean))];
}

export function isTrueFlag(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

export function isPublishAllowed(order) {
  return isTrueFlag(order?.boleh_publikasi);
}

export function isAccountDisabled(user) {
  return isTrueFlag(user?.disabled);
}
