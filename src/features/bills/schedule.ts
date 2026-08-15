/**
 * Bill scheduling.
 *
 * Pure functions, no I/O, so the awkward calendar cases are unit-testable —
 * and there are more of them than a due-date field suggests.
 */

import { parseISODate, todayISO } from '@/lib/dates';
import type { Bill, Recurrence } from '@/lib/database.types';

export type BillStatus = 'paid' | 'overdue' | 'due-soon' | 'upcoming';

/** D§34: "Due soon" starts here. Three days is enough notice to act on a bill. */
export const DUE_SOON_DAYS = 3;

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function iso(year: number, monthIndex: number, day: number): string {
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * The due date of a monthly bill within a given month.
 *
 * Clamps to the last day of the month, so a bill due on the 31st falls on
 * Feb 28 (or 29) rather than silently rolling into March. Rolling forward
 * would mean February simply had no electricity bill, and the month's
 * Upcoming Bills total — and therefore Available Money — would be wrong.
 */
export function dueDateInMonth(dueDay: number, year: number, monthIndex: number): string {
  const clamped = Math.min(Math.max(dueDay, 1), daysInMonth(year, monthIndex));
  return iso(year, monthIndex, clamped);
}

/**
 * Whether a bill occurs in a given month.
 *
 * ⚠️ Mirrors `public.bill_occurs_in_month()` — see the migration. Held by a
 * contract test, because a quarterly bill counted in the wrong month would
 * overstate Upcoming Bills and understate Available Money, which is the
 * headline figure on the dashboard.
 *
 * "Every 3 months" is not a schedule on its own: a quarterly bill anchored in
 * February falls Feb/May/Aug/Nov, one anchored in January falls Jan/Apr/Jul/Oct.
 * The anchor is what makes the interval mean something.
 */
export function billOccursInMonth(
  bill: Partial<Pick<Bill, 'interval_months' | 'anchor_month'>>,
  year: number,
  monthIndex: number
): boolean {
  const interval = bill.interval_months ?? 1;
  // Monthly occurs every month, and the anchor carries no information.
  if (interval <= 1) return true;
  if (!bill.anchor_month) return false;

  const anchor = parseISODate(bill.anchor_month);
  const anchorMonths = anchor.getFullYear() * 12 + anchor.getMonth();
  const periodMonths = year * 12 + monthIndex;

  // Nothing occurs before the first occurrence.
  if (periodMonths < anchorMonths) return false;

  return (periodMonths - anchorMonths) % interval === 0;
}

/** The next month (>= the given one) in which the bill occurs. */
function nextOccurringMonth(
  bill: Partial<Pick<Bill, 'interval_months' | 'anchor_month'>>,
  year: number,
  monthIndex: number
): { year: number; monthIndex: number } {
  let y = year;
  let m = monthIndex;

  // Bounded: with a maximum interval of 12 the answer is always within 12
  // steps, so this cannot spin.
  for (let i = 0; i < 12; i += 1) {
    if (billOccursInMonth(bill, y, m)) return { year: y, monthIndex: m };
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return { year: y, monthIndex: m };
}

/**
 * The next date this bill is due, on or after `from`.
 *
 * A bill due on the 15th, checked on the 20th, is due on the 15th of NEXT
 * month — but only once this month's has been paid. Unpaid, it stays overdue
 * on this month's date, which is what `nextDueDate` returns when `paidPeriods`
 * does not include the current period.
 *
 * For a bill that recurs every N months, "next month" means the next month it
 * actually occurs in, not simply the following one.
 */
export function nextDueDate(
  bill: Pick<Bill, 'due_day' | 'recurrence'> &
    Partial<Pick<Bill, 'interval_months' | 'anchor_month'>>,
  paidPeriods: Set<string>,
  from = todayISO()
): string | null {
  if (bill.recurrence === 'none' || bill.due_day == null) return null;

  const fromDate = parseISODate(from);
  const year = fromDate.getFullYear();
  const monthIndex = fromDate.getMonth();

  if (bill.recurrence === 'monthly') {
    // Where does this bill next land, at or after the current month?
    const current = nextOccurringMonth(bill, year, monthIndex);
    const thisPeriod = periodFor(current.year, current.monthIndex);
    const thisMonthDue = dueDateInMonth(bill.due_day, current.year, current.monthIndex);

    // Unpaid this period → that is the date, even if it has passed. An overdue
    // bill does not stop being due just because the day went by.
    if (!paidPeriods.has(thisPeriod)) return thisMonthDue;

    // Paid — skip to the following OCCURRING month, which for a quarterly bill
    // is three months out, not one.
    const after = nextOccurringMonth(
      bill,
      current.monthIndex === 11 ? current.year + 1 : current.year,
      current.monthIndex === 11 ? 0 : current.monthIndex + 1
    );
    return dueDateInMonth(bill.due_day, after.year, after.monthIndex);
  }

  if (bill.recurrence === 'yearly') {
    const thisYearDue = dueDateInMonth(bill.due_day, year, monthIndex);
    return paidPeriods.has(periodFor(year, monthIndex))
      ? dueDateInMonth(bill.due_day, year + 1, monthIndex)
      : thisYearDue;
  }

  // Weekly bills are rare enough in v0.1 that the due_day field does not model
  // them well; treat as always-current until weekly gets a day-of-week column.
  return todayISO();
}

/** The period key a payment settles: the first of the month, matching bill_payments.period. */
export function periodFor(year: number, monthIndex: number): string {
  return iso(year, monthIndex, 1);
}

/** The current period, for querying and writing bill_payments. */
export function currentPeriodFor(isoDate = todayISO()): string {
  const d = parseISODate(isoDate);
  return periodFor(d.getFullYear(), d.getMonth());
}

export function daysUntil(dueISO: string, from = todayISO()): number {
  return Math.round(
    (parseISODate(dueISO).getTime() - parseISODate(from).getTime()) / 86_400_000
  );
}

export function billStatus(
  dueISO: string | null,
  isPaidThisPeriod: boolean,
  from = todayISO()
): BillStatus {
  if (isPaidThisPeriod) return 'paid';
  if (!dueISO) return 'upcoming';

  const days = daysUntil(dueISO, from);
  if (days < 0) return 'overdue';
  if (days <= DUE_SOON_DAYS) return 'due-soon';
  return 'upcoming';
}

/**
 * D§34 accents — and D§44: never colour alone, so each status carries a label.
 * The label is the accessible signal; the colour is decoration on top of it.
 */
export const STATUS_META: Record<
  BillStatus,
  { tone: 'income' | 'bill' | 'danger' | 'info'; label: string }
> = {
  paid: { tone: 'income', label: 'Paid' },
  overdue: { tone: 'danger', label: 'Overdue' },
  'due-soon': { tone: 'bill', label: 'Due soon' },
  upcoming: { tone: 'info', label: 'Upcoming' },
};
