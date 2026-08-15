/**
 * Settings → Ask Savi (AI-BOUNDARY §3 and §4).
 *
 * Two obligations live here, and neither is decoration:
 *
 *   §3  The full statement of what leaves the device and what does not. The
 *       version shown before the first question is short; this is the complete
 *       one, available whenever the user goes looking.
 *   §4  The off switch. Turning it off falls back to the deterministic insight
 *       rules, which never left the device — so the user loses the
 *       conversation, not the intelligence.
 *
 * Deleting conversations is here too, because §3 promises the user can, and a
 * promise with no control is not a promise.
 */

import { useState } from 'react';
import { Switch, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/feedback';
import { Text } from '@/components/ui/Text';
import { GRANTABLE_TOOLS, type GrantableTool } from '@/lib/database.types';
import { a11y, space } from '@/theme/tokens';

import {
  useAiPreferences,
  useConversations,
  useDeleteConversation,
  useSetToolGrant,
  useToolGrants,
  useUpdateAiPreferences,
} from './api';

/**
 * One line each, in plain language. A permission the user cannot understand is
 * not a permission they can meaningfully give.
 */
const TOOL_LABELS: Record<GrantableTool, { label: string; hint: string }> = {
  create_task: { label: 'Add tasks', hint: 'Savi can add a to-do to your list.' },
  create_reminder: { label: 'Add reminders', hint: 'Savi can set a dated reminder.' },
  create_calendar_event: {
    label: 'Add calendar events',
    hint: 'Savi can put an event on your calendar.',
  },
};

export function AiSettings() {
  const { data: prefs, isLoading } = useAiPreferences();
  const update = useUpdateAiPreferences();
  const { data: conversations = [] } = useConversations();
  const deleteConversation = useDeleteConversation();
  const { data: grants = [] } = useToolGrants();
  const setGrant = useSetToolGrant();

  const [confirmingClear, setConfirmingClear] = useState(false);

  const enabled = prefs?.enabled ?? false;

  function clearAll() {
    // D§59: this is destructive and irreversible, so it is confirmed —
    // unlike "mark as paid", which is not.
    for (const c of conversations) deleteConversation.mutate(c.id);
    setConfirmingClear(false);
  }

  return (
    <View style={{ gap: space[3] }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          minHeight: a11y.minTouchTarget,
          opacity: isLoading ? 0.5 : 1,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="body" weight="500">
            Ask Savi
          </Text>
          <Text variant="caption" tone="secondary">
            Ask questions about your money and schedule in your own words.
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={(v) => update.mutate({ enabled: v })}
          disabled={isLoading}
          accessibilityLabel="Ask Savi"
        />
      </View>

      <Divider />

      <Text variant="caption" tone="secondary">
        When you ask a question, Savi sends that question and a summary of your figures — your
        available money, upcoming bills, recent spending by category, and what&apos;s on your
        calendar — to an AI service to write the answer.
      </Text>
      <Text variant="caption" tone="secondary">
        Your name, email address, and account names and balances are never sent. Savi reads
        only — the one exception is the permissions below, which you grant yourself and which
        always ask before saving.
      </Text>
      <Text variant="caption" tone="secondary">
        With Ask Savi off, the insight card on the Savi tab keeps working — those insights are
        worked out on your device and are never sent anywhere.
      </Text>

      <Divider />

      {/* ── What Savi may create (P§31, v0.6) ──────────────────────────── */}
      <Text variant="body" weight="500">
        What Savi can create
      </Text>
      <Text variant="caption" tone="secondary">
        Off by default. Savi always asks you to confirm before saving anything, even when a
        permission is on.
      </Text>

      {GRANTABLE_TOOLS.map((tool) => (
        <View
          key={tool}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
            minHeight: a11y.minTouchTarget,
            opacity: enabled ? 1 : 0.5,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="body">{TOOL_LABELS[tool].label}</Text>
            <Text variant="caption" tone="secondary">
              {TOOL_LABELS[tool].hint}
            </Text>
          </View>
          <Switch
            value={grants.includes(tool)}
            onValueChange={(v) => setGrant.mutate({ tool, granted: v })}
            // Granting a tool to an assistant that is switched off is a setting
            // with no effect, so the control says so by being unavailable.
            disabled={!enabled || isLoading}
            accessibilityLabel={TOOL_LABELS[tool].label}
          />
        </View>
      ))}

      <Text variant="caption" tone="secondary">
        Savi can never move money, pay a bill, record a transaction, or delete anything — there
        is no permission for those, and there won&apos;t be.
      </Text>

      <Divider />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space[3],
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="body">Saved conversations</Text>
          <Text variant="caption" tone="secondary">
            {conversations.length === 0
              ? 'Nothing saved yet.'
              : `${conversations.length} ${conversations.length === 1 ? 'conversation' : 'conversations'} stored in your account.`}
          </Text>
        </View>
      </View>

      {conversations.length > 0 &&
        (confirmingClear ? (
          <View style={{ gap: space[2] }}>
            <Text variant="bodySm" tone="danger">
              Delete every saved conversation? This can&apos;t be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              <Button label="Delete all" variant="danger" size="sm" onPress={clearAll} />
              <Button
                label="Keep them"
                variant="ghost"
                size="sm"
                onPress={() => setConfirmingClear(false)}
              />
            </View>
          </View>
        ) : (
          <Button
            label="Delete all conversations"
            variant="secondary"
            size="sm"
            onPress={() => setConfirmingClear(true)}
          />
        ))}
    </View>
  );
}
