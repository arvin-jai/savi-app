/**
 * Notification settings (P§26).
 *
 * "Avoid excessive notifications" is implemented here as a control rather than
 * only as restraint — per-category switches mean someone irritated by task
 * reminders can silence those without losing the bill reminders that are, for
 * P§3's core user, the reason the app exists.
 */

import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/controls';
import { Divider } from '@/components/ui/feedback';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { a11y, space } from '@/theme/tokens';

import {
  getPermissionSnapshot,
  NOTIFICATIONS_SUPPORTED,
  requestPermission,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  type PermissionSnapshot,
} from './api';

type PermissionState = 'unknown' | PermissionSnapshot['state'];

export function NotificationSettings() {
  const { data: prefs, isLoading } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const [permission, setPermission] = useState<PermissionState>('unknown');

  useEffect(() => {
    getPermissionSnapshot().then((snap) => setPermission(snap.state));
  }, []);

  if (!NOTIFICATIONS_SUPPORTED) {
    return (
      <Text variant="bodySm" tone="secondary">
        Reminders work on the Savi app for Android. The web version can&apos;t schedule them.
      </Text>
    );
  }

  if (isLoading || !prefs) {
    return (
      <Text variant="bodySm" tone="secondary">
        Loading…
      </Text>
    );
  }

  const needsPermission = permission === 'askable';
  const blocked = permission === 'blocked';

  return (
    <View style={{ gap: space[4] }}>
      {/* The OS gate. Showing the app's own toggles as "on" while the system
          permission is off would be a lie about what will actually happen. */}
      {needsPermission && (
        <View style={{ gap: space[2] }}>
          <Text variant="bodySm" tone="secondary">
            Savi needs your permission to send reminders. Nothing leaves your phone — reminders
            are scheduled on the device from your own bill dates.
          </Text>
          <Button
            label="Allow reminders"
            size="sm"
            onPress={async () => {
              const granted = await requestPermission();
              setPermission(granted ? 'granted' : 'blocked');
            }}
          />
        </View>
      )}

      {blocked && (
        <Text variant="bodySm" tone="danger">
          Reminders are turned off for Savi in your phone&apos;s settings. You&apos;ll need to
          re-enable them there.
        </Text>
      )}

      <Row
        label="Reminders"
        hint="The master switch for everything below"
        value={prefs.enabled}
        disabled={permission !== 'granted'}
        onChange={(enabled) => update.mutate({ enabled })}
      />

      <Divider />

      <Row
        label="Bills"
        hint="Before a bill is due"
        value={prefs.bills_enabled}
        disabled={!prefs.enabled || permission !== 'granted'}
        onChange={(bills_enabled) => update.mutate({ bills_enabled })}
      />
      <Row
        label="Tasks"
        hint="On the day a task is due"
        value={prefs.tasks_enabled}
        disabled={!prefs.enabled || permission !== 'granted'}
        onChange={(tasks_enabled) => update.mutate({ tasks_enabled })}
      />

      <Divider />

      <View style={{ gap: space[2] }}>
        <Text variant="label" tone="secondary">
          Warn me about bills
        </Text>
        <Segmented<string>
          value={String(prefs.bill_lead_days)}
          onChange={(v) => update.mutate({ bill_lead_days: Number(v) })}
          options={[
            { value: '0', label: 'Same day' },
            { value: '1', label: '1 day' },
            { value: '3', label: '3 days' },
            { value: '7', label: 'A week' },
          ]}
        />
      </View>

      <Input
        label="Remind me at"
        value={prefs.remind_at.slice(0, 5)}
        onChangeText={(v) => {
          // Only write a complete, valid time — partial input while typing
          // would otherwise be persisted and rejected by the column.
          if (/^\d{2}:\d{2}$/.test(v)) update.mutate({ remind_at: `${v}:00` });
        }}
        placeholder="09:00"
        hint="A reminder at 3am is worse than no reminder"
      />
    </View>
  );
}

function Row({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        minHeight: a11y.minTouchTarget,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="body" weight="500">
          {label}
        </Text>
        <Text variant="caption" tone="secondary">
          {hint}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
      />
    </View>
  );
}
