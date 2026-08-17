/**
 * "Spent today / this week" — the subtle line under the dashboard sparkline.
 *
 * Pure, no I/O, because the two things that make this wrong are both
 * arithmetic: which rows count as spending, and where the week starts.
 *
 * ── What counts as spent ────────────────────────────────────────────────────
 *
 * Money out, excluding transfers. A transfer is two paired rows sharing a
 * `transfer_group_id` and its own `type`, precisely so aggregates can exclude
 * it structurally instead of by a filter someone has to remember — moving
 * ₱5,000 into savings is not ₱5,000 spent, and reading it as such is the money
 * invariant this app is most careful about.
 *
 * Refunds are *not* netted off, matching the M13 finding: a ₱1,500 purchase
 * refunded in full leaves Expenses at ₱1,500 and Income at ₱1,500, because
 * netting would make the summary disagree with the transaction list the user
 * can scroll. The same rule has to hold here or the dashboard and the ledger
 * tell different stories about the same day.
 *
 * ── Where the week starts ───────────────────────────────────────────────────
 *
 * Monday, and it is a rolling *calendar* week rather than "the last 7 days".
 * "This week" to a person means since Monday; on a Tuesday, a 7-day window
 * quietly includes last Wednesday and reports a number they cannot reconcile
 * against anything.
 */

import { parseISODate, todayISO } from '@/lib/dates';

/** The minimum shape this needs — deliberately not the full row type. */
export type SpendRow = {
  transaction_date: string;
  amount_minor: number;
  direction: 'in' | 'out';
  type: string;
};

export type SpendSummary = {
  todayMinor: number;
  weekMinor: number;
  /** ISO date the week window starts on, for the label. */
  weekStart: string;
};

/** The Monday on or before `iso`. */
export function startOfWeek(iso: string): string {
  const d = parseISODate(iso);
  // getDay(): 0 = Sunday. Sunday belongs to the week that began six days ago,
  // not to the one starting tomorrow.
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);

  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function summariseSpend(rows: SpendRow[], today = todayISO()): SpendSummary {
  const weekStart = startOfWeek(today);

  let todayMinor = 0;
  let weekMinor = 0;

  for (const row of rows) {
    if (row.direction !== 'out') continue;
    // Structural, not a name check — see the module comment.
    if (row.type === 'transfer') continue;

    // String comparison is safe and cheap for ISO dates, and avoids
    // constructing a Date per row only to compare two local midnights.
    if (row.transaction_date > today) continue;
    if (row.transaction_date < weekStart) continue;

    weekMinor += row.amount_minor;
    if (row.transaction_date === today) todayMinor += row.amount_minor;
  }

  return { todayMinor, weekMinor, weekStart };
}

/**
 * The one-line caption, or null when there is nothing worth saying.
 *
 * Null on a zero week is deliberate. D§63's financial calm means the dashboard
 * does not announce "₱0.00 spent this week" to someone who has not spent
 * anything — that is a line of chrome reporting the absence of news, and the
 * card is already carrying the biggest number on the screen.
 */
export function spendCaption(
  summary: SpendSummary,
  format: (minor: number) => string
): string | null {
  if (summary.weekMinor <= 0) return null;

  if (summary.todayMinor > 0) {
    return `${format(summary.todayMinor)} spent today · ${format(summary.weekMinor)} this week`;
  }
  return `${format(summary.weekMinor)} spent this week`;
}
