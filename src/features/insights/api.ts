/**
 * Data feeding the insight rules and the dashboard header.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAiPreferences } from '@/features/ai/api';
import { useBills } from '@/features/bills/api';
import { useFinancialSummary } from '@/features/transactions/api';
import type { Profile } from '@/lib/database.types';
import { parseISODate, todayISO } from '@/lib/dates';
import { qk } from '@/lib/queryClient';
import { currentUserId, requireUserId, supabase } from '@/lib/supabase';

import { computeInsight, isInsightHref, type CategorySpend, type Insight } from './rules';

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async (): Promise<Profile | null> => {
      const userId = await currentUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * The comparison windows for the spending rule.
 *
 * Month-to-date vs the SAME day-range of last month. Comparing 14 days of this
 * month against all 31 of last month would tell every user their spending
 * "dropped" mid-month — the arithmetic would be lying. The end day is clamped
 * for short months: on March 30th the previous window is Feb 1 → Feb 28.
 */
export function comparisonWindows(today = todayISO()) {
  const d = parseISODate(today);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevMonthDays = new Date(prevYear, prevMonth + 1, 0).getDate();
  const clampedDay = Math.min(day, prevMonthDays);

  const iso = (y: number, m: number, dd: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;

  return {
    currentStart: iso(year, month, 1),
    currentEnd: iso(year, month, day),
    previousStart: iso(prevYear, prevMonth, 1),
    previousEnd: iso(prevYear, prevMonth, clampedDay),
  };
}

function useCategorySpend() {
  return useQuery({
    queryKey: ['insights', 'category-spend'],
    queryFn: async (): Promise<{ spend: CategorySpend[]; transactionCount: number }> => {
      const win = comparisonWindows();

      // Both windows in one query; split client-side. Expenses only — income
      // and transfers are not "spending" (P3 holds here too, via type).
      const { data, error, count } = await supabase
        .from('transactions')
        .select('amount_minor, transaction_date, category:categories(slug,name)', {
          count: 'exact',
        })
        .eq('type', 'expense')
        .gte('transaction_date', win.previousStart)
        .lte('transaction_date', win.currentEnd);

      if (error) throw error;

      const byCategory = new Map<string, CategorySpend>();
      for (const row of data ?? []) {
        const cat = row.category as unknown as { slug: string | null; name: string } | null;
        const slug = cat?.slug ?? 'other';
        const name = cat?.name ?? 'Other';

        let entry = byCategory.get(slug);
        if (!entry) {
          entry = { slug, name, currentMinor: 0, previousMinor: 0 };
          byCategory.set(slug, entry);
        }

        if (row.transaction_date >= win.currentStart) {
          entry.currentMinor += row.amount_minor;
        } else if (row.transaction_date <= win.previousEnd) {
          entry.previousMinor += row.amount_minor;
        }
        // Rows after previousEnd but before currentStart fall outside both
        // windows on purpose — they are last month's days we have not reached
        // this month yet.
      }

      return { spend: [...byCategory.values()], transactionCount: count ?? 0 };
    },
  });
}

function useRecurringIncome() {
  return useQuery({
    queryKey: ['insights', 'recurring-income'],
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase
        .from('recurring_transactions')
        // Same `!inner` join as the calendar's copy of this query: an archived
        // account no longer generates, so counting its salary as regular income
        // overstates what the user actually has coming in.
        .select('amount_minor, accounts!inner(archived_at)')
        .eq('type', 'income')
        .is('archived_at', null)
        .is('accounts.archived_at', null);
      if (error) throw error;
      if (!data || data.length === 0) return null;
      return data.reduce((sum, r) => sum + r.amount_minor, 0);
    },
  });
}

/**
 * Written during onboarding (P§34).
 *
 * This row used to be inert — v0.1 stored the schedule and nothing ever turned
 * it into money. It now generates: see `useGenerateRecurring()` below and
 * `generate_due_recurring()` in the migration.
 */
export function useCreateRecurringIncome() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { amountMinor: number; dayOfMonth: number; accountId: string }) => {
      const userId = await requireUserId();

      const today = parseISODate(todayISO());
      // Next occurrence of the payday: this month if still ahead, else next.
      const nextMonth = today.getDate() > input.dayOfMonth;
      const y = today.getFullYear();
      const m = today.getMonth() + (nextMonth ? 1 : 0);
      const nextRun = `${m > 11 ? y + 1 : y}-${String((m % 12) + 1).padStart(2, '0')}-${String(
        input.dayOfMonth
      ).padStart(2, '0')}`;

      const { error } = await supabase.from('recurring_transactions').insert({
        user_id: userId,
        account_id: input.accountId,
        amount_minor: input.amountMinor,
        direction: 'in',
        type: 'income',
        description: 'Salary',
        recurrence: 'monthly',
        day_of_month: input.dayOfMonth,
        next_run: nextRun,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insights', 'recurring-income'] });
      // The calendar reads the same underlying rows under its own key (the
      // shapes differ — see qkCalendar.recurringIncomeSchedule). Both have to
      // be invalidated or a new payday will not appear on the timeline.
      qc.invalidateQueries({ queryKey: ['recurring-income-schedule'] });
    },
  });
}

/**
 * Materialise any recurring income that has come due.
 *
 * Until now a `recurring_transactions` row was inert — onboarding recorded the
 * user's salary and payday and nothing ever turned it into money, so someone
 * with a ₱30,000 salary saw ₱0 income every month. Reported from use: income
 * should arrive monthly, the way a money tracker works.
 *
 * Safe to call on every mount. `generate_due_recurring()` is idempotent at the
 * database level — a unique index on (schedule, date) makes a duplicate salary
 * impossible rather than unlikely, which matters because this runs whenever the
 * dashboard opens and two devices can open it at once.
 *
 * Generated rows are ordinary transactions: visible in the ledger, editable and
 * deletable. If a payday did not actually land, the user removes it like
 * anything else — Savi guesses and the user corrects (P§61).
 */
export function useGenerateRecurring() {
  const qc = useQueryClient();

  return useQuery({
    queryKey: ['recurring', 'generate', todayISO()],
    // Once per day per client. The DB is the real guard; this just avoids
    // pointless round trips on every navigation.
    staleTime: Infinity,
    retry: 0,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('generate_due_recurring', {
        p_today: todayISO(),
      });
      if (error) throw error;

      const created = (data as number | null) ?? 0;
      if (created > 0) {
        // Money moved. Everything derived from the ledger has to re-read, or
        // the user sees a balance that does not match the transactions below it.
        qc.invalidateQueries({ queryKey: ['transactions'] });
        qc.invalidateQueries({ queryKey: ['summary'] });
        qc.invalidateQueries({ queryKey: qk.accounts });
      }
      return created;
    },
  });
}

/**
 * The model-generated insight (v0.5).
 *
 * Returns null in every failure mode rather than throwing — no key, AI off,
 * network down, model declined. The caller falls back to the deterministic
 * rules, which is a real feature and not a degraded one.
 */
function useAiInsight(enabled: boolean) {
  return useQuery({
    queryKey: ['insights', 'ai'],
    enabled,
    // The dashboard's figures change constantly; the insight need not. Refetching
    // on every mount would spend money and, worse, make the card flicker between
    // different observations while the user is reading it.
    staleTime: 1000 * 60 * 30,
    retry: 0,
    queryFn: async (): Promise<Insight | null> => {
      const { data, error } = await supabase.functions.invoke<{ insight: Insight | null }>(
        'generate-insights',
        { body: { today: todayISO() } }
      );

      if (error || !data?.insight) return null;

      const insight = data.insight;
      // Belt and braces on the href: the function already checks it against the
      // allowlist, and so does this. The model reads user-authored text, and a
      // destination is the one field where that could matter (AI-BOUNDARY §6.3).
      if (insight.action && !isInsightHref(insight.action.href)) {
        return { ...insight, action: undefined };
      }
      return insight;
    },
  });
}

/**
 * Everything the InsightCard needs, resolved to a single insight or null.
 *
 * The model writes the card when it can; M5's rules write it otherwise. Same
 * component, same shape — which is exactly why M5 built the rules first
 * (BUILD-PLAN v0.1: "gives v0.4 a UI to plug a model into rather than one to
 * invent"). The rules are also the floor when the user has AI switched off, so
 * they are not dead code and must not be deleted.
 */
export function useInsight(): { insight: Insight | null; isLoading: boolean } {
  const { data: summary, isLoading: l1 } = useFinancialSummary();
  const { data: bills = [], isLoading: l2 } = useBills();
  const { data: spendData, isLoading: l3 } = useCategorySpend();
  const { data: recurringIncome = null, isLoading: l4 } = useRecurringIncome();

  const { data: aiPrefs } = useAiPreferences();
  const aiEnabled = aiPrefs?.enabled === true;
  const { data: aiInsight, isLoading: l5 } = useAiInsight(aiEnabled);

  const isLoading = l1 || l2 || l3 || l4 || (aiEnabled && l5);

  if (isLoading) return { insight: null, isLoading };

  if (aiInsight) return { insight: aiInsight, isLoading };

  return {
    insight: computeInsight({
      summary: summary ?? null,
      bills,
      categorySpend: spendData?.spend ?? [],
      recurringIncomeMinor: recurringIncome,
      transactionCount: spendData?.transactionCount ?? 0,
    }),
    isLoading,
  };
}
