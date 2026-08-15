/**
 * Calendar and tasks data access.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useBills } from '@/features/bills/api';
import type { CalendarEvent, EventKind, Task, TaskPriority } from '@/lib/database.types';
import { todayISO } from '@/lib/dates';
import { requireUserId, supabase } from '@/lib/supabase';

import { useShifts } from './shiftsApi';
import { buildTimeline, type TimelineEntry } from './timeline';

export const qkCalendar = {
  events: (range?: string) => ['calendar-events', range ?? 'all'] as const,
  tasks: ['tasks'] as const,
  /**
   * Deliberately NOT `['insights','recurring-income']`.
   *
   * That key is owned by useInsight, whose query returns a summed `number`.
   * This one returns an array of schedules. Sharing the key looked like free
   * cache reuse and instead crashed the dashboard with "recurringIncome is not
   * iterable" — the two hooks only mount together there, so the calendar
   * screen alone never showed it. Same key, two shapes, last writer wins.
   */
  recurringIncomeSchedule: ['recurring-income-schedule'] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────────────

export function useEvents(rangeStart: string, rangeEnd: string) {
  return useQuery({
    queryKey: qkCalendar.events(`${rangeStart}:${rangeEnd}`),
    queryFn: async (): Promise<CalendarEvent[]> => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('event_date', rangeStart)
        .lte('event_date', rangeEnd)
        .order('event_date');
      if (error) throw error;
      return data ?? [];
    },
  });
}

function invalidateCalendar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['calendar-events'] });
  qc.invalidateQueries({ queryKey: ['tasks'] });
}

export function useCreateEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      date: string;
      kind: EventKind;
      startTime?: string | null;
      notes?: string | null;
    }) => {
      const userId = await requireUserId();

      const allDay = !input.startTime;
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          user_id: userId,
          title: input.title.trim(),
          event_date: input.date,
          kind: input.kind,
          all_day: allDay,
          // The DB rejects a timed event with no start time; mirror that here
          // so a bad call fails with a message instead of a constraint error.
          start_time: allDay ? null : input.startTime,
          notes: input.notes?.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: () => invalidateCalendar(qc),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendar_events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateCalendar(qc),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tasks (P§17)
// ─────────────────────────────────────────────────────────────────────────────

export function useTasks() {
  return useQuery({
    queryKey: qkCalendar.tasks,
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        // Outstanding first, then soonest due. A task list sorted by creation
        // date buries the thing due tomorrow under things due next month.
        .order('status')
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      dueDate?: string | null;
      priority?: TaskPriority;
      description?: string | null;
    }) => {
      const userId = await requireUserId();

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          title: input.title.trim(),
          due_date: input.dueDate ?? null,
          priority: input.priority ?? 'medium',
          description: input.description?.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => invalidateCalendar(qc),
  });
}

/**
 * Toggle done.
 *
 * `status` and `completed_at` are written together because the DB constraint
 * requires them to agree — a done task must carry a completion timestamp.
 * D§59 puts completing a task in the "no confirmation" bucket, which is safe
 * precisely because this toggles back.
 */
export function useToggleTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (task: Task) => {
      const done = task.status === 'todo';
      const { error } = await supabase
        .from('tasks')
        .update({
          status: done ? 'done' : 'todo',
          completed_at: done ? new Date().toISOString() : null,
        })
        .eq('id', task.id);
      if (error) throw error;
      return done;
    },
    onSuccess: () => invalidateCalendar(qc),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateCalendar(qc),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// The merged timeline
// ─────────────────────────────────────────────────────────────────────────────

function useRecurringIncomeSchedule() {
  return useQuery({
    queryKey: qkCalendar.recurringIncomeSchedule,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_transactions')
        // `!inner` so an archived account excludes the row rather than
        // returning it with a null join. A payday only belongs on the calendar
        // while the account it lands in is live — the same condition
        // `generate_due_recurring()` now applies, and the two must agree or the
        // calendar draws income that will never arrive.
        .select('id, amount_minor, day_of_month, description, accounts!inner(archived_at)')
        .eq('type', 'income')
        .is('archived_at', null)
        .is('accounts.archived_at', null);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        amountMinor: r.amount_minor,
        dayOfMonth: r.day_of_month,
        label: r.description ?? 'Income',
      }));
    },
  });
}

/**
 * The money + time merge (P§16, P§35).
 *
 * Bills and paydays are DERIVED from the tables that own them rather than
 * copied into calendar rows, so the calendar can never disagree with the
 * ledger.
 */
export function useTimeline(rangeStart: string, rangeEnd: string) {
  const { data: bills = [], isLoading: l1 } = useBills();
  const { data: events = [], isLoading: l2 } = useEvents(rangeStart, rangeEnd);
  const { data: tasks = [], isLoading: l3 } = useTasks();
  const { data: recurringIncome = [], isLoading: l4 } = useRecurringIncomeSchedule();
  // Expanded from the recurrence rule locally — no per-range fetch, which is
  // the practical payoff of storing a rule rather than generated rows (P§28).
  const { shifts, isLoading: l5 } = useShifts(rangeStart, rangeEnd);

  const entries = useMemo<TimelineEntry[]>(
    () => buildTimeline({ bills, events, tasks, recurringIncome, shifts, rangeStart, rangeEnd }),
    [bills, events, tasks, recurringIncome, shifts, rangeStart, rangeEnd]
  );

  return { entries, isLoading: l1 || l2 || l3 || l4 || l5 };
}

/** Today's entries, for dashboard Level 3. */
export function useTodayTimeline() {
  const today = todayISO();
  const { entries, isLoading } = useTimeline(today, today);
  return { entries, isLoading };
}
