/**
 * Savings goals (P§25) — progress and the recommended monthly contribution.
 *
 * Pure functions over typed inputs. The recommendation is arithmetic, not
 * advice: "to reach ₱50,000 by December you'd need about ₱8,000 a month" is a
 * division. Savi does not tell anyone whether the goal is wise.
 *
 * D§39 owns the progress bar; D§64 owns the tone — quiet encouragement, never
 * gamification.
 */

import type { FinancialGoal } from '@/lib/database.types';
import { parseISODate, todayISO } from '@/lib/dates';

export type GoalProgress = {
  /** 0–1, clamped. Over-saving shows a full bar, not a 130% one. */
  ratio: number;
  /** Whole percent for display. */
  percent: number;
  /** target − saved, floored at zero. */
  remainingMinor: number;
  achieved: boolean;
};

export function goalProgress(
  goal: Pick<FinancialGoal, 'target_minor' | 'saved_minor'>
): GoalProgress {
  // The DB constrains target > 0, but a zero here would produce Infinity and
  // a NaN-width progress bar, so it is handled rather than assumed away.
  if (goal.target_minor <= 0) {
    return { ratio: 0, percent: 0, remainingMinor: 0, achieved: false };
  }

  const raw = goal.saved_minor / goal.target_minor;
  const ratio = Math.max(0, Math.min(1, raw));

  return {
    ratio,
    // Floor, not round: 99.7% should not display as "100%" next to a bar that
    // is visibly short, and it should not claim a goal is done when it isn't.
    percent: Math.floor(ratio * 100),
    remainingMinor: Math.max(0, goal.target_minor - goal.saved_minor),
    achieved: goal.saved_minor >= goal.target_minor,
  };
}

/**
 * Months from `from` to `target`, counted in calendar months.
 *
 * "₱50,000 by December" means December minus August — four months — which is
 * how a person reads a savings deadline, and it is the count that makes the
 * recommended contribution land on the target rather than around it.
 *
 * Two edges matter:
 *   - A date later this month is **1**, not 0. Three weeks left is still a
 *     month to save in, and returning 0 would divide by zero at exactly the
 *     moment the recommendation matters most.
 *   - A date already gone returns 0 or negative, so callers can tell "due now"
 *     from "due later" without a second comparison.
 */
export function monthsUntil(targetISO: string, from = todayISO()): number {
  const target = parseISODate(targetISO);
  const start = parseISODate(from);

  const months =
    (target.getFullYear() - start.getFullYear()) * 12 +
    (target.getMonth() - start.getMonth());

  // Past or today: report the (non-positive) calendar difference.
  if (target.getTime() <= start.getTime()) return Math.min(0, months);

  // Still ahead: never less than the one month they have left to save in.
  return Math.max(1, months);
}

/**
 * What to put aside each month to reach the goal on time.
 *
 * Returns null — and the UI says so plainly — when there is nothing to
 * recommend:
 *   - no target date: a goal with no deadline has no monthly figure
 *   - already achieved: nothing further is needed
 *   - the date has passed: the answer is "the rest, now", which the UI states
 *     rather than dressing up as a monthly plan
 */
export function recommendedMonthlyMinor(
  goal: Pick<FinancialGoal, 'target_minor' | 'saved_minor' | 'target_date'>,
  from = todayISO()
): number | null {
  if (!goal.target_date) return null;

  const { remainingMinor, achieved } = goalProgress(goal);
  if (achieved) return null;

  const months = monthsUntil(goal.target_date, from);
  if (months <= 0) return null;

  // Ceil: rounding down would leave the goal a few pesos short on the last
  // month, which is the one kind of arithmetic error a savings goal cannot
  // afford to make.
  return Math.ceil(remainingMinor / months);
}

export type GoalStatus = 'achieved' | 'on-track' | 'behind' | 'no-deadline';

/**
 * D§44: never colour alone — every status carries a label, and the label is
 * the accessible signal.
 */
export function goalStatus(
  goal: Pick<FinancialGoal, 'target_minor' | 'saved_minor' | 'target_date'>,
  from = todayISO()
): GoalStatus {
  const { achieved } = goalProgress(goal);
  if (achieved) return 'achieved';
  if (!goal.target_date) return 'no-deadline';

  const months = monthsUntil(goal.target_date, from);
  // Past the date with money still to go.
  if (months <= 0) return 'behind';

  return 'on-track';
}

export const GOAL_STATUS_META: Record<
  GoalStatus,
  { tone: 'income' | 'info' | 'bill'; label: string }
> = {
  achieved: { tone: 'income', label: 'Reached' },
  'on-track': { tone: 'info', label: 'On track' },
  // Deliberately NOT danger. Missing a savings deadline is not an emergency,
  // and colouring it red would be the alarm D§63 forbids.
  behind: { tone: 'bill', label: 'Past its date' },
  'no-deadline': { tone: 'info', label: 'No date set' },
};

/**
 * D§64 — celebrate progress quietly, and only when there is something real to
 * say. Returns null the rest of the time; an empty slot beats a hollow cheer.
 */
export function goalEncouragement(
  goal: Pick<FinancialGoal, 'name' | 'target_minor' | 'saved_minor'>
): string | null {
  const { percent, achieved } = goalProgress(goal);

  if (achieved) return `You've reached your ${goal.name} goal.`;
  if (percent >= 75) return `You're ${percent}% of the way to your ${goal.name} goal.`;
  if (percent >= 50) return `You're over halfway to your ${goal.name} goal.`;

  return null;
}
