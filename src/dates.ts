// All dates are JST calendar days as "YYYY-MM-DD"; Date objects are pinned to UTC midnight
// so arithmetic never drifts with the runtime's timezone.

export const utc = (date: string) => new Date(`${date}T00:00:00Z`);

export function jstNow(ms = Date.now()) {
  const iso = new Date(ms + 9 * 3600_000).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

export function addDays(date: string, n: number): string {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// "YYYY-MM" ± n months.
export function addMonths(ym: string, n: number): string {
  const d = utc(`${ym}-01`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}
