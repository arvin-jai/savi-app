/**
 * What to remind, and when (P§26).
 *
 * A pure function: bills + tasks + preferences + now → the exact set of local
 * notifications to schedule. No I/O, so every rule below is testable, and the
 * platform layer in `api.ts` just applies whatever this returns.
 *
 * ── Why local, not push ──────────────────────────────────────────────────────
 * Every reminder here is derivable from data the device already has. A bill due
 * on the 15th does not need a server to announce it. Local scheduling means:
 * no FCM project, no push credentials, it works with no signal, and no due-date
 * data leaves the phone. Push is only warranted for things ONLY the server
 * knows — server-generated AI insights at v0.5 — and that is when to add it.
 *
 * ── Voice ────────────────────────────────────────────────────────────────────
 * D§63: a notification is the most intrusive surface in the product, so the
 * calm-voice rule matters most here. "Your internet bill is due tomorrow", not
 * "⚠️ PAYMENT DUE!".
 */

import type { BillWithStatus } from '@/features/bills/api';
import type { Task } from '@/lib/database.types';
import { parseISODate, todayISO } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

export type NotificationPreferences = {
  enabled: boolean;
  bills_enabled: boolean;
  tasks_enabled: boolean;
  events_enabled: boolean;
  income_enabled: boolean;
  bill_lead_days: number;
  /** 'HH:MM' or 'HH:MM:SS' local time. */
  remind_at: string;
};

export type PlannedNotification = {
  /**
   * Stable across recomputations — the same bill and period always produce the
   * same id. That is what lets the reconciler diff instead of cancelling and
   * re-creating everything, which would re-notify the user for things they had
   * already been told about.
   */
  id: string;
  title: string;
  body: string;
  /** Local wall-clock instant to fire. */
  fireAt: Date;
  category: 'bill' | 'task';
};

function atTime(dateISO: string, remindAt: string): Date {
  const [h, m] = remindAt.split(':').map(Number);
  const d = parseISODate(dateISO);
  d.setHours(h ?? 9, m ?? 0, 0, 0);
  return d;
}

function subtractDays(dateISO: string, days: number): string {
  const d = parseISODate(dateISO);
  d.setDate(d.getDate() - days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dayWord(dueISO: string, fireISO: string): string {
  const diff = Math.round(
    (parseISODate(dueISO).getTime() - parseISODate(fireISO).getTime()) / 86_400_000
  );
  if (diff <= 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return `in ${diff} days`;
}

export function planNotifications(args: {
  bills: BillWithStatus[];
  tasks: Task[];
  prefs: NotificationPreferences;
  /** Injected for testability; defaults to now. */
  now?: Date;
}): PlannedNotification[] {
  const { bills, tasks, prefs } = args;
  const now = args.now ?? new Date();

  // The master switch short-circuits everything. Honouring it here rather than
  // at the platform layer means the reconciler naturally cancels everything
  // when the user turns notifications off.
  if (!prefs.enabled) return [];

  const planned: PlannedNotification[] = [];
  const today = todayISO();

  // ── Bills ─────────────────────────────────────────────────────────────────
  if (prefs.bills_enabled) {
    for (const bill of bills) {
      if (!bill.dueDate) continue;

      // A paid bill is not a reminder. This is the whole reason `status` is
      // computed from bill_payments rather than a flag — the reminder set
      // stays honest as soon as the user marks something paid.
      if (bill.status === 'paid') continue;

      const fireDateISO = subtractDays(bill.dueDate, prefs.bill_lead_days);
      const fireAt = atTime(fireDateISO, prefs.remind_at);

      // Never schedule in the past. An overdue bill already shows in the app
      // in red; firing a notification dated last Tuesday would be noise about
      // something the user cannot un-miss.
      if (fireAt.getTime() <= now.getTime()) continue;

      planned.push({
        id: `bill:${bill.id}:${bill.dueDate}`,
        title: bill.name,
        body: `${formatMoney(bill.amount_minor)} is due ${dayWord(bill.dueDate, fireDateISO)}.`,
        fireAt,
        category: 'bill',
      });
    }
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  if (prefs.tasks_enabled) {
    for (const task of tasks) {
      if (!task.due_date || task.status === 'done') continue;

      const fireAt = atTime(task.due_date, prefs.remind_at);
      if (fireAt.getTime() <= now.getTime()) continue;

      planned.push({
        id: `task:${task.id}:${task.due_date}`,
        title: task.title,
        body:
          task.priority === 'urgent' || task.priority === 'high'
            ? `Due ${dayWord(task.due_date, today)} · ${task.priority} priority`
            : `Due ${dayWord(task.due_date, today)}`,
        fireAt,
        category: 'task',
      });
    }
  }

  // Soonest first, so a capped scheduler keeps the most imminent.
  return planned.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}

/**
 * Diff planned against already-scheduled.
 *
 * Cancelling everything and rescheduling on each change would be simpler and
 * wrong: on Android a re-created notification can surface again, so a user who
 * edits an unrelated bill could be re-notified about one they already saw.
 * Diffing means untouched reminders are genuinely left alone.
 */
export function reconcile(
  planned: PlannedNotification[],
  scheduledIds: string[]
): { toSchedule: PlannedNotification[]; toCancel: string[] } {
  const plannedIds = new Set(planned.map((p) => p.id));
  const existing = new Set(scheduledIds);

  return {
    toSchedule: planned.filter((p) => !existing.has(p.id)),
    toCancel: scheduledIds.filter((id) => !plannedIds.has(id)),
  };
}
