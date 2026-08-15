/**
 * The budget waterfall (P§24) — Income → Bills → Needs → Wants → Savings.
 *
 * Pure functions, no I/O, because every number here is one a user will make a
 * decision on and every one of them has an edge case:
 *
 *   - Bills are DERIVED and come first. They are not an allocation the user
 *     chooses (see the migration for why).
 *   - Saving is not spending. Actual savings comes from transfers into savings
 *     accounts, never from the expense totals — P3, again.
 *   - Over-allocating is allowed and reported, not blocked. A user planning
 *     ₱35,000 of a ₱30,000 income has made a mistake worth SHOWING them; a form
 *     that refuses the input just hides the mistake behind a validation error.
 *
 * D§63 governs the language: "slightly above your planned spending", never
 * "you're failing your budget".
 */

/** P§26's own example: "You've used 80% of your wants budget." */
export const NEAR_LIMIT_RATIO = 0.8;

export type WaterfallKey = 'bills' | 'needs' | 'wants' | 'savings';

export type StepStatus =
  /** Comfortably inside the plan. */
  | 'under'
  /** At or past NEAR_LIMIT_RATIO but still inside. */
  | 'near'
  /** Past the planned amount. */
  | 'over'
  /** Nothing planned for this line. */
  | 'unplanned';

export type WaterfallStep = {
  key: WaterfallKey;
  label: string;
  plannedMinor: number;
  actualMinor: number;
  /** planned − actual. Negative means over. */
  remainingMinor: number;
  /** actual / planned, or null when nothing is planned. */
  ratio: number | null;
  status: StepStatus;
  /** Bills are derived from the bills table, not chosen by the user. */
  derived: boolean;
};

export type Waterfall = {
  incomeMinor: number;
  steps: WaterfallStep[];
  /** Planned income minus everything allocated, bills included. */
  unallocatedMinor: number;
  /** Allocations exceed planned income. */
  overAllocated: boolean;
  /** Income minus everything ACTUALLY spent and saved so far. */
  actualLeftMinor: number;
};

export type WaterfallInput = {
  /** Planned monthly income. */
  incomeMinor: number;
  /** Derived: Σ unpaid bills for the period. Never a stored plan figure. */
  billsMinor: number;
  plan: { needsMinor: number; wantsMinor: number; savingsMinor: number };
  actual: {
    /** Expenses classified `bill` — what has actually been paid so far. */
    billsMinor: number;
    needsMinor: number;
    wantsMinor: number;
    /** Net transfers into savings accounts. NOT an expense total (P3). */
    savingsMinor: number;
  };
};

function statusFor(plannedMinor: number, actualMinor: number): StepStatus {
  if (plannedMinor <= 0) return 'unplanned';
  const ratio = actualMinor / plannedMinor;
  if (ratio > 1) return 'over';
  if (ratio >= NEAR_LIMIT_RATIO) return 'near';
  return 'under';
}

function step(
  key: WaterfallKey,
  label: string,
  plannedMinor: number,
  actualMinor: number,
  derived = false
): WaterfallStep {
  return {
    key,
    label,
    plannedMinor,
    actualMinor,
    remainingMinor: plannedMinor - actualMinor,
    ratio: plannedMinor > 0 ? actualMinor / plannedMinor : null,
    status: statusFor(plannedMinor, actualMinor),
    derived,
  };
}

export function computeWaterfall(input: WaterfallInput): Waterfall {
  const { incomeMinor, billsMinor, plan, actual } = input;

  const steps: WaterfallStep[] = [
    // Bills first, and marked derived so the UI can render it as a fact rather
    // than an editable field.
    step('bills', 'Bills', billsMinor, actual.billsMinor, true),
    step('needs', 'Needs', plan.needsMinor, actual.needsMinor),
    step('wants', 'Wants', plan.wantsMinor, actual.wantsMinor),
    step('savings', 'Savings', plan.savingsMinor, actual.savingsMinor),
  ];

  const totalPlanned =
    billsMinor + plan.needsMinor + plan.wantsMinor + plan.savingsMinor;

  const totalActual =
    actual.billsMinor + actual.needsMinor + actual.wantsMinor + actual.savingsMinor;

  return {
    incomeMinor,
    steps,
    unallocatedMinor: incomeMinor - totalPlanned,
    overAllocated: totalPlanned > incomeMinor,
    actualLeftMinor: incomeMinor - totalActual,
  };
}

/**
 * A suggested split for a user who has not made a plan yet.
 *
 * Bills are subtracted first because they are not optional, then what is left
 * is split 50 / 30 / 20 across needs / wants / savings — a widely used starting
 * point, offered as a starting point and not as advice. Savi describes the
 * user's own money; it does not tell them how to live.
 *
 * Returns null when bills already consume the income: suggesting the user
 * allocate a negative amount is worse than saying nothing, and that situation
 * needs a sentence, not a pie chart.
 */
export function suggestPlan(
  incomeMinor: number,
  billsMinor: number
): { needsMinor: number; wantsMinor: number; savingsMinor: number } | null {
  const left = incomeMinor - billsMinor;
  if (left <= 0) return null;

  // Integer minor units throughout — floor the first two and give the
  // remainder to savings so the three always sum to exactly `left` rather than
  // losing a centavo to rounding.
  const needsMinor = Math.floor(left * 0.5);
  const wantsMinor = Math.floor(left * 0.3);
  const savingsMinor = left - needsMinor - wantsMinor;

  return { needsMinor, wantsMinor, savingsMinor };
}

/**
 * The one-line summary shown above the waterfall, in D§63's voice.
 *
 * Ordered by what the user most needs to hear, first match wins — the same
 * shape as the insight rules, and for the same reason: one thought at a time.
 */
export function waterfallHeadline(w: Waterfall): string {
  if (w.overAllocated) {
    return 'Your plan adds up to more than you expect to come in.';
  }

  const over = w.steps.filter((s) => s.status === 'over' && !s.derived);
  if (over.length > 0) {
    return over.length === 1
      ? `You're a little above your planned ${over[0].label.toLowerCase()} this month.`
      : "You're a little above plan in more than one place this month.";
  }

  const near = w.steps.filter((s) => s.status === 'near' && !s.derived);
  if (near.length > 0) {
    return `You've used most of your ${near[0].label.toLowerCase()} budget.`;
  }

  // Only the steps the user actually allocates count as "a plan". Including
  // the derived bills step here told anyone with a bill and no plan that they
  // were "tracking within your plan" — tracking within a plan they never set.
  if (w.steps.every((s) => s.derived || s.plannedMinor === 0)) {
    return 'Set a plan and Savi will track it against what you actually spend.';
  }

  // D§64: quiet encouragement, not a fanfare.
  return "You're tracking within your plan.";
}
