import type { Bill } from '@/lib/database.types';

import { billOccursInMonth, nextDueDate } from './schedule';

const bill = (over: Partial<Bill> = {}): Bill =>
  ({
    id: 'b1',
    user_id: 'u1',
    name: 'Internet',
    amount_minor: 169900,
    currency: 'PHP',
    recurrence: 'monthly',
    due_day: 15,
    interval_months: 1,
    anchor_month: null,
    category_id: null,
    account_id: null,
    archived_at: null,
    created_at: '',
    updated_at: '',
    ...over,
  }) as Bill;

describe('billOccursInMonth', () => {
  it('a monthly bill occurs every month, anchor irrelevant', () => {
    const b = bill({ interval_months: 1, anchor_month: null });
    for (let m = 0; m < 12; m += 1) {
      expect(billOccursInMonth(b, 2026, m)).toBe(true);
    }
  });

  it('a quarterly bill anchored in February falls Feb/May/Aug/Nov', () => {
    // The anchor is the whole point: "every 3 months" is not a schedule.
    const b = bill({ interval_months: 3, anchor_month: '2026-02-01' });
    const months = [...Array(12).keys()].filter((m) => billOccursInMonth(b, 2026, m));

    expect(months).toEqual([1, 4, 7, 10]); // Feb, May, Aug, Nov
  });

  it('the same interval anchored in January falls Jan/Apr/Jul/Oct', () => {
    const b = bill({ interval_months: 3, anchor_month: '2026-01-01' });
    const months = [...Array(12).keys()].filter((m) => billOccursInMonth(b, 2026, m));

    expect(months).toEqual([0, 3, 6, 9]);
  });

  it('a half-yearly bill falls twice a year', () => {
    const b = bill({ interval_months: 6, anchor_month: '2026-03-01' });
    const months = [...Array(12).keys()].filter((m) => billOccursInMonth(b, 2026, m));

    expect(months).toEqual([2, 8]); // Mar, Sep
  });

  it('a yearly bill falls once a year, in its anchor month', () => {
    const b = bill({ interval_months: 12, anchor_month: '2026-04-01' });

    expect([...Array(12).keys()].filter((m) => billOccursInMonth(b, 2026, m))).toEqual([3]);
    expect(billOccursInMonth(b, 2027, 3)).toBe(true);
    expect(billOccursInMonth(b, 2027, 4)).toBe(false);
  });

  it('does not occur before its anchor month', () => {
    // A bill you set up in August did not exist in June.
    const b = bill({ interval_months: 3, anchor_month: '2026-08-01' });

    expect(billOccursInMonth(b, 2026, 4)).toBe(false); // May
    expect(billOccursInMonth(b, 2026, 7)).toBe(true); // Aug
    expect(billOccursInMonth(b, 2025, 7)).toBe(false); // Aug last year
  });

  it('crosses a year boundary correctly', () => {
    const b = bill({ interval_months: 3, anchor_month: '2026-11-01' });

    expect(billOccursInMonth(b, 2026, 10)).toBe(true); // Nov 2026
    expect(billOccursInMonth(b, 2027, 1)).toBe(true); // Feb 2027
    expect(billOccursInMonth(b, 2027, 0)).toBe(false); // Jan 2027
  });

  it('treats a non-monthly bill with no anchor as never occurring', () => {
    // Unschedulable — and the DB constraint refuses to store one, so this is
    // belt and braces rather than an expected state.
    expect(billOccursInMonth(bill({ interval_months: 3, anchor_month: null }), 2026, 5)).toBe(
      false
    );
  });
});

describe('nextDueDate with intervals', () => {
  it('a quarterly bill unpaid this month is due this month', () => {
    const b = bill({ interval_months: 3, anchor_month: '2026-02-01', due_day: 15 });
    expect(nextDueDate(b, new Set(), '2026-08-20')).toBe('2026-08-15');
  });

  it('once paid, it skips to the next OCCURRING month, not next month', () => {
    // The bug this guards: a quarterly bill jumping to September because the
    // code added one month instead of three.
    const b = bill({ interval_months: 3, anchor_month: '2026-02-01', due_day: 15 });
    expect(nextDueDate(b, new Set(['2026-08-01']), '2026-08-20')).toBe('2026-11-15');
  });

  it('in a month it does not occur, it points at the next month it does', () => {
    const b = bill({ interval_months: 3, anchor_month: '2026-02-01', due_day: 15 });
    // September is not a quarter month; the next one is November.
    expect(nextDueDate(b, new Set(), '2026-09-05')).toBe('2026-11-15');
  });

  it('still clamps the day in a short month', () => {
    // The 31st in February is the 28th — the M4 rule, unchanged by intervals.
    const b = bill({ interval_months: 3, anchor_month: '2026-02-01', due_day: 31 });
    expect(nextDueDate(b, new Set(), '2026-02-01')).toBe('2026-02-28');
  });

  it('leaves monthly bills behaving exactly as before', () => {
    const b = bill({ interval_months: 1, anchor_month: null, due_day: 15 });

    expect(nextDueDate(b, new Set(), '2026-08-20')).toBe('2026-08-15');
    expect(nextDueDate(b, new Set(['2026-08-01']), '2026-08-20')).toBe('2026-09-15');
  });

  it('handles a yearly interval across the year boundary', () => {
    const b = bill({ interval_months: 12, anchor_month: '2026-12-01', due_day: 10 });

    expect(nextDueDate(b, new Set(), '2026-12-01')).toBe('2026-12-10');
    expect(nextDueDate(b, new Set(['2026-12-01']), '2026-12-15')).toBe('2027-12-10');
  });
});
