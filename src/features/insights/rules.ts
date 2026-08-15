/**
 * Savi Insight — the rule engine (M5).
 *
 * Ask Savi is v0.4, but the InsightCard (D§31) is the signature component and
 * P§34 promises an insight during onboarding. These rules are deterministic
 * arithmetic over the user's own data — "your food spending is 24% higher than
 * last month" is a division, not an inference. It should not cost a network
 * round trip, and it should not leave the device.
 *
 * Design constraints, from the docs they came from:
 *   - ONE insight at a time. D§30: no walls of text; the card is singular.
 *   - D§63 calm voice. "Trending higher than usual", never "WARNING!".
 *   - D§64 quiet encouragement, not gamification.
 *   - Answer / Reason / Action shape (D§30), so v0.4 can swap the source from
 *     rules to a model without touching the card.
 *
 * Pure functions over typed inputs — no I/O — so every rule is unit-testable.
 */

import type { BillWithStatus } from '@/features/bills/api';
import { daysUntil } from '@/features/bills/schedule';
import type { FinancialSummary } from '@/lib/database.types';
import { formatMoney } from '@/lib/money';

/** The only screens an insight may send someone to. */
export const INSIGHT_HREFS = ['/money', '/bills', '/budget', '/goals', '/calendar'] as const;
export type InsightHref = (typeof INSIGHT_HREFS)[number];

export function isInsightHref(value: unknown): value is InsightHref {
  return typeof value === 'string' && (INSIGHT_HREFS as readonly string[]).includes(value);
}

export type Insight = {
  /** Stable id so the UI can key on it and future code can let users dismiss. */
  id: string;
  /** Short direct statement (D§30 "Answer"). */
  headline: string;
  /** Why Savi concluded that (D§30 "Reason"). Optional for simple facts. */
  detail?: string;
  /**
   * Where tapping the card goes (D§30 "Action").
   *
   * A closed set, not an arbitrary string. From v0.5 an insight can be written
   * by a model that has read user-authored text, so the destination is chosen
   * from this list and never supplied as a URL — AI-BOUNDARY §6.3.
   */
  action?: { label: string; href: InsightHref };
  tone: 'calm' | 'positive' | 'attention';
};

export type CategorySpend = {
  slug: string;
  name: string;
  /** Month-to-date, minor units. */
  currentMinor: number;
  /** Same day-range last month, minor units. See api.ts for why not the full month. */
  previousMinor: number;
};

export type InsightInputs = {
  summary: FinancialSummary | null;
  bills: BillWithStatus[];
  categorySpend: CategorySpend[];
  /** Monthly recurring income, if the user told us during onboarding. */
  recurringIncomeMinor: number | null;
  /** How many transactions exist at all — gates the welcome insight. */
  transactionCount: number;
  today?: string;
};

/**
 * Spending-change thresholds.
 *
 * Both gates exist to keep the card honest: a 20% floor because smaller swings
 * are noise, and a ₱500 base because "300% higher" on a ₱60 base is technically
 * true and practically meaningless — the exact kind of alarm D§63 forbids.
 */
const SPEND_CHANGE_MIN_RATIO = 0.2;
const SPEND_CHANGE_MIN_BASE_MINOR = 50_000;

/**
 * Rules in priority order. The first that fires wins — one card, one thought.
 */
export function computeInsight(inputs: InsightInputs): Insight | null {
  return (
    cashFlowWarning(inputs) ??
    billDueSoon(inputs) ??
    spendingChange(inputs) ??
    welcomeInsight(inputs) ??
    quietEncouragement(inputs)
  );
}

/** Available Money below zero is the single most useful thing Savi can say. */
function cashFlowWarning({ summary }: InsightInputs): Insight | null {
  if (!summary || summary.available_money_minor >= 0) return null;

  const short = Math.abs(summary.available_money_minor);
  return {
    id: 'cash-flow',
    headline: `Your upcoming bills are ${formatMoney(short)} more than your current balance.`,
    detail: 'Paying everything on time would need a top-up or moving a bill.',
    action: { label: 'Review bills', href: '/bills' },
    tone: 'attention',
  };
}

function billDueSoon({ bills, today }: InsightInputs): Insight | null {
  const overdue = bills.filter((b) => b.status === 'overdue');
  if (overdue.length > 0) {
    const first = overdue[0];
    return {
      id: `overdue-${first.id}`,
      headline:
        overdue.length === 1
          ? `${first.name} is past its due date.`
          : `${overdue.length} bills are past their due dates.`,
      detail: `Marking them paid keeps your available money accurate.`,
      action: { label: 'View bills', href: '/bills' },
      tone: 'attention',
    };
  }

  const dueSoon = bills
    .filter((b) => b.status === 'due-soon' && b.dueDate)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  if (dueSoon.length === 0) return null;

  const next = dueSoon[0];
  const days = daysUntil(next.dueDate!, today);
  const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;

  return {
    id: `due-${next.id}`,
    headline: `${next.name} (${formatMoney(next.amount_minor)}) is due ${when}.`,
    action: { label: 'View bills', href: '/bills' },
    tone: 'calm',
  };
}

/**
 * Month-over-month change in the biggest-moving category.
 *
 * The comparison is month-to-date vs the SAME day-range of last month —
 * comparing the 14 days we have against last month's full 31 would tell every
 * user their spending "dropped" mid-month and then crept up, which is the
 * arithmetic lying. api.ts owns that windowing; this rule trusts its inputs.
 */
function spendingChange({ categorySpend }: InsightInputs): Insight | null {
  let best: { cat: CategorySpend; ratio: number } | null = null;

  for (const cat of categorySpend) {
    if (cat.previousMinor < SPEND_CHANGE_MIN_BASE_MINOR) continue;
    const ratio = (cat.currentMinor - cat.previousMinor) / cat.previousMinor;
    if (Math.abs(ratio) < SPEND_CHANGE_MIN_RATIO) continue;
    if (!best || Math.abs(ratio) > Math.abs(best.ratio)) best = { cat, ratio };
  }

  if (!best) return null;

  const pct = Math.round(Math.abs(best.ratio) * 100);
  const rising = best.ratio > 0;

  return {
    id: `spend-${best.cat.slug}-${rising ? 'up' : 'down'}`,
    headline: rising
      ? // D§63: an observation, not a judgement.
        `Your ${best.cat.name.toLowerCase()} spending is ${pct}% higher than this time last month.`
      : `Your ${best.cat.name.toLowerCase()} spending is ${pct}% lower than this time last month.`,
    detail: rising
      ? `${formatMoney(best.cat.currentMinor)} so far, versus ${formatMoney(best.cat.previousMinor)} by this point in the last month.`
      : `${formatMoney(best.cat.previousMinor - best.cat.currentMinor)} kept compared to this point last month.`,
    action: { label: 'View spending', href: '/money' },
    tone: rising ? 'calm' : 'positive',
  };
}

/**
 * The first thing a new user sees (P§34). Fires only while the ledger is
 * nearly empty, then retires forever in favour of real observations.
 */
function welcomeInsight({
  recurringIncomeMinor,
  bills,
  transactionCount,
}: InsightInputs): Insight | null {
  if (transactionCount > 5) return null;
  if (!recurringIncomeMinor || recurringIncomeMinor <= 0) return null;

  const billTotal = bills.reduce((sum, b) => sum + b.amount_minor, 0);
  const afterBills = recurringIncomeMinor - billTotal;
  if (afterBills <= 0) {
    return {
      id: 'welcome-tight',
      headline: `Your regular bills are close to your monthly income.`,
      detail: `${formatMoney(billTotal)} in bills against ${formatMoney(recurringIncomeMinor)} coming in. Savi will keep an eye on the timing.`,
      action: { label: 'Review bills', href: '/bills' },
      tone: 'calm',
    };
  }

  return {
    id: 'welcome',
    headline: `After your regular bills, about ${formatMoney(afterBills)} of your income is yours to plan each month.`,
    detail: `${formatMoney(recurringIncomeMinor)} coming in, ${formatMoney(billTotal)} in bills. Savi will watch your spending and bills from here.`,
    tone: 'positive',
  };
}

/** D§64 — quiet encouragement, only when there is genuinely something to say. */
function quietEncouragement({ summary }: InsightInputs): Insight | null {
  if (!summary) return null;

  const kept = summary.remaining_minor;
  // Nothing forced: no income yet, or spending exceeds income → say nothing.
  // An empty insight slot is better than a hollow cheer.
  if (summary.total_income_minor <= 0 || kept <= 0) return null;

  const pct = Math.round((kept / summary.total_income_minor) * 100);
  if (pct < 10) return null;

  return {
    id: 'kept',
    headline: `You've kept ${formatMoney(kept)} of your income this month.`,
    detail: `That's ${pct}% of what came in.`,
    tone: 'positive',
  };
}
