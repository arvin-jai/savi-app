import {
  goalEncouragement,
  goalProgress,
  goalStatus,
  monthsUntil,
  recommendedMonthlyMinor,
} from './goals';

const TODAY = '2026-08-15';

describe('goalProgress', () => {
  it('reports ratio, percent and what is left', () => {
    const p = goalProgress({ target_minor: 5_000_000, saved_minor: 1_800_000 });

    expect(p.ratio).toBeCloseTo(0.36);
    expect(p.percent).toBe(36);
    expect(p.remainingMinor).toBe(3_200_000);
    expect(p.achieved).toBe(false);
  });

  it('clamps over-saving to a full bar rather than 130%', () => {
    const p = goalProgress({ target_minor: 1_000_000, saved_minor: 1_300_000 });

    expect(p.ratio).toBe(1);
    expect(p.percent).toBe(100);
    expect(p.remainingMinor).toBe(0);
    expect(p.achieved).toBe(true);
  });

  it('floors the percent so a short bar never claims 100%', () => {
    // 99.7% next to a visibly incomplete bar would read as a bug, and worse,
    // as a goal being done when it is not.
    const p = goalProgress({ target_minor: 1_000_000, saved_minor: 997_000 });

    expect(p.percent).toBe(99);
    expect(p.achieved).toBe(false);
  });

  it('survives a zero target instead of producing Infinity', () => {
    const p = goalProgress({ target_minor: 0, saved_minor: 500 });

    expect(Number.isFinite(p.ratio)).toBe(true);
    expect(p.percent).toBe(0);
  });
});

describe('monthsUntil', () => {
  it.each([
    ['2026-12-20', 4],
    ['2026-09-20', 1],
    ['2027-08-20', 12],
  ])('counts %s as %i months out', (target, expected) => {
    expect(monthsUntil(target, TODAY)).toBe(expected);
  });

  it('counts a partial final month as one, not zero', () => {
    // Three weeks left is not "0 months" — that would divide by zero and the
    // user would see no recommendation at the moment it matters most.
    expect(monthsUntil('2026-09-05', TODAY)).toBe(1);
  });

  it('returns zero or less once the date has passed', () => {
    expect(monthsUntil('2026-08-01', TODAY)).toBeLessThanOrEqual(0);
    expect(monthsUntil('2026-07-20', TODAY)).toBeLessThanOrEqual(0);
  });

  it('handles a year boundary', () => {
    expect(monthsUntil('2027-01-20', TODAY)).toBe(5);
  });
});

describe('recommendedMonthlyMinor', () => {
  it('divides what is left by the months remaining', () => {
    // ₱50,000 goal, ₱18,000 saved, 4 months → ₱8,000 a month
    const rec = recommendedMonthlyMinor(
      { target_minor: 5_000_000, saved_minor: 1_800_000, target_date: '2026-12-20' },
      TODAY
    );

    expect(rec).toBe(800_000);
  });

  it('rounds up so the last month is never a few pesos short', () => {
    const rec = recommendedMonthlyMinor(
      { target_minor: 1_000_000, saved_minor: 0, target_date: '2026-11-20' },
      TODAY
    )!;

    expect(rec * 3).toBeGreaterThanOrEqual(1_000_000);
    expect(rec).toBe(333_334);
  });

  it('returns null with no target date rather than inventing a deadline', () => {
    expect(
      recommendedMonthlyMinor(
        { target_minor: 5_000_000, saved_minor: 0, target_date: null },
        TODAY
      )
    ).toBeNull();
  });

  it('returns null once the goal is reached', () => {
    expect(
      recommendedMonthlyMinor(
        { target_minor: 1_000_000, saved_minor: 1_000_000, target_date: '2026-12-20' },
        TODAY
      )
    ).toBeNull();
  });

  it('returns null when the date has passed', () => {
    // The honest answer is "the rest, now" — which the UI states, rather than
    // dressing it up as a monthly plan.
    expect(
      recommendedMonthlyMinor(
        { target_minor: 1_000_000, saved_minor: 200_000, target_date: '2026-07-01' },
        TODAY
      )
    ).toBeNull();
  });
});

describe('goalStatus', () => {
  it.each([
    [{ target_minor: 100, saved_minor: 100, target_date: '2026-12-20' }, 'achieved'],
    [{ target_minor: 100, saved_minor: 10, target_date: '2026-12-20' }, 'on-track'],
    [{ target_minor: 100, saved_minor: 10, target_date: '2026-07-01' }, 'behind'],
    [{ target_minor: 100, saved_minor: 10, target_date: null }, 'no-deadline'],
  ])('classifies %o as %s', (goal, expected) => {
    expect(goalStatus(goal as never, TODAY)).toBe(expected);
  });

  it('counts a reached goal as achieved even past its date', () => {
    expect(
      goalStatus({ target_minor: 100, saved_minor: 100, target_date: '2026-01-01' }, TODAY)
    ).toBe('achieved');
  });
});

describe('goalEncouragement', () => {
  it('stays quiet below halfway — an empty slot beats a hollow cheer', () => {
    expect(
      goalEncouragement({ name: 'Emergency fund', target_minor: 1000, saved_minor: 100 })
    ).toBeNull();
  });

  it('speaks up at the milestones that mean something', () => {
    expect(
      goalEncouragement({ name: 'Emergency fund', target_minor: 1000, saved_minor: 600 })
    ).toBe('You\'re over halfway to your Emergency fund goal.');

    expect(
      goalEncouragement({ name: 'Emergency fund', target_minor: 1000, saved_minor: 800 })
    ).toBe("You're 80% of the way to your Emergency fund goal.");

    expect(
      goalEncouragement({ name: 'Emergency fund', target_minor: 1000, saved_minor: 1000 })
    ).toBe("You've reached your Emergency fund goal.");
  });

  it('never gamifies (D§64)', () => {
    const lines = [600, 800, 1000].map((saved) =>
      goalEncouragement({ name: 'Emergency fund', target_minor: 1000, saved_minor: saved })
    );

    for (const line of lines) {
      expect(line).not.toMatch(/🎉|🏆|congrat|amazing|awesome|streak|level|points|!/i);
    }
  });
});
