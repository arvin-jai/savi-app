/**
 * The AI boundary, under test.
 *
 * Two kinds of test live here and they exist for different reasons:
 *
 *  1. **Contract tests.** The Edge Function runs in Deno and cannot import
 *     `@/lib/money` or `@/features/bills/schedule`, so those rules are mirrored
 *     in money.ts and tools.ts. These tests run BOTH implementations over the
 *     same cases. They are the only thing keeping "one formatMoney" and "one
 *     due-date rule" true across the Deno boundary — if either side drifts,
 *     this file fails.
 *
 *  2. **Boundary tests.** docs/AI-BOUNDARY.md §1.3 lists what must never reach
 *     the model. A prose list is not a guarantee; these assert it.
 */

import {
  billOccursInMonth,
  billStatus,
  dueDateInMonth,
  nextDueDate,
} from '@/features/bills/schedule';
import { monthsUntil } from '@/features/goals/goals';
import { formatMoney } from '@/lib/money';

import { formatMoneyForModel } from './money';
import {
  billDueDateInMonth,
  billStatusFor,
  clampLimit,
  computeFreeDates,
  eachDateISO,
  billOccursIn,
  isToolName,
  monthsUntilISO,
  nextBillDueDate,
  parseISODateArg,
  projectBills,
  projectBudget,
  projectExpenses,
  projectGoals,
  projectMonthlySpending,
  projectSchedule,
  projectSummary,
  resolveMonth,
  resolveRange,
  TOOL_NAMES,
} from './tools';

// ─── Contract: money formatting ─────────────────────────────────────────────

describe('formatMoneyForModel agrees with the app formatMoney', () => {
  const cases = [
    0,
    1, // sub-centavo edge: ₱0.01
    50,
    99,
    100, // exactly ₱1
    169900, // a real bill
    1_000_00,
    3_000_000, // exact thousands — grouping
    2_345_678_9,
    -130000, // negative Available Money must stay visible (D§26 A1)
    -1,
    100_000_000_00,
  ];

  it.each(cases)('matches for %i minor units', (minor) => {
    expect(formatMoneyForModel(minor)).toBe(formatMoney(minor));
  });

  it('hides decimals when the minor part is zero', () => {
    expect(formatMoneyForModel(169900)).toBe('₱1,699');
  });

  it('shows decimals when there are centavos', () => {
    expect(formatMoneyForModel(169950)).toBe('₱1,699.50');
  });

  it('refuses a float, because that means one leaked into the ledger', () => {
    expect(() => formatMoneyForModel(12.5)).toThrow(TypeError);
  });

  it('never abbreviates — the model may need to compare figures', () => {
    expect(formatMoneyForModel(3_000_000)).toBe('₱30,000');
  });
});

// ─── Contract: bill scheduling ──────────────────────────────────────────────

describe('bill scheduling agrees with the app schedule.ts', () => {
  it.each([
    [15, 2026, 7],
    [1, 2026, 7],
    [31, 2026, 1], // the one that matters: Feb clamps to the 28th
    [31, 2024, 1], // leap year → the 29th
    [31, 2026, 3], // 30-day April
    [40, 2026, 7], // out of range, clamped high
    [0, 2026, 7], // out of range, clamped low
  ])('dueDateInMonth(%i, %i, %i)', (day, year, monthIndex) => {
    expect(billDueDateInMonth(day, year, monthIndex)).toBe(
      dueDateInMonth(day, year, monthIndex)
    );
  });

  it('clamps the 31st to the end of February rather than rolling into March', () => {
    // Rolling forward would mean February had no electricity bill at all, so
    // Upcoming Bills would be understated and Available Money OVERSTATED.
    expect(billDueDateInMonth(31, 2026, 1)).toBe('2026-02-28');
  });

  it.each([
    ['2026-08-15', 15, [] as string[]],
    ['2026-08-20', 15, []], // unpaid and past → still this month's date
    ['2026-08-20', 15, ['2026-08-01']], // paid → next month
    ['2026-12-20', 15, ['2026-12-01']], // year rollover
    ['2026-01-31', 31, []],
  ])('nextDueDate from %s, due day %i', (from, dueDay, paid) => {
    const bill = {
      due_day: dueDay,
      recurrence: 'monthly' as const,
      interval_months: 1,
      anchor_month: null,
    };
    const paidPeriods = new Set(paid);

    expect(nextBillDueDate(bill, paidPeriods, from)).toBe(
      nextDueDate(bill, paidPeriods, from)
    );
  });

  it.each([
    // Every-N-months bills: the mirror must agree with the app, or Ask Savi
    // will report a quarterly bill as due in a month it is not.
    ['2026-08-20', 3, '2026-02-01', [] as string[]],
    ['2026-09-05', 3, '2026-02-01', []], // Sep is not a quarter month → Nov
    ['2026-08-20', 3, '2026-02-01', ['2026-08-01']], // paid → skips 3, not 1
    ['2026-12-01', 12, '2026-12-01', []],
    ['2026-12-15', 12, '2026-12-01', ['2026-12-01']],
    ['2026-03-10', 6, '2026-03-01', []],
  ])('nextDueDate from %s every %i months anchored %s', (from, interval, anchor, paid) => {
    const b = {
      due_day: 15,
      recurrence: 'monthly' as const,
      interval_months: interval as number,
      anchor_month: anchor as string,
    };
    const paidPeriods = new Set(paid as string[]);

    expect(nextBillDueDate(b, paidPeriods, from as string)).toBe(
      nextDueDate(b as never, paidPeriods, from as string)
    );
  });

  it.each([
    [3, '2026-02-01'],
    [6, '2026-03-01'],
    [12, '2026-04-01'],
    [1, null],
  ])('billOccursIn matches the app for every month, interval %i', (interval, anchor) => {
    const b = { interval_months: interval as number, anchor_month: anchor as string | null };

    for (let m = 0; m < 12; m += 1) {
      expect(billOccursIn(b, 2026, m)).toBe(billOccursInMonth(b as never, 2026, m));
      expect(billOccursIn(b, 2027, m)).toBe(billOccursInMonth(b as never, 2027, m));
    }
  });

  it.each([
    ['2026-08-20', '2026-08-15', false, 'overdue'],
    ['2026-08-15', '2026-08-16', false, 'due-soon'],
    ['2026-08-15', '2026-08-15', false, 'due-soon'],
    ['2026-08-15', '2026-08-30', false, 'upcoming'],
    ['2026-08-15', '2026-08-16', true, 'paid'],
  ])('billStatus from %s due %s paid=%s', (from, due, paid, expected) => {
    expect(billStatusFor(due, paid as boolean, from)).toBe(expected);
    expect(billStatusFor(due, paid as boolean, from)).toBe(
      billStatus(due, paid as boolean, from)
    );
  });
});

// ─── Contract: goal scheduling ──────────────────────────────────────────────

describe('monthsUntilISO agrees with the app monthsUntil', () => {
  const TODAY = '2026-08-15';

  it.each([
    '2026-12-20', // 4 months out
    '2026-09-05', // partial final month → still 1
    '2026-08-20', // later this month → 1, never 0
    '2027-01-20', // year boundary
    '2026-08-01', // already passed
    '2026-07-20', // well passed
  ])('matches for %s', (target) => {
    expect(monthsUntilISO(target, TODAY)).toBe(monthsUntil(target, TODAY));
  });
});

describe('projectGoals', () => {
  const TODAY = '2026-08-15';

  it('computes the monthly figure server-side, formatted', () => {
    // §7: the model interprets numbers, it never produces them. Handing it
    // "₱32,000 over 4 months" and hoping it divides is the thing this prevents.
    const out = projectGoals(
      [
        {
          name: 'Emergency fund',
          target_minor: 5_000_000,
          saved_minor: 1_800_000,
          currency: 'PHP',
          target_date: '2026-12-20',
        },
      ],
      TODAY
    );

    expect(out[0]).toMatchObject({
      target: '₱50,000',
      saved: '₱18,000',
      remaining: '₱32,000',
      percent_complete: 36,
      months_remaining: 4,
      recommended_monthly: '₱8,000',
      status: 'on track',
    });
  });

  it('says there is no deadline rather than inventing one', () => {
    const out = projectGoals(
      [{ name: 'Someday', target_minor: 100, saved_minor: 0, target_date: null }],
      TODAY
    );

    expect(out[0].recommended_monthly).toBeNull();
    expect(out[0].months_remaining).toBeNull();
    expect(out[0].status).toBe('no deadline set');
  });

  it('reports a reached goal without a further contribution', () => {
    const out = projectGoals(
      [
        {
          name: 'Laptop',
          target_minor: 100,
          saved_minor: 100,
          target_date: '2026-12-20',
        },
      ],
      TODAY
    );

    expect(out[0].status).toBe('reached');
    expect(out[0].recommended_monthly).toBeNull();
  });

  it('flags a passed target date instead of a negative monthly amount', () => {
    const out = projectGoals(
      [{ name: 'Late', target_minor: 100_000, saved_minor: 20_000, target_date: '2026-07-01' }],
      TODAY
    );

    expect(out[0].status).toBe('target date has passed');
    expect(out[0].recommended_monthly).toBeNull();
  });
});

describe('projectBudget', () => {
  const actual = {
    billsMinor: 169_900,
    needsMinor: 300_000,
    wantsMinor: 120_000,
    savingsMinor: 500_000,
  };

  it('marks bills as derived and savings as saving, in the payload itself', () => {
    // The model is told what these lines MEAN rather than being left to infer
    // it — the same reason the summary carries its two explanations.
    const out = projectBudget(
      { income_minor: 3_000_000, needs_minor: 1_000_000, wants_minor: 700_000, savings_minor: 500_000 },
      520_000,
      actual,
      '2026-08-01'
    );

    const lines = (out as { lines: { name: string; note?: string }[] }).lines;
    expect(lines.find((l) => l.name === 'bills')!.note).toContain('not an allocation');
    expect(lines.find((l) => l.name === 'savings')!.note).toContain('not spending');
  });

  it('says plainly when no budget is set, rather than reporting zeroes', () => {
    expect(projectBudget(null, 520_000, actual, '2026-08-01')).toEqual({
      month: '2026-08-01',
      note: 'No budget has been set for this month.',
    });
  });
});

// ─── The registry is an allowlist ───────────────────────────────────────────

describe('tool registry', () => {
  it('contains exactly the eight read-only tools', () => {
    expect(TOOL_NAMES).toHaveLength(8);
    expect([...TOOL_NAMES]).toEqual([
      'get_financial_summary',
      'get_upcoming_bills',
      'get_recent_expenses',
      'get_monthly_spending',
      'get_schedule',
      'get_free_time',
      'get_financial_goals',
      'get_budget',
    ]);
  });

  it.each([
    'create_transaction',
    'delete_transaction',
    'move_money',
    'update_bill',
    'create_task',
    'set_budget',
    '',
    'GET_FINANCIAL_SUMMARY',
  ])('refuses %s', (name) => {
    expect(isToolName(name)).toBe(false);
  });

  it('every registered tool is a read', () => {
    // The guarantee AI-BOUNDARY §5.1 makes: write tools are not disabled, they
    // are absent. If a name here ever starts with a verb that changes something,
    // this fails before it ships.
    for (const name of TOOL_NAMES) {
      expect(name).toMatch(/^get_/);
    }
  });
});

// ─── Boundary: what must never cross ────────────────────────────────────────

describe('projections withhold everything AI-BOUNDARY §1.3 lists', () => {
  const FORBIDDEN = [
    'id',
    'user_id',
    'account_id',
    'email',
    'display_name',
    'account_name',
    'created_at',
  ];

  function assertNoForbiddenKeys(payload: unknown) {
    const seen = JSON.stringify(payload);
    for (const key of FORBIDDEN) {
      expect(seen).not.toContain(`"${key}"`);
    }
  }

  it('projectExpenses drops ids, accounts and timestamps even when the row carries them', () => {
    const rows = [
      {
        id: 'txn-uuid',
        user_id: 'user-uuid',
        account_id: 'acct-uuid',
        account_name: 'BPI Savings ****1234',
        created_at: '2026-08-14T10:00:00Z',
        description: 'Lunch',
        amount_minor: 30000,
        currency: 'PHP',
        transaction_date: '2026-08-14',
        classification: 'need',
        category: { name: 'Food' },
      },
    ] as never;

    const out = projectExpenses(rows);
    assertNoForbiddenKeys(out);
    expect(out).toEqual([
      {
        description: 'Lunch',
        amount: '₱300',
        date: '2026-08-14',
        category: 'Food',
        classification: 'need',
      },
    ]);
  });

  it('projectBills exposes only name, amount, date and status', () => {
    const out = projectBills([
      {
        name: 'Internet',
        amount_minor: 169900,
        currency: 'PHP',
        due_date: '2026-08-15',
        status: 'due-soon',
      },
    ] as never);

    assertNoForbiddenKeys(out);
    expect(Object.keys(out[0]).sort()).toEqual(['amount', 'due_date', 'name', 'status']);
  });

  it('every money value crosses as a formatted string, never a raw integer (§7)', () => {
    const summary = projectSummary(
      {
        total_income_minor: 3_000_000,
        total_expenses_minor: 1_755_000,
        remaining_minor: 1_245_000,
        upcoming_bills_minor: 520_000,
        current_balance_minor: 2_130_000,
        available_money_minor: 1_610_000,
      },
      '2026-08-01'
    );

    expect(summary).toMatchObject({
      available_money: '₱16,100',
      current_balance: '₱21,300',
      upcoming_bills: '₱5,200',
      remaining: '₱12,450',
    });

    // No key anywhere still holds minor units.
    expect(JSON.stringify(summary)).not.toContain('1610000');
  });

  it('keeps a negative Available Money visible rather than flooring at zero', () => {
    // D§26 A1: this is the single most useful thing Savi can say, and hiding it
    // fails the user at the exact moment they need the app.
    const summary = projectSummary(
      {
        total_income_minor: 0,
        total_expenses_minor: 0,
        remaining_minor: 0,
        upcoming_bills_minor: 300_000,
        current_balance_minor: 170_000,
        available_money_minor: -130_000,
      },
      '2026-08-01'
    );

    expect(summary).toMatchObject({ available_money: '-₱1,300' });
  });

  it('distinguishes Remaining from Available Money in the payload itself', () => {
    // BUILD-PLAN P1 was these two being conflated. The model is told which is
    // which rather than being left to infer it from the names.
    const summary = projectSummary(
      {
        total_income_minor: 100,
        total_expenses_minor: 0,
        remaining_minor: 100,
        upcoming_bills_minor: 0,
        current_balance_minor: 100,
        available_money_minor: 100,
      },
      '2026-08-01'
    );

    expect(summary).toMatchObject({
      available_money_explanation: expect.stringContaining('without missing a payment'),
      remaining_explanation: expect.stringContaining("left of this month's income"),
    });
  });

  it('says so plainly when there is no data, rather than reporting zeroes', () => {
    // Zeroes read to a model as "this user has ₱0", which is a different and
    // alarming claim from "nothing recorded yet".
    expect(projectSummary(null, '2026-08-01')).toEqual({
      month: '2026-08-01',
      note: 'No financial data recorded yet.',
    });
  });
});

// ─── Argument handling ──────────────────────────────────────────────────────

describe('tool arguments are validated, not trusted', () => {
  it.each(['2026-08-15', '2024-02-29'])('accepts the real date %s', (d) => {
    expect(parseISODateArg(d)).toBe(d);
  });

  it.each(['2026-02-31', '2026-13-01', '2026-8-15', 'tomorrow', '', null, 42, undefined])(
    'rejects %s',
    (d) => {
      expect(parseISODateArg(d)).toBeNull();
    }
  );

  it('rejects Feb 31 rather than letting Date roll it into March', () => {
    expect(parseISODateArg('2026-02-31')).toBeNull();
  });

  it.each([
    [undefined, 10],
    [5, 5],
    [0, 1],
    [-3, 1],
    [500, 20],
    [7.9, 7],
    ['many', 10],
  ])('clampLimit(%s) → %i', (input, expected) => {
    expect(clampLimit(input)).toBe(expected);
  });

  it('resolveMonth normalises any date to the first of its month', () => {
    expect(resolveMonth('2026-08-15', '2026-08-15')).toBe('2026-08-01');
    expect(resolveMonth(undefined, '2026-08-15')).toBe('2026-08-01');
    expect(resolveMonth('rubbish', '2026-03-09')).toBe('2026-03-01');
  });

  it('bounds an over-long range at 90 days', () => {
    const r = resolveRange('2026-01-01', '2027-01-01', '2026-01-01');
    expect(r).toEqual({ start: '2026-01-01', end: '2026-04-01' });
  });

  it('repairs a backwards range instead of returning nothing', () => {
    // An empty result reads to the model as "you have no bills" — a wrong
    // answer about money that it has no way to attribute to its own arguments.
    const r = resolveRange('2026-08-15', '2026-08-01', '2026-08-15');
    expect(r).toEqual({ start: '2026-08-15', end: '2026-08-29' });
  });

  it('defaults to a 14-day window from today', () => {
    expect(resolveRange(undefined, undefined, '2026-08-15')).toEqual({
      start: '2026-08-15',
      end: '2026-08-29',
    });
  });

  it('enumerates dates inclusively across a month boundary', () => {
    expect(eachDateISO('2026-01-30', '2026-02-02')).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ]);
  });
});

// ─── Schedule: money and time on one surface ────────────────────────────────

describe('projectSchedule', () => {
  const range = { start: '2026-08-14', end: '2026-08-20' };

  const events = [
    { title: 'Dentist', event_date: '2026-08-18', kind: 'appointment', all_day: false },
    { title: 'Out of range', event_date: '2026-09-01', kind: 'personal', all_day: true },
  ];
  const tasks = [
    { title: 'File taxes', due_date: '2026-08-16', priority: 'high', status: 'todo' },
    { title: 'Already done', due_date: '2026-08-17', priority: 'low', status: 'done' },
    { title: 'No due date', due_date: null, priority: 'low', status: 'todo' },
  ];
  const bills = [
    { name: 'Internet', amount_minor: 169900, currency: 'PHP', due_date: '2026-08-15' },
  ];

  it('merges events, open tasks and bill due dates in date order', () => {
    const out = projectSchedule(events, tasks, bills, range);

    expect(out).toEqual([
      { date: '2026-08-15', kind: 'bill', title: 'Internet', detail: '₱1,699' },
      { date: '2026-08-16', kind: 'task', title: 'File taxes', detail: 'high priority' },
      { date: '2026-08-18', kind: 'event', title: 'Dentist', detail: 'appointment' },
    ]);
  });

  it('drops completed tasks, undated tasks, and anything outside the range', () => {
    const out = projectSchedule(events, tasks, bills, range);
    const titles = out.map((i) => i.title);

    expect(titles).not.toContain('Already done');
    expect(titles).not.toContain('No due date');
    expect(titles).not.toContain('Out of range');
  });

  it('counts a bill due date as a busy day', () => {
    // The money+time claim taken seriously: a day the rent leaves the account
    // is not a free day to plan a purchase on, even with an empty calendar.
    const scheduled = projectSchedule(events, tasks, bills, range);
    const free = computeFreeDates(scheduled, range);

    expect(free).not.toContain('2026-08-15');
    expect(free).toEqual(['2026-08-14', '2026-08-17', '2026-08-19', '2026-08-20']);
  });
});

describe('projectMonthlySpending', () => {
  it('formats each category total and keeps the SQL ordering', () => {
    const out = projectMonthlySpending(
      [
        { category_name: 'Food', total_minor: 450000 },
        { category_name: 'Transport', total_minor: 120050 },
      ],
      '2026-08-01'
    );

    expect(out).toEqual({
      month: '2026-08-01',
      categories: [
        { category: 'Food', total: '₱4,500' },
        { category: 'Transport', total: '₱1,200.50' },
      ],
    });
  });
});
