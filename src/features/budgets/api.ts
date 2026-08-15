/**
 * Budgets — I/O only. The waterfall arithmetic lives in `waterfall.ts`.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useFinancialSummary } from '@/features/transactions/api';
import type { Budget, ClassificationSpendRow } from '@/lib/database.types';
import { currentPeriod } from '@/lib/dates';
import { requireUserId, supabase } from '@/lib/supabase';

import { computeWaterfall, type Waterfall } from './waterfall';

export const qkBudgets = {
  budget: (period: string) => ['budget', period] as const,
  actuals: (period: string) => ['budget-actuals', period] as const,
};

export function useBudget(period = currentPeriod()) {
  return useQuery({
    queryKey: qkBudgets.budget(period),
    queryFn: async (): Promise<Budget | null> => {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('period', period)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useUpsertBudget() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      period?: string;
      incomeMinor: number;
      needsMinor: number;
      wantsMinor: number;
      savingsMinor: number;
    }) => {
      const userId = await requireUserId();

      const period = input.period ?? currentPeriod();

      // Upsert on the (user_id, period) unique constraint — the same plan
      // edited twice must update, not fail or duplicate.
      const { error } = await supabase.from('budgets').upsert(
        {
          user_id: userId,
          period,
          income_minor: input.incomeMinor,
          needs_minor: input.needsMinor,
          wants_minor: input.wantsMinor,
          savings_minor: input.savingsMinor,
        },
        { onConflict: 'user_id,period' }
      );
      if (error) throw error;
      return period;
    },
    onSuccess: (period) => {
      qc.invalidateQueries({ queryKey: qkBudgets.budget(period) });
    },
  });
}

/**
 * What actually happened this month, summed in SQL.
 *
 * Savings comes from its own function rather than the classification split,
 * because saving is a TRANSFER and transfers are structurally excluded from
 * expense totals (P3). Reading it from the expense side would report ₱0 saved
 * no matter how much the user put away.
 */
function useBudgetActuals(period: string) {
  return useQuery({
    queryKey: qkBudgets.actuals(period),
    queryFn: async () => {
      const [split, saved] = await Promise.all([
        supabase.rpc('spending_by_classification', { p_month: period }),
        supabase.rpc('saved_to_savings_minor', { p_month: period }),
      ]);

      if (split.error) throw split.error;
      if (saved.error) throw saved.error;

      const rows = (split.data ?? []) as ClassificationSpendRow[];
      const by = (k: string) =>
        rows.find((r) => r.classification === k)?.total_minor ?? 0;

      return {
        billsMinor: by('bill'),
        needsMinor: by('need'),
        wantsMinor: by('want'),
        savingsMinor: (saved.data as number | null) ?? 0,
      };
    },
  });
}

/** Everything the budget screen needs, resolved to one waterfall. */
export function useWaterfall(period = currentPeriod()): {
  waterfall: Waterfall | null;
  budget: Budget | null;
  isLoading: boolean;
} {
  const { data: budget = null, isLoading: l1 } = useBudget(period);
  const { data: actual, isLoading: l2 } = useBudgetActuals(period);
  const { data: summary, isLoading: l3 } = useFinancialSummary();

  const isLoading = l1 || l2 || l3;
  if (isLoading || !actual) return { waterfall: null, budget, isLoading };

  return {
    budget,
    isLoading,
    waterfall: computeWaterfall({
      // With no plan yet, income falls back to what has actually come in, so
      // the screen shows a real waterfall rather than a row of zeroes.
      incomeMinor: budget?.income_minor ?? summary?.total_income_minor ?? 0,
      // Derived, never stored — the bills table owns this number.
      billsMinor: summary?.upcoming_bills_minor ?? 0,
      plan: {
        needsMinor: budget?.needs_minor ?? 0,
        wantsMinor: budget?.wants_minor ?? 0,
        savingsMinor: budget?.savings_minor ?? 0,
      },
      actual,
    }),
  };
}
