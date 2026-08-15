/**
 * Work schedules (P§28) — expanding a recurrence rule into shifts.
 *
 * The v0.2 decision, taken at last: shifts are a **rule**, evaluated for
 * whatever range the calendar is showing, never a table of generated rows. See
 * the migration for why. Exceptions are rows, because "I swapped Tuesday" is
 * the case that breaks every recurring-event model and a mutable field cannot
 * express it.
 *
 * Pure functions over typed inputs — no I/O — so the awkward cases are testable
 * without a device, and there are more of them than "repeat weekly" suggests.
 */

import type { WorkSchedule, WorkShiftException } from '@/lib/database.types';
import { parseISODate } from '@/lib/dates';

export type Shift = {
  /** Stable across renders: one shift per schedule per date. */
  id: string;
  scheduleId: string;
  date: string;
  name: string;
  startTime: string | null;
  endTime: string | null;
  /** True when an exception moved this shift's hours. */
  moved: boolean;
};

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/**
 * Every date in [start, end] inclusive.
 *
 * Built by incrementing a local Date rather than adding 86,400,000 ms, because
 * a day is not always 86.4M ms — across a DST boundary that arithmetic drifts an
 * hour and eventually skips or repeats a date. `lib/dates.ts` exists for exactly
 * this class of bug.
 */
function eachDate(start: string, end: string): Date[] {
  const out: Date[] = [];
  const cursor = parseISODate(start);
  const last = parseISODate(end);

  while (cursor <= last) {
    out.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/**
 * Expand schedules into concrete shifts across a date range.
 *
 * Order of rules, all of which have bitten someone somewhere:
 *   1. Archived schedules produce nothing.
 *   2. A date outside [effective_from, effective_to] produces nothing — a job
 *      you left in June must not generate shifts in July.
 *   3. The weekday must match.
 *   4. A 'skipped' exception removes the shift entirely.
 *   5. A 'moved' exception replaces its hours, keeping the shift.
 */
export function expandShifts(
  schedules: WorkSchedule[],
  exceptions: WorkShiftException[],
  rangeStart: string,
  rangeEnd: string
): Shift[] {
  // Keyed lookup so this stays linear rather than scanning exceptions per date.
  const exceptionBy = new Map<string, WorkShiftException>();
  for (const e of exceptions) exceptionBy.set(`${e.schedule_id}:${e.shift_date}`, e);

  const dates = eachDate(rangeStart, rangeEnd);
  const shifts: Shift[] = [];

  for (const schedule of schedules) {
    if (schedule.archived_at) continue;

    for (const d of dates) {
      const date = iso(d);

      if (date < schedule.effective_from) continue;
      if (schedule.effective_to && date > schedule.effective_to) continue;
      if (!schedule.days_of_week.includes(d.getDay())) continue;

      const exception = exceptionBy.get(`${schedule.id}:${date}`);
      if (exception?.kind === 'skipped') continue;

      shifts.push({
        id: `shift-${schedule.id}-${date}`,
        scheduleId: schedule.id,
        date,
        name: schedule.name,
        startTime: exception?.kind === 'moved' ? exception.start_time : schedule.start_time,
        endTime: exception?.kind === 'moved' ? exception.end_time : schedule.end_time,
        moved: exception?.kind === 'moved',
      });
    }
  }

  // Chronological, then by start time so a morning shift precedes an evening
  // one on the same day. All-day shifts (null start) sort first.
  return shifts.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
      a.name.localeCompare(b.name)
  );
}

/** "09:00–17:00", or null when the schedule has no fixed hours. */
export function shiftHoursLabel(shift: Shift): string | null {
  if (!shift.startTime) return null;
  const trim = (t: string) => t.slice(0, 5); // Postgres returns HH:MM:SS
  return shift.endTime
    ? `${trim(shift.startTime)}–${trim(shift.endTime)}`
    : trim(shift.startTime);
}

/** Weekday names for the schedule editor and for summarising a rule. */
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * A rule in one line — "Mon, Wed, Fri · 09:00–17:00".
 *
 * Consecutive runs collapse to a range, because "Mon–Fri" is how people say it
 * and "Mon, Tue, Wed, Thu, Fri" is how a naive join says it.
 */
export function describeSchedule(schedule: WorkSchedule): string {
  const days = [...schedule.days_of_week].sort((a, b) => a - b);

  const runs: string[] = [];
  let i = 0;
  while (i < days.length) {
    let j = i;
    while (j + 1 < days.length && days[j + 1] === days[j] + 1) j += 1;

    // Only collapse runs of 3+; "Mon–Tue" is longer than "Mon, Tue".
    runs.push(
      j - i >= 2 ? `${WEEKDAYS[days[i]]}–${WEEKDAYS[days[j]]}` : days.slice(i, j + 1).map((d) => WEEKDAYS[d]).join(', ')
    );
    i = j + 1;
  }

  const dayPart = runs.join(', ');
  const timePart = schedule.start_time
    ? `${schedule.start_time.slice(0, 5)}–${(schedule.end_time ?? '').slice(0, 5)}`.replace(/–$/, '')
    : 'All day';

  return `${dayPart} · ${timePart}`;
}
