/**
 * Savings goals — I/O only. Progress arithmetic lives in `goals.ts`.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { FinancialGoal } from '@/lib/database.types';
import { requireUserId, supabase } from '@/lib/supabase';

export const qkGoals = { all: ['financial-goals'] as const };

export function useGoals() {
  return useQuery({
    queryKey: qkGoals.all,
    queryFn: async (): Promise<FinancialGoal[]> => {
      const { data, error } = await supabase
        .from('financial_goals')
        .select('*')
        .is('archived_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      targetMinor: number;
      savedMinor?: number;
      targetDate?: string | null;
    }) => {
      const userId = await requireUserId();

      const { error } = await supabase.from('financial_goals').insert({
        user_id: userId,
        name: input.name.trim(),
        target_minor: input.targetMinor,
        saved_minor: input.savedMinor ?? 0,
        target_date: input.targetDate ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qkGoals.all }),
  });
}

/**
 * Record money put aside.
 *
 * This does NOT move money between accounts. A goal is a statement about money
 * the user has already set aside; making it also perform a transfer would mean
 * one action writing to the ledger under a name that does not say so. If they
 * want the transfer too, that is Quick Add, deliberately and visibly.
 */
export function useAddToGoal() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { goal: FinancialGoal; amountMinor: number }) => {
      const next = Math.max(0, input.goal.saved_minor + input.amountMinor);
      const reached = next >= input.goal.target_minor;

      const { error } = await supabase
        .from('financial_goals')
        .update({
          saved_minor: next,
          // Stamped once and left alone: if a user dips below the target later,
          // the goal was still reached on the day it was reached.
          achieved_at:
            reached && !input.goal.achieved_at
              ? new Date().toISOString()
              : input.goal.achieved_at,
        })
        .eq('id', input.goal.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qkGoals.all }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase.from('financial_goals').delete().eq('id', goalId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qkGoals.all }),
  });
}
