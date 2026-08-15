/**
 * Ask Savi — the read-only tool contract (v0.4).
 *
 * This file is the boundary made executable. docs/AI-BOUNDARY.md §1 lists what
 * may cross to the model; the `project*` functions below are what actually
 * enforce it, because they build the payload field by field rather than passing
 * a database row through.
 *
 * Two rules govern everything here:
 *
 *   §5  Every tool is a READ. There is no write tool — not disabled, absent.
 *   §7  The model never does arithmetic. Every money value crosses as an
 *       already-formatted string computed by SQL or by the projection.
 *
 * Pure functions over typed inputs, no I/O, so the boundary is unit-testable
 * without a network or a database. index.ts does the querying and calls these.
 */

import { formatMoneyForModel } from './money.ts';

// ─── The registry ───────────────────────────────────────────────────────────

export const TOOL_NAMES = [
  'get_financial_summary',
  'get_upcoming_bills',
  'get_recent_expenses',
  'get_monthly_spending',
  'get_schedule',
  'get_free_time',
  'get_financial_goals',
  'get_budget',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

/**
 * Dispatch is a lookup against this set (AI-BOUNDARY §5.2). A name the model
 * invents is refused here, before any query is built — there is no path by
 * which a model-supplied string selects a table.
 *
 * `get_financial_goals` was deliberately absent at v0.4 because `financial_goals`
 * did not exist yet — a tool returning a plausible empty answer for a missing
 * table teaches the model to invent. It joins the registry at v0.5, when the
 * data became real. `get_budget` arrives with it for the same reason.
 *
 * Every entry is still a READ.
 */
export function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name);
}

/** OpenAI tool definitions. Descriptions are prompt surface — they are read by the model. */
export const TOOL_SCHEMAS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_financial_summary',
      description:
        "The user's key financial figures for a month, already calculated. " +
        'Available Money is Current Balance minus Upcoming Bills — what they can spend ' +
        'without missing a payment. Remaining is Income minus Expenses — what is left of ' +
        'this month\'s income. These answer different questions; do not conflate them.',
      parameters: {
        type: 'object',
        properties: {
          month: {
            type: 'string',
            description: 'First day of the month, YYYY-MM-DD. Defaults to the current month.',
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_upcoming_bills',
      description: 'Unpaid bills for the current period, with due dates and status.',
      parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_recent_expenses',
      description:
        'The most recent expenses, newest first. Transfers between the user\'s own ' +
        'accounts are not expenses and never appear here.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'How many to return, 1–20. Default 10.' },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_monthly_spending',
      description:
        'Total spending per category for a month, already summed. Use this rather than ' +
        'adding up individual expenses.',
      parameters: {
        type: 'object',
        properties: {
          month: {
            type: 'string',
            description: 'First day of the month, YYYY-MM-DD. Defaults to the current month.',
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_schedule',
      description:
        "The user's events, tasks, and bill due dates in a date range — money and time on " +
        'one timeline.',
      parameters: {
        type: 'object',
        properties: {
          start: { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
          end: { type: 'string', description: 'YYYY-MM-DD. Defaults to 14 days after start.' },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_free_time',
      description: 'Dates in a range with nothing scheduled on them.',
      parameters: {
        type: 'object',
        properties: {
          start: { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
          end: { type: 'string', description: 'YYYY-MM-DD. Defaults to 14 days after start.' },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_financial_goals',
      description:
        "The user's savings goals with progress, and the monthly amount needed to reach each " +
        'one on time. The monthly figure is already calculated — do not work it out yourself.',
      parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_budget',
      description:
        "The user's plan for a month against what they have actually spent, per category: " +
        'bills, needs, wants and savings. Bills are derived from their bills, not chosen.',
      parameters: {
        type: 'object',
        properties: {
          month: {
            type: 'string',
            description: 'First day of the month, YYYY-MM-DD. Defaults to the current month.',
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
];

// ─── Argument handling ──────────────────────────────────────────────────────
//
// Tool arguments arrive as model-generated JSON. They are untrusted input in the
// ordinary sense — not malicious, but frequently wrong — so every one is
// validated and clamped rather than passed through.

const MAX_EXPENSES = 20;
const DEFAULT_EXPENSES = 10;
/** Bounds the payload. 90 days of schedule is far more than any question needs. */
const MAX_RANGE_DAYS = 90;
const DEFAULT_RANGE_DAYS = 14;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A valid YYYY-MM-DD that is also a real calendar date, else null. */
export function parseISODateArg(value: unknown): string | null {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Rejects 2026-02-31, which Date would otherwise roll forward to March 3rd.
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return value;
}

export function clampLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_EXPENSES;
  return Math.max(1, Math.min(MAX_EXPENSES, Math.floor(value)));
}

/** First day of the month for a summary or spending query. */
export function resolveMonth(value: unknown, today: string): string {
  const parsed = parseISODateArg(value);
  const base = parsed ?? today;
  return `${base.slice(0, 7)}-01`;
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  return (Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86_400_000;
}

/**
 * Resolve and bound a date range.
 *
 * A backwards range (end before start) is corrected to the default window
 * rather than returning nothing: an empty result reads to the model as "you
 * have no bills", which is a wrong answer about money, and it would have no way
 * to know its own arguments caused it.
 */
export function resolveRange(
  startArg: unknown,
  endArg: unknown,
  today: string
): { start: string; end: string } {
  const start = parseISODateArg(startArg) ?? today;
  const requestedEnd = parseISODateArg(endArg);

  if (!requestedEnd || daysBetween(start, requestedEnd) < 0) {
    return { start, end: addDaysISO(start, DEFAULT_RANGE_DAYS) };
  }
  if (daysBetween(start, requestedEnd) > MAX_RANGE_DAYS) {
    return { start, end: addDaysISO(start, MAX_RANGE_DAYS) };
  }
  return { start, end: requestedEnd };
}

/** Every date in [start, end] inclusive. */
export function eachDateISO(start: string, end: string): string[] {
  const out: string[] = [];
  const total = daysBetween(start, end);
  for (let i = 0; i <= total; i += 1) out.push(addDaysISO(start, i));
  return out;
}

// ─── Bill scheduling ────────────────────────────────────────────────────────
//
// ⚠️  A deliberate MIRROR of src/features/bills/schedule.ts, for the same reason
// money.ts mirrors lib/money.ts: Deno cannot resolve `@/features/...`. The
// invariant is held by a contract test in tools.test.ts that runs both
// implementations over the same cases — including the 31st→Feb-28 clamp, where
// rolling into March would mean February had no electricity bill at all, so
// Upcoming Bills would be understated and Available Money OVERSTATED.
//
// If either side drifts, `npm test` fails.

/** D§34: "Due soon" starts three days out. */
export const DUE_SOON_DAYS = 3;

function daysInMonthUTC(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function isoFrom(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function billDueDateInMonth(dueDay: number, year: number, monthIndex: number): string {
  const clamped = Math.min(Math.max(dueDay, 1), daysInMonthUTC(year, monthIndex));
  return isoFrom(year, monthIndex, clamped);
}

export function periodForISO(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/**
 * The next date this bill is due, on or after `from`. Unpaid this period means
 * the date stands even if it has passed — an overdue bill does not stop being
 * due because the day went by.
 */
/** Mirrors `billOccursInMonth` in schedule.ts and `bill_occurs_in_month` in SQL. */
export function billOccursIn(
  bill: { interval_months?: number | null; anchor_month?: string | null },
  year: number,
  monthIndex: number
): boolean {
  const interval = bill.interval_months ?? 1;
  if (interval <= 1) return true;
  if (!bill.anchor_month) return false;

  const [ay, am] = bill.anchor_month.split('-').map(Number);
  const anchorMonths = ay * 12 + (am - 1);
  const periodMonths = year * 12 + monthIndex;

  if (periodMonths < anchorMonths) return false;
  return (periodMonths - anchorMonths) % interval === 0;
}

function nextOccurring(
  bill: { interval_months?: number | null; anchor_month?: string | null },
  year: number,
  monthIndex: number
): { year: number; monthIndex: number } {
  let y = year;
  let m = monthIndex;
  for (let i = 0; i < 12; i += 1) {
    if (billOccursIn(bill, y, m)) return { year: y, monthIndex: m };
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return { year: y, monthIndex: m };
}

export function nextBillDueDate(
  bill: {
    due_day: number | null;
    recurrence: string;
    interval_months?: number | null;
    anchor_month?: string | null;
  },
  paidPeriods: Set<string>,
  from: string
): string | null {
  if (bill.recurrence === 'none' || bill.due_day == null) return null;

  const [year, month] = from.split('-').map(Number);
  const monthIndex = month - 1;

  if (bill.recurrence === 'monthly') {
    const current = nextOccurring(bill, year, monthIndex);
    const currentPeriod = `${current.year}-${String(current.monthIndex + 1).padStart(2, '0')}-01`;

    if (!paidPeriods.has(currentPeriod)) {
      return billDueDateInMonth(bill.due_day, current.year, current.monthIndex);
    }

    // Paid — skip to the following OCCURRING month, three out for a quarterly
    // bill rather than one.
    const after = nextOccurring(
      bill,
      current.monthIndex === 11 ? current.year + 1 : current.year,
      current.monthIndex === 11 ? 0 : current.monthIndex + 1
    );
    return billDueDateInMonth(bill.due_day, after.year, after.monthIndex);
  }

  if (bill.recurrence === 'yearly') {
    return paidPeriods.has(periodForISO(from))
      ? billDueDateInMonth(bill.due_day, year + 1, monthIndex)
      : billDueDateInMonth(bill.due_day, year, monthIndex);
  }

  return from;
}

export function daysUntilISO(dueISO: string, from: string): number {
  const [yd, md, dd] = dueISO.split('-').map(Number);
  const [yf, mf, df] = from.split('-').map(Number);
  return Math.round((Date.UTC(yd, md - 1, dd) - Date.UTC(yf, mf - 1, df)) / 86_400_000);
}

export function billStatusFor(
  dueISO: string | null,
  isPaidThisPeriod: boolean,
  from: string
): 'paid' | 'overdue' | 'due-soon' | 'upcoming' {
  if (isPaidThisPeriod) return 'paid';
  if (!dueISO) return 'upcoming';

  const days = daysUntilISO(dueISO, from);
  if (days < 0) return 'overdue';
  if (days <= DUE_SOON_DAYS) return 'due-soon';
  return 'upcoming';
}

// ─── Projections ────────────────────────────────────────────────────────────
//
// Each of these builds the payload field by field. That is the point: a
// `select *` passed straight through would ship account names, ids and
// timestamps to a third party the first time a column was added to a table.
// AI-BOUNDARY §1.3 is enforced here, not hoped for.

export type SummaryRow = {
  total_income_minor: number;
  total_expenses_minor: number;
  remaining_minor: number;
  upcoming_bills_minor: number;
  current_balance_minor: number;
  available_money_minor: number;
};

export function projectSummary(row: SummaryRow | null, month: string, currency = 'PHP') {
  if (!row) return { month, note: 'No financial data recorded yet.' };

  const fmt = (v: number) => formatMoneyForModel(v, currency);

  return {
    month,
    available_money: fmt(row.available_money_minor),
    available_money_explanation:
      'Current Balance minus Upcoming Bills — what can be spent without missing a payment.',
    current_balance: fmt(row.current_balance_minor),
    upcoming_bills: fmt(row.upcoming_bills_minor),
    total_income: fmt(row.total_income_minor),
    total_expenses: fmt(row.total_expenses_minor),
    remaining: fmt(row.remaining_minor),
    remaining_explanation: "Income minus Expenses — what is left of this month's income.",
  };
}

export type BillRow = {
  name: string;
  amount_minor: number;
  currency?: string | null;
  due_date: string | null;
  status: string;
};

export function projectBills(rows: BillRow[]) {
  return rows.map((b) => ({
    name: b.name,
    amount: formatMoneyForModel(b.amount_minor, b.currency ?? 'PHP'),
    due_date: b.due_date,
    status: b.status,
  }));
}

export type ExpenseRow = {
  description: string | null;
  amount_minor: number;
  currency?: string | null;
  transaction_date: string;
  classification: string | null;
  category?: { name: string } | null;
};

export function projectExpenses(rows: ExpenseRow[]) {
  return rows.map((t) => ({
    // User-authored free text. It crosses because "what did I spend on?" is
    // unanswerable without it — and it is DATA, never an instruction
    // (AI-BOUNDARY §6).
    description: t.description ?? 'Expense',
    amount: formatMoneyForModel(t.amount_minor, t.currency ?? 'PHP'),
    date: t.transaction_date,
    category: t.category?.name ?? 'Other',
    classification: t.classification,
  }));
}

export type SpendingRow = { category_name: string; total_minor: number };

export function projectMonthlySpending(rows: SpendingRow[], month: string, currency = 'PHP') {
  return {
    month,
    categories: rows.map((r) => ({
      category: r.category_name,
      total: formatMoneyForModel(r.total_minor, currency),
    })),
  };
}

// ─── Goals and budget ───────────────────────────────────────────────────────
//
// ⚠️  `monthsUntilISO` and the recommendation below MIRROR
// src/features/goals/goals.ts, for the same reason money.ts mirrors lib/money.ts.
// Held by a contract test in tools.test.ts.
//
// The monthly figure has to be computed HERE rather than handed to the model as
// "₱32,000 over 4 months", because §7 is absolute: the model interprets numbers,
// it does not produce them. A model asked to divide will occasionally get it
// wrong, and this is a savings target.

export function monthsUntilISO(targetISO: string, from: string): number {
  const [ty, tm, td] = targetISO.split('-').map(Number);
  const [fy, fm, fd] = from.split('-').map(Number);

  const months = (ty - fy) * 12 + (tm - fm);

  if (Date.UTC(ty, tm - 1, td) <= Date.UTC(fy, fm - 1, fd)) return Math.min(0, months);
  return Math.max(1, months);
}

export type GoalRow = {
  name: string;
  target_minor: number;
  saved_minor: number;
  currency?: string | null;
  target_date: string | null;
};

export function projectGoals(rows: GoalRow[], today: string) {
  return rows.map((g) => {
    const remaining = Math.max(0, g.target_minor - g.saved_minor);
    const achieved = g.saved_minor >= g.target_minor;
    const ratio = g.target_minor > 0 ? Math.min(1, g.saved_minor / g.target_minor) : 0;

    const months = g.target_date ? monthsUntilISO(g.target_date, today) : 0;
    const recommend =
      g.target_date && !achieved && months > 0 ? Math.ceil(remaining / months) : null;

    return {
      name: g.name,
      target: formatMoneyForModel(g.target_minor, g.currency ?? 'PHP'),
      saved: formatMoneyForModel(g.saved_minor, g.currency ?? 'PHP'),
      remaining: formatMoneyForModel(remaining, g.currency ?? 'PHP'),
      percent_complete: Math.floor(ratio * 100),
      target_date: g.target_date,
      months_remaining: g.target_date ? months : null,
      recommended_monthly:
        recommend === null ? null : formatMoneyForModel(recommend, g.currency ?? 'PHP'),
      status: achieved
        ? 'reached'
        : !g.target_date
          ? 'no deadline set'
          : months <= 0
            ? 'target date has passed'
            : 'on track',
    };
  });
}

export type BudgetRow = {
  income_minor: number;
  needs_minor: number;
  wants_minor: number;
  savings_minor: number;
} | null;

export function projectBudget(
  budget: BudgetRow,
  derivedBillsMinor: number,
  actual: { billsMinor: number; needsMinor: number; wantsMinor: number; savingsMinor: number },
  month: string,
  currency = 'PHP'
) {
  const fmt = (v: number) => formatMoneyForModel(v, currency);

  if (!budget) {
    return { month, note: 'No budget has been set for this month.' };
  }

  return {
    month,
    expected_income: fmt(budget.income_minor),
    lines: [
      // Bills first and flagged, so the model does not describe them as a
      // choice the user made.
      {
        name: 'bills',
        planned: fmt(derivedBillsMinor),
        actual: fmt(actual.billsMinor),
        note: 'derived from their bills, not an allocation they chose',
      },
      { name: 'needs', planned: fmt(budget.needs_minor), actual: fmt(actual.needsMinor) },
      { name: 'wants', planned: fmt(budget.wants_minor), actual: fmt(actual.wantsMinor) },
      {
        name: 'savings',
        planned: fmt(budget.savings_minor),
        actual: fmt(actual.savingsMinor),
        note: 'money moved into savings — this is saving, not spending',
      },
    ],
  };
}

export type ScheduleItem = {
  date: string;
  kind: 'event' | 'task' | 'bill';
  title: string;
  detail?: string;
};

export type EventRow = { title: string; event_date: string; kind: string; all_day: boolean };
export type TaskRow = { title: string; due_date: string | null; priority: string; status: string };

/**
 * Money and time on one surface (P§35) — the thing that makes Savi Savi.
 *
 * Bills arrive already projected by the caller from the bills table, never
 * copied out of calendar_events: the calendar's money entries are DERIVED
 * (M8). Reproducing that rule here would let this tool disagree with both.
 */
export function projectSchedule(
  events: EventRow[],
  tasks: TaskRow[],
  bills: { name: string; amount_minor: number; currency?: string | null; due_date: string }[],
  range: { start: string; end: string }
): ScheduleItem[] {
  const inRange = (d: string) => d >= range.start && d <= range.end;

  const items: ScheduleItem[] = [
    ...events
      .filter((e) => inRange(e.event_date))
      .map((e) => ({
        date: e.event_date,
        kind: 'event' as const,
        title: e.title,
        detail: e.kind,
      })),
    ...tasks
      .filter((t) => t.due_date !== null && inRange(t.due_date) && t.status !== 'done')
      .map((t) => ({
        date: t.due_date as string,
        kind: 'task' as const,
        title: t.title,
        detail: `${t.priority} priority`,
      })),
    ...bills
      .filter((b) => inRange(b.due_date))
      .map((b) => ({
        date: b.due_date,
        kind: 'bill' as const,
        title: b.name,
        detail: formatMoneyForModel(b.amount_minor, b.currency ?? 'PHP'),
      })),
  ];

  return items.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
}

/**
 * Dates in the range with nothing on them.
 *
 * A bill due date counts as busy. That is the money+time claim taken seriously:
 * a day the rent leaves the account is not a free day to plan a purchase on,
 * even though nothing is in the calendar.
 */
export function computeFreeDates(
  scheduled: ScheduleItem[],
  range: { start: string; end: string }
): string[] {
  const busy = new Set(scheduled.map((i) => i.date));
  return eachDateISO(range.start, range.end).filter((d) => !busy.has(d));
}
