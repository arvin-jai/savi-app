import type { WorkSchedule, WorkShiftException } from '@/lib/database.types';

import { describeSchedule, expandShifts, shiftHoursLabel } from './shifts';

const schedule = (over: Partial<WorkSchedule> = {}): WorkSchedule => ({
  id: 'sched-1',
  user_id: 'u1',
  name: 'Day shift',
  days_of_week: [1, 3, 5], // Mon, Wed, Fri
  start_time: '09:00:00',
  end_time: '17:00:00',
  effective_from: '2026-08-01',
  effective_to: null,
  archived_at: null,
  created_at: '',
  updated_at: '',
  ...over,
});

const exception = (over: Partial<WorkShiftException> = {}): WorkShiftException => ({
  id: 'ex-1',
  user_id: 'u1',
  schedule_id: 'sched-1',
  shift_date: '2026-08-19',
  kind: 'skipped',
  start_time: null,
  end_time: null,
  created_at: '',
  ...over,
});

describe('expandShifts', () => {
  it('produces a shift on each matching weekday', () => {
    // 2026-08-17 is a Monday. Mon/Wed/Fri across that week → 17, 19, 21.
    const shifts = expandShifts([schedule()], [], '2026-08-17', '2026-08-23');

    expect(shifts.map((s) => s.date)).toEqual(['2026-08-17', '2026-08-19', '2026-08-21']);
    expect(shifts[0]).toMatchObject({ name: 'Day shift', startTime: '09:00:00', moved: false });
  });

  it('produces nothing before effective_from', () => {
    const shifts = expandShifts(
      [schedule({ effective_from: '2026-08-20' })],
      [],
      '2026-08-17',
      '2026-08-23'
    );
    expect(shifts.map((s) => s.date)).toEqual(['2026-08-21']);
  });

  it('produces nothing after effective_to', () => {
    // A job you left in June must not generate shifts in July.
    const shifts = expandShifts(
      [schedule({ effective_to: '2026-08-19' })],
      [],
      '2026-08-17',
      '2026-08-23'
    );
    expect(shifts.map((s) => s.date)).toEqual(['2026-08-17', '2026-08-19']);
  });

  it('ignores archived schedules entirely', () => {
    expect(
      expandShifts([schedule({ archived_at: '2026-08-01T00:00:00Z' })], [], '2026-08-17', '2026-08-23')
    ).toEqual([]);
  });

  it('removes a skipped shift without touching the rest of the series', () => {
    // The case that breaks every recurring-event model: one date changed, the
    // rule intact.
    const shifts = expandShifts([schedule()], [exception()], '2026-08-17', '2026-08-23');

    expect(shifts.map((s) => s.date)).toEqual(['2026-08-17', '2026-08-21']);
  });

  it('applies moved hours to one date only', () => {
    const shifts = expandShifts(
      [schedule()],
      [exception({ kind: 'moved', start_time: '13:00:00', end_time: '21:00:00' })],
      '2026-08-17',
      '2026-08-23'
    );

    const moved = shifts.find((s) => s.date === '2026-08-19')!;
    expect(moved).toMatchObject({ startTime: '13:00:00', endTime: '21:00:00', moved: true });

    // Every other date keeps the rule's hours.
    for (const s of shifts.filter((x) => x.date !== '2026-08-19')) {
      expect(s).toMatchObject({ startTime: '09:00:00', moved: false });
    }
  });

  it('does not apply another schedule’s exception', () => {
    const shifts = expandShifts(
      [schedule(), schedule({ id: 'sched-2', name: 'Night shift', days_of_week: [1] })],
      [exception({ schedule_id: 'sched-1', shift_date: '2026-08-17' })],
      '2026-08-17',
      '2026-08-17'
    );

    // Only the night shift survives on the 17th.
    expect(shifts.map((s) => s.name)).toEqual(['Night shift']);
  });

  it('handles a schedule that runs every day', () => {
    const shifts = expandShifts(
      [schedule({ days_of_week: [0, 1, 2, 3, 4, 5, 6] })],
      [],
      '2026-08-17',
      '2026-08-23'
    );
    expect(shifts).toHaveLength(7);
  });

  it('crosses a month boundary without skipping or repeating a date', () => {
    // Built by incrementing a Date, not by adding 86.4M ms — that arithmetic
    // drifts across a DST boundary and eventually loses a day.
    const shifts = expandShifts(
      [schedule({ days_of_week: [0, 1, 2, 3, 4, 5, 6], effective_from: '2026-01-01' })],
      [],
      '2026-01-30',
      '2026-02-02'
    );

    expect(shifts.map((s) => s.date)).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ]);
  });

  it('sorts by date, then start time, then name', () => {
    const shifts = expandShifts(
      [
        schedule({ id: 'a', name: 'Evening', days_of_week: [1], start_time: '17:00:00', end_time: '23:00:00' }),
        schedule({ id: 'b', name: 'Morning', days_of_week: [1], start_time: '06:00:00', end_time: '12:00:00' }),
      ],
      [],
      '2026-08-17',
      '2026-08-17'
    );

    expect(shifts.map((s) => s.name)).toEqual(['Morning', 'Evening']);
  });

  it('gives every shift a stable, unique id', () => {
    const shifts = expandShifts([schedule()], [], '2026-08-01', '2026-08-31');
    const ids = shifts.map((s) => s.id);

    expect(new Set(ids).size).toBe(ids.length);
    // Stable across calls, so a list keyed on it does not remount every render.
    expect(expandShifts([schedule()], [], '2026-08-01', '2026-08-31').map((s) => s.id)).toEqual(ids);
  });
});

describe('shiftHoursLabel', () => {
  it('renders a range without seconds', () => {
    const [shift] = expandShifts([schedule()], [], '2026-08-17', '2026-08-17');
    expect(shiftHoursLabel(shift)).toBe('09:00–17:00');
  });

  it('returns null for an all-day schedule rather than inventing hours', () => {
    const [shift] = expandShifts(
      [schedule({ start_time: null, end_time: null })],
      [],
      '2026-08-17',
      '2026-08-17'
    );
    expect(shiftHoursLabel(shift)).toBeNull();
  });
});

describe('describeSchedule', () => {
  it('collapses a run of three or more into a range', () => {
    expect(describeSchedule(schedule({ days_of_week: [1, 2, 3, 4, 5] }))).toBe(
      'Mon–Fri · 09:00–17:00'
    );
  });

  it('does not collapse a pair — "Mon–Tue" is longer than "Mon, Tue"', () => {
    expect(describeSchedule(schedule({ days_of_week: [1, 2] }))).toBe('Mon, Tue · 09:00–17:00');
  });

  it('lists non-consecutive days', () => {
    expect(describeSchedule(schedule())).toBe('Mon, Wed, Fri · 09:00–17:00');
  });

  it('handles a split week', () => {
    expect(describeSchedule(schedule({ days_of_week: [1, 2, 3, 6] }))).toBe(
      'Mon–Wed, Sat · 09:00–17:00'
    );
  });

  it('says All day when there are no hours', () => {
    expect(describeSchedule(schedule({ start_time: null, end_time: null }))).toBe(
      'Mon, Wed, Fri · All day'
    );
  });
});
