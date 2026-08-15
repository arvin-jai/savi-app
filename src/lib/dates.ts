/**
 * Date helpers.
 *
 * Dates are stored as `date` (YYYY-MM-DD) with no time and no zone. A
 * transaction happened on a day, not at an instant — parsing "2026-08-14" as a
 * UTC timestamp and rendering it locally is how a purchase made this evening
 * shows up as yesterday.
 */

/** Today in the device's local timezone, as YYYY-MM-DD. */
export function todayISO(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Parse YYYY-MM-DD into a LOCAL date, avoiding the UTC-shift bug above. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function daysBetween(aISO: string, bISO: string): number {
  const a = parseISODate(aISO);
  const b = parseISODate(bISO);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/**
 * Human day label for transaction grouping (D§32: "Today · Need").
 * Relative for the recent past, absolute beyond a week — "6 days ago" is
 * harder to place than "Aug 8".
 */
export function dayLabel(iso: string, today = todayISO()): string {
  const diff = daysBetween(today, iso);

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return parseISODate(iso).toLocaleDateString(undefined, { weekday: 'long' });

  const d = parseISODate(iso);
  const sameYear = d.getFullYear() === parseISODate(today).getFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Due-date phrasing for bills (D§34), in the calm voice of D§63. */
export function dueLabel(iso: string, today = todayISO()): string {
  const diff = daysBetween(iso, today);
  if (diff < 0) return `Overdue by ${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'}`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff < 7) return `Due in ${diff} days`;
  return `Due ${dayLabel(iso, today)}`;
}

/** Group items by their date field, preserving the order they arrive in. */
export function groupByDay<T>(items: T[], getDate: (item: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getDate(item);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()];
}

/** First day of the current month, for the P§23 period argument. */
export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
