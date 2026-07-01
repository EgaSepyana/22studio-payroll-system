export function isoWeekKey(dateStr) {
  const date = new Date(dateStr);
  const target = new Date(date.valueOf());
  const dayNumber = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
    );
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function yearKey(dateStr) {
  return String(new Date(dateStr).getFullYear());
}

export function dayKey(dateStr) {
  return dateStr;
}
