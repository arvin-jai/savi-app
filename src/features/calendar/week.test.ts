import { shiftWeek, weekBounds, weekDates, weekLabel } from './week';

describe('weekDates', () => {
  it('returns the Sunday-anchored week containing the date', () => {
    // 2026-08-15 is a Saturday, so its week runs Sun 9 → Sat 15.
    expect(weekDates('2026-08-15')).toEqual([
      '2026-08-09',
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
    ]);
  });

  it('returns the same week from any day inside it', () => {
    const fromSaturday = weekDates('2026-08-15');
    for (const d of fromSaturday) {
      expect(weekDates(d)).toEqual(fromSaturday);
    }
  });

  it('is always seven consecutive days', () => {
    for (const anchor of ['2026-01-01', '2026-02-28', '2026-12-31', '2024-02-29']) {
      const week = weekDates(anchor);
      expect(week).toHaveLength(7);
      expect(new Set(week).size).toBe(7);
    }
  });

  it('crosses a month boundary without skipping or repeating a date', () => {
    expect(weekDates('2026-09-01')).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
    ]);
  });

  it('crosses a year boundary', () => {
    expect(weekDates('2027-01-01')).toContain('2026-12-31');
    expect(weekDates('2027-01-01')).toContain('2027-01-01');
  });

  it('handles a leap day', () => {
    expect(weekDates('2024-02-29')).toContain('2024-02-29');
    expect(weekDates('2024-02-29')).toHaveLength(7);
  });
});

describe('weekBounds', () => {
  it('spans the first and last day of the week', () => {
    expect(weekBounds('2026-08-15')).toEqual({ start: '2026-08-09', end: '2026-08-15' });
  });
});

describe('shiftWeek', () => {
  it('moves exactly seven days', () => {
    expect(shiftWeek('2026-08-15', 1)).toBe('2026-08-22');
    expect(shiftWeek('2026-08-15', -1)).toBe('2026-08-08');
  });

  it('moves across a month boundary', () => {
    expect(shiftWeek('2026-08-29', 1)).toBe('2026-09-05');
  });

  it('round-trips', () => {
    expect(shiftWeek(shiftWeek('2026-08-15', 4), -4)).toBe('2026-08-15');
  });
});

describe('weekLabel', () => {
  it('omits the repeated month within a single month', () => {
    expect(weekLabel('2026-08-15')).toBe('Aug 9 – 15');
  });

  it('names both months when the week straddles two', () => {
    // "Aug 30 – 5" would be nonsense; the second month has to appear.
    expect(weekLabel('2026-09-01')).toBe('Aug 30 – Sep 5');
  });
});
