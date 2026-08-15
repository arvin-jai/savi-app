/**
 * Work schedules — I/O only. The recurrence rules live in `shifts.ts`.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { WorkSchedule, WorkShiftException } from '@/lib/database.types';
import { requireUserId, supabase } from '@/lib/supabase';

import { expandShifts, type Shift } from './shifts';

export const qkShifts = {
  schedules: ['work-schedules'] as const,
  exceptions: ['work-shift-exceptions'] as const,
};

export function useWorkSchedules() {
  return useQuery({
    queryKey: qkShifts.schedules,
    queryFn: async (): Promise<WorkSchedule[]> => {
      const { data, error } = await supabase
        .from('work_schedules')
        .select('*')
        .is('archived_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useShiftExceptions() {
  return useQuery({
    queryKey: qkShifts.exceptions,
    queryFn: async (): Promise<WorkShiftException[]> => {
      const { data, error } = await supabase.from('work_shift_exceptions').select('*');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Shifts for a date range, expanded from the rules.
 *
 * Nothing is fetched per-range: the rules and their exceptions are small and
 * cached, and the expansion is local. Scrolling the calendar therefore costs no
 * network — which is the practical payoff of storing a rule rather than
 * generating rows.
 */
export function useShifts(rangeStart: string, rangeEnd: string): {
  shifts: Shift[];
  isLoading: boolean;
} {
  const { data: schedules = [], isLoading: l1 } = useWorkSchedules();
  const { data: exceptions = [], isLoading: l2 } = useShiftExceptions();

  return {
    shifts: expandShifts(schedules, exceptions, rangeStart, rangeEnd),
    isLoading: l1 || l2,
  };
}

export function useCreateWorkSchedule() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      daysOfWeek: number[];
      startTime?: string | null;
      endTime?: string | null;
      effectiveFrom?: string;
    }) => {
      const userId = await requireUserId();

      const { error } = await supabase.from('work_schedules').insert({
        user_id: userId,
        name: input.name.trim(),
        days_of_week: input.daysOfWeek,
        start_time: input.startTime ?? null,
        end_time: input.endTime ?? null,
        ...(input.effectiveFrom ? { effective_from: input.effectiveFrom } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qkShifts.schedules }),
  });
}

/**
 * Stop a schedule from here on, rather than deleting it.
 *
 * Archiving keeps past shifts on past dates — the calendar is partly a record,
 * and a job you left should still show the weeks you worked it. Deleting the
 * row would rewrite that history.
 */
export function useArchiveWorkSchedule() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await supabase
        .from('work_schedules')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', scheduleId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qkShifts.schedules }),
  });
}

/** Skip or move a single shift, leaving the rule untouched. */
export function useSetShiftException() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      scheduleId: string;
      date: string;
      kind: 'skipped' | 'moved';
      startTime?: string;
      endTime?: string;
    }) => {
      const userId = await requireUserId();

      // Upsert on (schedule_id, shift_date): changing your mind about one date
      // replaces the exception rather than stacking a second one. Unlike
      // ai_tool_grants this table HAS an update policy, so upsert is available.
      const { error } = await supabase.from('work_shift_exceptions').upsert(
        {
          user_id: userId,
          schedule_id: input.scheduleId,
          shift_date: input.date,
          kind: input.kind,
          start_time: input.kind === 'moved' ? (input.startTime ?? null) : null,
          end_time: input.kind === 'moved' ? (input.endTime ?? null) : null,
        },
        { onConflict: 'schedule_id,shift_date' }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qkShifts.exceptions }),
  });
}

/** Undo an exception — the rule applies to that date again. */
export function useClearShiftException() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { scheduleId: string; date: string }) => {
      const { error } = await supabase
        .from('work_shift_exceptions')
        .delete()
        .eq('schedule_id', input.scheduleId)
        .eq('shift_date', input.date);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qkShifts.exceptions }),
  });
}
