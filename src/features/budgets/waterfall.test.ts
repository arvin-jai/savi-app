import {
  computeWaterfall,
  NEAR_LIMIT_RATIO,
  suggestPlan,
  waterfallHeadline,
  type WaterfallInput,
} from './waterfall';

const base: WaterfallInput = {
  incomeMinor: 3_000_000, // ₱30,000
  billsMinor: 520_000, // ₱5,200 derived from the bills table
  plan: { needsMinor: 1_000_000, wantsMinor: 700_000, savingsMinor: 500_000 },
  actual: { billsMinor: 0, needsMinor: 0, wantsMinor: 0, savingsMinor: 0 },
};

describe('computeWaterfall', () => {
  it('puts bills first and marks them derived', () => {
    // Bills are a fact from the bills table, not an allocation the user picks.
    const w = computeWaterfall(base);

    expect(w.steps.map((s) => s.key)).toEqual(['bills', 'needs', 'wants', 'savings']);
    expect(w.steps[0].derived).toBe(true);
    expect(w.steps.slice(1).every((s) => s.derived)).toBe(false);
  });

  it('reports what is left unallocated', () => {
    // 30,000 − 5,200 − 10,000 − 7,000 − 5,000 = 2,800
    const w = computeWaterfall(base);

    expect(w.unallocatedMinor).toBe(280_000);
    expect(w.overAllocated).toBe(false);
  });

  it('reports over-allocation rather than refusing it', () => {
    // A user planning more than they earn has made a mistake worth SHOWING.
    const w = computeWaterfall({
      ...base,
      plan: { needsMinor: 1_500_000, wantsMinor: 1_200_000, savingsMinor: 500_000 },
    });

    expect(w.overAllocated).toBe(true);
    expect(w.unallocatedMinor).toBe(-720_000);
  });

  it('flags a line at 80% as near, per P§26', () => {
    const w = computeWaterfall({
      ...base,
      actual: { ...base.actual, wantsMinor: 560_000 }, // exactly 80% of 700,000
    });

    const wants = w.steps.find((s) => s.key === 'wants')!;
    expect(wants.ratio).toBe(NEAR_LIMIT_RATIO);
    expect(wants.status).toBe('near');
  });

  it('flags over only past the planned amount, not at it', () => {
    const exactly = computeWaterfall({
      ...base,
      actual: { ...base.actual, wantsMinor: 700_000 },
    });
    expect(exactly.steps.find((s) => s.key === 'wants')!.status).toBe('near');

    const past = computeWaterfall({
      ...base,
      actual: { ...base.actual, wantsMinor: 700_001 },
    });
    expect(past.steps.find((s) => s.key === 'wants')!.status).toBe('over');
  });

  it('calls a line with no plan unplanned rather than instantly over', () => {
    // Spending ₱500 against a ₱0 plan is not "over budget" — there is no
    // budget. Dividing by zero here would produce Infinity and a red screen.
    const w = computeWaterfall({
      ...base,
      plan: { needsMinor: 0, wantsMinor: 0, savingsMinor: 0 },
      actual: { ...base.actual, needsMinor: 50_000 },
    });

    const needs = w.steps.find((s) => s.key === 'needs')!;
    expect(needs.status).toBe('unplanned');
    expect(needs.ratio).toBeNull();
    expect(Number.isFinite(needs.remainingMinor)).toBe(true);
  });

  it('counts savings from transfers, never from expense totals', () => {
    // P3: moving ₱5,000 into savings is saving, not spending. If this ever
    // read from an expense total the app would tell a saving user they had
    // overspent — the exact opposite of what Savi exists to do.
    const w = computeWaterfall({
      ...base,
      actual: { ...base.actual, savingsMinor: 500_000 },
    });

    expect(w.steps.find((s) => s.key === 'savings')!.actualMinor).toBe(500_000);
    expect(w.steps.find((s) => s.key === 'wants')!.actualMinor).toBe(0);
    expect(w.steps.find((s) => s.key === 'needs')!.actualMinor).toBe(0);
  });

  it('tracks what is actually left, separately from what is planned', () => {
    const w = computeWaterfall({
      ...base,
      actual: {
        billsMinor: 169_900,
        needsMinor: 300_000,
        wantsMinor: 120_000,
        savingsMinor: 500_000,
      },
    });

    // 30,000 − (1,699 + 3,000 + 1,200 + 5,000) = 19,101
    expect(w.actualLeftMinor).toBe(1_910_100);
    // The plan figure is untouched by what actually happened.
    expect(w.unallocatedMinor).toBe(280_000);
  });
});

describe('suggestPlan', () => {
  it('takes bills off the top before splitting', () => {
    const plan = suggestPlan(3_000_000, 520_000)!;
    const left = 3_000_000 - 520_000;

    expect(plan.needsMinor + plan.wantsMinor + plan.savingsMinor).toBe(left);
  });

  it('never loses a centavo to rounding', () => {
    // An income that does not divide cleanly: the remainder goes to savings
    // rather than evaporating.
    const plan = suggestPlan(1_000_001, 1)!;
    expect(plan.needsMinor + plan.wantsMinor + plan.savingsMinor).toBe(1_000_000);
  });

  it('returns null when bills already consume the income', () => {
    // Suggesting a negative allocation is worse than saying nothing; that
    // situation needs a sentence, not a pie chart.
    expect(suggestPlan(500_000, 500_000)).toBeNull();
    expect(suggestPlan(500_000, 900_000)).toBeNull();
  });
});

describe('waterfallHeadline', () => {
  const headline = (input: Partial<WaterfallInput>) =>
    waterfallHeadline(computeWaterfall({ ...base, ...input } as WaterfallInput));

  it('leads with over-allocation, the most actionable problem', () => {
    expect(
      headline({ plan: { needsMinor: 2_500_000, wantsMinor: 1_200_000, savingsMinor: 0 } })
    ).toBe('Your plan adds up to more than you expect to come in.');
  });

  it('names a single over-plan line', () => {
    expect(headline({ actual: { ...base.actual, wantsMinor: 900_000 } })).toBe(
      "You're a little above your planned wants this month."
    );
  });

  it('does not enumerate when several lines are over', () => {
    // D§30: no walls of text. One thought.
    expect(
      headline({ actual: { ...base.actual, wantsMinor: 900_000, needsMinor: 1_500_000 } })
    ).toBe("You're a little above plan in more than one place this month.");
  });

  it('never blames the user (D§63)', () => {
    const all = [
      headline({}),
      headline({ actual: { ...base.actual, wantsMinor: 900_000 } }),
      headline({ actual: { ...base.actual, wantsMinor: 600_000 } }),
      headline({ plan: { needsMinor: 2_500_000, wantsMinor: 1_200_000, savingsMinor: 0 } }),
      headline({ plan: { needsMinor: 0, wantsMinor: 0, savingsMinor: 0 } }),
    ];

    for (const line of all) {
      expect(line).not.toMatch(/fail|warning|too much|overspent|bad|!/i);
      expect(line).not.toBe(line.toUpperCase());
    }
  });

  it('invites a plan when there is none, rather than reporting nothing', () => {
    expect(
      headline({
        billsMinor: 0,
        plan: { needsMinor: 0, wantsMinor: 0, savingsMinor: 0 },
      })
    ).toBe('Set a plan and Savi will track it against what you actually spend.');
  });

  it('still invites a plan when bills exist but nothing is allocated', () => {
    // Found by running it: the derived bills step made `every planned === 0`
    // false, so a user with one bill and no plan was told they were "tracking
    // within your plan" — within a plan they had never set.
    expect(
      headline({
        billsMinor: 169_900,
        plan: { needsMinor: 0, wantsMinor: 0, savingsMinor: 0 },
      })
    ).toBe('Set a plan and Savi will track it against what you actually spend.');
  });

  it('offers quiet encouragement when everything is on track', () => {
    expect(headline({})).toBe("You're tracking within your plan.");
  });
});
