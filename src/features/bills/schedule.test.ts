import {
  billStatus,
  currentPeriodFor,
  daysUntil,
  dueDateInMonth,
  nextDueDate,
  periodFor,
} from './schedule';

describe('dueDateInMonth', () => {
  it('returns the plain due day', () => {
    expect(dueDateInMonth(15, 2026, 7)).toBe('2026-08-15'); // August
  });

  it('clamps to the last day of a short month', () => {
    // The bug this prevents: a bill due on the 31st rolling into March would
    // mean February had no electricity bill at all, understating that month's
    // Upcoming Bills and overstating Available Money.
    expect(dueDateInMonth(31, 2026, 1)).toBe('2026-02-28');
    expect(dueDateInMonth(31, 2026, 3)).toBe('2026-04-30'); // April has 30
  });

  it('handles leap years', () => {
    expect(dueDateInMonth(31, 2028, 1)).toBe('2028-02-29');
  });

  it('clamps a nonsense day into range', () => {
    expect(dueDateInMonth(0, 2026, 7)).toBe('2026-08-01');
    expect(dueDateInMonth(99, 2026, 7)).toBe('2026-08-31');
  });
});

describe('nextDueDate', () => {
  const monthly = { due_day: 15, recurrence: 'monthly' as const };

  it('is this month when unpaid, even after the day has passed', () => {
    // An overdue bill does not stop being due because the date went by.
    expect(nextDueDate(monthly, new Set(), '2026-08-20')).toBe('2026-08-15');
  });

  it('rolls to next month once this period is paid', () => {
    const paid = new Set(['2026-08-01']);
    expect(nextDueDate(monthly, paid, '2026-08-20')).toBe('2026-09-15');
  });

  it('rolls across a year boundary', () => {
    const paid = new Set(['2026-12-01']);
    expect(nextDueDate(monthly, paid, '2026-12-20')).toBe('2027-01-15');
  });

  it('clamps when the next month is shorter', () => {
    const paid = new Set(['2026-01-01']);
    expect(nextDueDate({ due_day: 31, recurrence: 'monthly' }, paid, '2026-01-31')).toBe(
      '2026-02-28'
    );
  });

  it('returns null for non-recurring bills', () => {
    expect(nextDueDate({ due_day: null, recurrence: 'none' }, new Set())).toBeNull();
  });
});

describe('periodFor / currentPeriodFor', () => {
  it('normalises to the first of the month, matching bill_payments.period', () => {
    expect(periodFor(2026, 7)).toBe('2026-08-01');
    expect(currentPeriodFor('2026-08-14')).toBe('2026-08-01');
  });
});

describe('daysUntil', () => {
  it('counts forward and backward', () => {
    expect(daysUntil('2026-08-15', '2026-08-14')).toBe(1);
    expect(daysUntil('2026-08-14', '2026-08-14')).toBe(0);
    expect(daysUntil('2026-08-10', '2026-08-14')).toBe(-4);
  });
});

describe('billStatus', () => {
  const today = '2026-08-14';

  it('is paid regardless of date once the period is settled', () => {
    expect(billStatus('2026-08-01', true, today)).toBe('paid');
  });

  it('is overdue before today', () => {
    expect(billStatus('2026-08-13', false, today)).toBe('overdue');
  });

  it('is due-soon today and within the window', () => {
    expect(billStatus('2026-08-14', false, today)).toBe('due-soon');
    expect(billStatus('2026-08-17', false, today)).toBe('due-soon');
  });

  it('is upcoming beyond the window', () => {
    expect(billStatus('2026-08-18', false, today)).toBe('upcoming');
  });

  it('treats a bill with no schedule as upcoming, not overdue', () => {
    expect(billStatus(null, false, today)).toBe('upcoming');
  });
});
