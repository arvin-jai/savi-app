/**
 * Week arithmetic for the week view (D§67, P§16).
 *
 * Pure, no imports beyond `lib/dates`, so it is testable without rendering
 * anything — the same split the rest of the codebase uses (`schedule.ts` vs
 * `api.ts`, `timeline.ts` vs the screen). Rendering lives in `WeekView.tsx`.
 *
 * Every function here builds dates by incrementing the date FIELD rather than
 * adding 86,400,000 ms. A day is not always 86.4M ms — across a DST boundary
 * that arithmetic drifts an hour and eventually skips or repeats a date, which
 * on a calendar means a missing Tuesday.
 */

import { parseISODate } from '@/lib/dates';

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The Sunday-anchored week containing `anchor`, as seven ISO dates. */
export function weekDates(anchor: string): string[] {
  const d = parseISODate(anchor);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());

  return Array.from({ length: 7 }, (_, i) =>
    iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  );
}

export function weekBounds(anchor: string): { start: string; end: string } {
  const dates = weekDates(anchor);
  return { start: dates[0], end: dates[6] };
}

export function shiftWeek(anchor: string, delta: number): string {
  const d = parseISODate(anchor);
  return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta * 7));
}

/**
 * "Aug 9 – 15" inside one month, "Aug 30 – Sep 5" across two.
 *
 * Repeating the month when it has not changed is noise; omitting it when it HAS
 * changed produces "Aug 30 – 5", which is nonsense.
 */
export function weekLabel(anchor: string): string {
  const { start, end } = weekBounds(anchor);
  const s = parseISODate(start);
  const e = parseISODate(end);

  const sameMonth = s.getMonth() === e.getMonth();
  const fmt = (d: Date, withMonth: boolean) =>
    d.toLocaleDateString(
      undefined,
      withMonth ? { month: 'short', day: 'numeric' } : { day: 'numeric' }
    );

  return `${fmt(s, true)} – ${fmt(e, !sameMonth)}`;
}
