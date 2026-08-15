/**
 * The balance series behind the dashboard sparkline (design handoff 2a).
 *
 * ── What this shows, and why it is balance rather than Available Money ──────
 *
 * The handoff asks for "the last ~10 days of `available_money_minor`". Available
 * Money is `Current Balance − Upcoming Bills`, and the bills half is a statement
 * about *now*: which bills are still unpaid this period. There is no honest
 * historical value for it — reconstructing "what was unpaid on the 8th" would
 * mean replaying `bill_payments` against a period boundary, and the answer would
 * change every time a user marked something paid late.
 *
 * So the line is the **balance**, which is exactly derivable: today's balance
 * walked backwards through the ledger. The bills deduction stays where it is
 * already stated and already true — the caption under the number.
 *
 * That keeps the card honest: a big figure, the deduction that produced it, and
 * a line showing where the money has actually been going.
 *
 * Pure functions, no I/O — the walk-backwards arithmetic is the part worth
 * testing, and it is off by one in the obvious implementation.
 */

import { parseISODate, todayISO } from '@/lib/dates';

export type TrendPoint = { date: string; balanceMinor: number };

/** A day's net movement across all asset accounts. */
export type DailyNet = { date: string; netMinor: number };

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Rebuild the daily closing balance for the last `days` days.
 *
 * Walks **backwards** from today's known balance: yesterday's closing balance is
 * today's minus everything that happened today. The off-by-one that makes this
 * subtly wrong is subtracting the *current* day's net when producing the current
 * day's point — today's closing balance already includes today's movements.
 *
 * @param currentBalanceMinor  today's closing balance (Σ asset accounts)
 * @param netByDate            net movement per day; missing days are zero
 * @param days                 how many points to produce, ending today
 */
export function buildBalanceTrend(
  currentBalanceMinor: number,
  netByDate: DailyNet[],
  days = 14,
  today = todayISO()
): TrendPoint[] {
  const net = new Map(netByDate.map((d) => [d.date, d.netMinor]));

  const points: TrendPoint[] = [];
  const cursor = parseISODate(today);
  let balance = currentBalanceMinor;

  for (let i = 0; i < days; i += 1) {
    const date = iso(cursor);

    // Today's closing balance already contains today's movements, so the point
    // is recorded BEFORE unwinding that day.
    points.push({ date, balanceMinor: balance });

    balance -= net.get(date) ?? 0;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Built newest-first; a chart reads left to right.
  return points.reverse();
}

/**
 * Percentage change against the point `daysAgo` back, for the "+8% vs last
 * week" caption.
 *
 * Returns null when there is nothing honest to say:
 *   - fewer points than the comparison needs
 *   - a zero or negative baseline, where a percentage is meaningless (going
 *     from −₱100 to ₱100 is not "+200%")
 *
 * The card omits the clause entirely in that case rather than printing
 * something technically derived and practically nonsense — the same gate the
 * insight rules apply to spending changes.
 */
export function trendChangePercent(points: TrendPoint[], daysAgo = 7): number | null {
  if (points.length < daysAgo + 1) return null;

  const latest = points[points.length - 1].balanceMinor;
  const past = points[points.length - 1 - daysAgo].balanceMinor;

  if (past <= 0) return null;

  return Math.round(((latest - past) / past) * 100);
}

/**
 * Normalise a series to 0–1 for plotting, where 0 is the lowest point.
 *
 * A flat series returns all 0.5 rather than dividing by zero — a line through
 * the middle is the truthful picture of "nothing changed", and NaN would render
 * as an invisible or exploded path.
 */
export function normalisePoints(points: TrendPoint[]): number[] {
  if (points.length === 0) return [];

  const values = points.map((p) => p.balanceMinor);
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (max === min) return values.map(() => 0.5);

  return values.map((v) => (v - min) / (max - min));
}
