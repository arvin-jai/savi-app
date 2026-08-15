import { dayLabel, dueLabel, groupByDay, parseISODate, todayISO } from './dates';

describe('parseISODate', () => {
  it('parses as a LOCAL date, not UTC', () => {
    // The bug this guards: new Date('2026-08-14') is UTC midnight, which is
    // Aug 13 in any negative-offset zone — an evening purchase would render
    // as "Yesterday".
    const d = parseISODate('2026-08-14');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // August, zero-indexed
    expect(d.getDate()).toBe(14);
  });
});

describe('todayISO', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('dayLabel', () => {
  const today = '2026-08-14';

  it('labels today and its neighbours relatively', () => {
    expect(dayLabel('2026-08-14', today)).toBe('Today');
    expect(dayLabel('2026-08-13', today)).toBe('Yesterday');
    expect(dayLabel('2026-08-15', today)).toBe('Tomorrow');
  });

  it('uses weekday names within the past week', () => {
    // 2026-08-10 is a Monday.
    expect(dayLabel('2026-08-10', today)).toBe('Monday');
  });

  it('falls back to an absolute date beyond a week', () => {
    // "8 days ago" is harder to place than a date.
    expect(dayLabel('2026-08-06', today)).toBe('Aug 6');
  });

  it('includes the year when it differs', () => {
    expect(dayLabel('2025-12-25', today)).toBe('Dec 25, 2025');
  });
});

describe('dueLabel', () => {
  const today = '2026-08-14';

  it('phrases upcoming dates calmly (D§63)', () => {
    expect(dueLabel('2026-08-14', today)).toBe('Due today');
    expect(dueLabel('2026-08-15', today)).toBe('Due tomorrow');
    expect(dueLabel('2026-08-17', today)).toBe('Due in 3 days');
  });

  it('states overdue plainly without alarm', () => {
    expect(dueLabel('2026-08-13', today)).toBe('Overdue by 1 day');
    expect(dueLabel('2026-08-09', today)).toBe('Overdue by 5 days');
  });
});

describe('groupByDay', () => {
  it('groups consecutive items and preserves order', () => {
    const items = [
      { d: '2026-08-14', n: 1 },
      { d: '2026-08-14', n: 2 },
      { d: '2026-08-13', n: 3 },
    ];
    const groups = groupByDay(items, (i) => i.d);

    expect(groups).toHaveLength(2);
    expect(groups[0][0]).toBe('2026-08-14');
    expect(groups[0][1]).toHaveLength(2);
    expect(groups[1][0]).toBe('2026-08-13');
  });

  it('returns nothing for an empty list', () => {
    expect(groupByDay([], (x) => String(x))).toEqual([]);
  });
});
