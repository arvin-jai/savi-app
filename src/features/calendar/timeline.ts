/**
 * The unified timeline (P§16) — money and time on one surface.
 *
 * "Savi's calendar is different from a normal calendar."
 *
 * This is the merge that makes P§35's claim real: bills, paydays, events, and
 * tasks resolved into a single day-keyed structure. Traditional tools keep
 * these in four apps; the whole product thesis is that seeing them together is
 * what lets someone answer "can I afford this?"
 *
 * Money entries are DERIVED, never stored as calendar rows. A bill's due date
 * comes from the bill; a payday comes from the recurring income schedule. If
 * they were copied into `calendar_events` the calendar could disagree with the
 * ledger, and the ledger is the thing that must be right.
 *
 * Pure functions over typed inputs — no I/O, so every merge rule is testable.
 */

import type { BillWithStatus } from '@/features/bills/api';
import { billOccursInMonth, dueDateInMonth } from '@/features/bills/schedule';
import type { CalendarEvent, EventKind, Task, TaskPriority } from '@/lib/database.types';
import { parseISODate } from '@/lib/dates';

import { shiftHoursLabel, type Shift } from './shifts';

export type TimelineKind =
  | 'bill'
  | 'income'
  | 'event'
  | 'task'
  | 'shift';

export type TimelineEntry = {
  id: string;
  date: string;
  kind: TimelineKind;
  title: string;
  /** Minor units, present only for money entries. */
  amountMinor?: number;
  /** Sorting key within a day; all-day items sort first. */
  time?: string | null;
  /** D§35 dot colour, as a semantic or category token name. */
  tone: 'income' | 'bill' | 'danger' | 'info' | 'brand' | 'secondary';
  /** Sub-label, e.g. "Overdue" or "High priority". */
  meta?: string;
  done?: boolean;
  eventKind?: EventKind;
  priority?: TaskPriority;
};

export type TimelineInputs = {
  bills: BillWithStatus[];
  events: CalendarEvent[];
  tasks: Task[];
  /** Monthly recurring income: amount + payday. */
  recurringIncome: { id: string; amountMinor: number; dayOfMonth: number | null; label: string }[];
  /**
   * Work shifts, already expanded from their recurrence rule by
   * `shifts.ts`. Expanded there rather than here so the rule stays testable on
   * its own, and because shifts are the one recurring item whose exceptions
   * live in a table.
   */
  shifts?: Shift[];
  /** Inclusive range to materialise, as YYYY-MM-DD. */
  rangeStart: string;
  rangeEnd: string;
};

function withinRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

/**
 * Every month boundary the range touches, so recurring items can be projected
 * onto each one. A range spanning Jan 28 → Mar 3 must produce Jan, Feb, AND
 * Mar — iterating by adding 30 days would skip February.
 */
function monthsInRange(start: string, end: string): { year: number; month: number }[] {
  const s = parseISODate(start);
  const e = parseISODate(end);
  const out: { year: number; month: number }[] = [];

  let year = s.getFullYear();
  let month = s.getMonth();

  while (year < e.getFullYear() || (year === e.getFullYear() && month <= e.getMonth())) {
    out.push({ year, month });
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return out;
}

export function buildTimeline(input: TimelineInputs): TimelineEntry[] {
  const { bills, events, tasks, recurringIncome, rangeStart, rangeEnd } = input;
  const entries: TimelineEntry[] = [];
  const months = monthsInRange(rangeStart, rangeEnd);

  // ── Bills — projected onto every month in range ───────────────────────────
  for (const bill of bills) {
    if (bill.due_day == null || bill.recurrence === 'none') continue;

    for (const { year, month } of months) {
      // A quarterly bill must not appear in the two months it does not occur.
      // Same rule as the bills list and the SQL engine — one implementation.
      if (!billOccursInMonth(bill, year, month)) continue;

      // Reuses the M4 clamp, so a bill due on the 31st lands on Feb 28 here
      // exactly as it does in the bills list. One rule, one implementation.
      const date = dueDateInMonth(bill.due_day, year, month);
      if (!withinRange(date, rangeStart, rangeEnd)) continue;

      const isCurrentPeriodPaid = bill.status === 'paid' && bill.dueDate === date;

      entries.push({
        id: `bill-${bill.id}-${date}`,
        date,
        kind: 'bill',
        title: bill.name,
        amountMinor: bill.amount_minor,
        tone: isCurrentPeriodPaid ? 'income' : bill.status === 'overdue' ? 'danger' : 'bill',
        meta: isCurrentPeriodPaid ? 'Paid' : bill.status === 'overdue' ? 'Overdue' : 'Due',
        time: null,
      });
    }
  }

  // ── Income — paydays projected the same way ───────────────────────────────
  for (const income of recurringIncome) {
    if (income.dayOfMonth == null) continue;

    for (const { year, month } of months) {
      const date = dueDateInMonth(income.dayOfMonth, year, month);
      if (!withinRange(date, rangeStart, rangeEnd)) continue;

      entries.push({
        id: `income-${income.id}-${date}`,
        date,
        kind: 'income',
        title: income.label,
        amountMinor: income.amountMinor,
        tone: 'income',
        meta: 'Expected',
        time: null,
      });
    }
  }

  // ── Events ────────────────────────────────────────────────────────────────
  for (const event of events) {
    if (!withinRange(event.event_date, rangeStart, rangeEnd)) continue;

    entries.push({
      id: `event-${event.id}`,
      date: event.event_date,
      kind: 'event',
      title: event.title,
      time: event.all_day ? null : event.start_time,
      tone: event.kind === 'deadline' ? 'danger' : event.kind === 'work' ? 'info' : 'brand',
      meta: event.all_day ? 'All day' : (event.start_time ?? undefined)?.slice(0, 5),
      eventKind: event.kind,
    });
  }

  // ── Tasks — only those with a due date appear on the calendar ─────────────
  for (const task of tasks) {
    if (!task.due_date || !withinRange(task.due_date, rangeStart, rangeEnd)) continue;

    entries.push({
      id: `task-${task.id}`,
      date: task.due_date,
      kind: 'task',
      title: task.title,
      time: null,
      done: task.status === 'done',
      priority: task.priority,
      // A done task goes quiet — it stays visible as a record but stops
      // competing for attention with things still outstanding.
      tone: task.status === 'done' ? 'secondary' : task.priority === 'urgent' ? 'danger' : 'brand',
      meta:
        task.status === 'done'
          ? 'Done'
          : task.priority === 'medium'
            ? 'Task'
            : `${task.priority[0].toUpperCase()}${task.priority.slice(1)} priority`,
    });
  }

  // ── Work shifts (P§28) ────────────────────────────────────────────────────
  // Already expanded from the recurrence rule; this only places them.
  for (const shift of input.shifts ?? []) {
    if (!withinRange(shift.date, rangeStart, rangeEnd)) continue;

    entries.push({
      id: shift.id,
      date: shift.date,
      kind: 'shift',
      title: shift.name,
      time: shift.startTime,
      // D§35 gives Work a blue indicator. A shift is information, not an
      // obligation with a cost, so it never takes a money tone.
      tone: 'info',
      meta: shiftHoursLabel(shift) ?? 'All day',
    });
  }

  return sortTimeline(entries);
}

/**
 * Within a day: money first, then timed events in clock order, then all-day
 * events, then tasks.
 *
 * Money leads because it is the thing with a deadline the user cannot move,
 * and D§26's hierarchy puts obligations above everything but the balance.
 */
const KIND_ORDER: Record<TimelineKind, number> = {
  income: 0,
  bill: 1,
  // A shift shapes the whole day and is the frame the rest sits inside, so it
  // precedes individual events — but never money, which has a deadline the user
  // cannot move.
  shift: 2,
  event: 3,
  task: 4,
};

export function sortTimeline(entries: TimelineEntry[]): TimelineEntry[] {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    // Timed before all-day within the same kind.
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return a.title.localeCompare(b.title);
  });
}

/** Day → entries, for the month grid's dots and the agenda list. */
export function groupTimelineByDate(entries: TimelineEntry[]): Map<string, TimelineEntry[]> {
  const map = new Map<string, TimelineEntry[]>();
  for (const e of entries) {
    const bucket = map.get(e.date);
    if (bucket) bucket.push(e);
    else map.set(e.date, [e]);
  }
  return map;
}

/**
 * The distinct dot tones for a day, capped.
 *
 * D§35: "subtle colored indicators rather than completely colored cards". Six
 * dots under a date is not an indicator, it is a smear — three plus the count
 * reads faster and keeps the grid calm.
 */
export function dayIndicators(entries: TimelineEntry[], max = 3): TimelineEntry['tone'][] {
  const seen: TimelineEntry['tone'][] = [];
  for (const e of entries) {
    if (!seen.includes(e.tone)) seen.push(e.tone);
    if (seen.length >= max) break;
  }
  return seen;
}
