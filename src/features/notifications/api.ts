/**
 * Notification platform layer.
 *
 * Everything decision-shaped lives in `schedule.ts` as pure functions; this
 * file only talks to the OS and the database.
 *
 * Local notifications only — see the note at the top of schedule.ts for why
 * push is not needed for anything Savi currently sends.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

import { useBills } from '@/features/bills/api';
import { useTasks } from '@/features/calendar/api';
import { currentUserId, requireUserId, supabase } from '@/lib/supabase';

import { planNotifications, reconcile, type NotificationPreferences } from './schedule';

/** Web has no local-notification scheduling through expo-notifications. */
export const NOTIFICATIONS_SUPPORTED = Platform.OS !== 'web';

export const qkNotifications = {
  prefs: ['notification-preferences'] as const,
};

if (NOTIFICATIONS_SUPPORTED) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false, // D§63: a bill reminder should not startle anyone.
      shouldSetBadge: false,
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Preferences
// ─────────────────────────────────────────────────────────────────────────────

export function useNotificationPreferences() {
  return useQuery({
    queryKey: qkNotifications.prefs,
    queryFn: async (): Promise<NotificationPreferences | null> => {
      const userId = await currentUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        // The primary key is user_id, not id — this table is 1:1 with the user.
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return (data as NotificationPreferences | null) ?? null;
    },
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<NotificationPreferences>) => {
      const userId = await requireUserId();

      const { error } = await supabase
        .from('notification_preferences')
        .update(patch)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qkNotifications.prefs }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission
// ─────────────────────────────────────────────────────────────────────────────

export type PermissionSnapshot =
  | { state: 'unsupported' }
  | { state: 'granted' }
  /** Not granted, but the OS will still show the dialog. */
  | { state: 'askable' }
  /** Not granted and the OS will not ask again — only system settings can fix it. */
  | { state: 'blocked' };

/**
 * `canAskAgain` is the field that matters, not `status`.
 *
 * Android reports `denied` for a permission that has never been requested, so
 * branching on `status` alone told a fresh install that reminders were "turned
 * off in your phone's settings" — sending the user to Settings when tapping a
 * button would have worked. Only `canAskAgain === false` means genuinely stuck.
 */
export async function getPermissionSnapshot(): Promise<PermissionSnapshot> {
  if (!NOTIFICATIONS_SUPPORTED) return { state: 'unsupported' };

  const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
  if (granted) return { state: 'granted' };
  return { state: canAskAgain ? 'askable' : 'blocked' };
}

/**
 * Ask the OS.
 *
 * Android 13+ requires POST_NOTIFICATIONS at runtime, and the system dialog
 * can only be shown once — a decline is permanent until the user goes into
 * Settings. So this is only called from an explicit user action (turning the
 * toggle on), never on launch: an unexplained prompt on first open is the
 * fastest way to get permanently denied.
 */
export async function requestPermission(): Promise<boolean> {
  if (!NOTIFICATIONS_SUPPORTED) return false;

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;

  const { granted } = await Notifications.requestPermissionsAsync();

  if (granted && Platform.OS === 'android') {
    // Android needs an explicit channel or notifications post silently into a
    // default bucket the user cannot configure separately.
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Bill and task reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      vibrationPattern: [0, 200],
    });
  }

  return granted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reconciliation
// ─────────────────────────────────────────────────────────────────────────────

async function scheduledIds(): Promise<string[]> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled
    .map((s) => (s.content.data as { saviId?: string } | null)?.saviId)
    .filter((id): id is string => typeof id === 'string');
}

/**
 * Bring the OS's scheduled set in line with what the data says it should be.
 *
 * Diffed rather than cleared-and-rebuilt: see `reconcile` in schedule.ts.
 */
export async function syncScheduledNotifications(args: {
  bills: Parameters<typeof planNotifications>[0]['bills'];
  tasks: Parameters<typeof planNotifications>[0]['tasks'];
  prefs: NotificationPreferences | null;
}): Promise<{ scheduled: number; cancelled: number } | null> {
  if (!NOTIFICATIONS_SUPPORTED || !args.prefs) return null;

  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return null;

  const planned = planNotifications({ bills: args.bills, tasks: args.tasks, prefs: args.prefs });
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const existingIds = await scheduledIds();

  const { toSchedule, toCancel } = reconcile(planned, existingIds);

  for (const id of toCancel) {
    const match = existing.find(
      (s) => (s.content.data as { saviId?: string } | null)?.saviId === id
    );
    if (match) await Notifications.cancelScheduledNotificationAsync(match.identifier);
  }

  for (const n of toSchedule) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: n.title,
        body: n.body,
        data: { saviId: n.id, category: n.category },
        // `false`, not null — D§63: a bill reminder should arrive quietly.
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: n.fireAt,
        channelId: 'reminders',
      },
    });
  }

  return { scheduled: toSchedule.length, cancelled: toCancel.length };
}

/**
 * Keep the OS in sync whenever the inputs change.
 *
 * Mounted once at the app root. Reminders are derived state — leaving them to
 * be scheduled at the point a bill is created would mean any edit, payment, or
 * preference change silently left a stale reminder behind.
 */
export function useNotificationSync() {
  const { data: bills = [] } = useBills();
  const { data: tasks = [] } = useTasks();
  const { data: prefs } = useNotificationPreferences();

  const sync = useCallback(() => {
    void syncScheduledNotifications({ bills, tasks, prefs: prefs ?? null });
  }, [bills, tasks, prefs]);

  useEffect(() => {
    sync();
  }, [sync]);
}
