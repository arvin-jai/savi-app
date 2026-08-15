/**
 * Ask Savi (D§29) — the conversational surface.
 *
 * "This should feel different from a generic chatbot." What makes it different
 * is not the chrome: it is that Savi answers from the user's own figures, in
 * D§63's calm voice, and says so when it doesn't know. The UI's job is to stay
 * out of the way of that.
 *
 * Structure follows D§30 — the Answer carries the most weight, the Reason and
 * Action sit under it as secondary text. `message.ts` does that shaping; this
 * file renders it.
 *
 * Rendering note (AI-BOUNDARY §6.3): model output is plain text. No markdown
 * rendering, no auto-linked URLs, and no navigation driven by model output —
 * the Action affordance maps to fixed in-app routes chosen here, never to a
 * string the model supplies.
 */

import { ArrowUp } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import { GlassCard } from '@/components/glass/GlassCard';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';
import {
  a11y,
  ambient,
  brand,
  brandRole,
  focus,
  iconSize,
  layout,
  opacity,
  radius,
  saviGlow,
  space,
} from '@/theme/tokens';
import { useBreakpoint } from '@/theme/useBreakpoint';

import {
  useAcknowledgeDisclosure,
  useAskSavi,
  useConfirmAction,
  useConversationMessages,
  type PendingAction,
} from './api';
import { shapeReply, SUGGESTED_QUESTIONS } from './message';

/**
 * The ✦ mark and wordmark, matching InsightCard so a Savi answer and a Savi
 * insight read as the same voice.
 */
function SaviMark({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: brand[400] }} />
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: ambient.blue,
            opacity: 0.7,
          }}
        />
      </View>
      <Text variant="label" weight="600" tone="brand">
        {label}
      </Text>
    </View>
  );
}

/**
 * The user's own words, right-aligned and brand-filled (handoff 2d).
 *
 * The fill is `brandRole.action`, the same value the primary Button uses, for
 * the reason A3 gives: it is the one brand step measured at 5.70:1 with white.
 * brand[500] is the intuitive "lighter" choice and fails AA at 4.22:1. It is
 * fixed across themes because a solid brand fill always carries white text.
 *
 * The square corner is bottom-RIGHT — the tail points back at the sender, which
 * is the only thing distinguishing the two bubble shapes at a glance.
 */
function UserBubble({ content }: { content: string }) {
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <View
        style={{
          maxWidth: '80%',
          paddingVertical: space[3],
          paddingHorizontal: space[4],
          borderRadius: radius.lg,
          borderBottomRightRadius: radius.xs,
          backgroundColor: brandRole.action,
        }}
      >
        <Text variant="body" weight="500" tone="onBrand">
          {content}
        </Text>
      </View>
    </View>
  );
}

function SaviBubble({ content }: { content: string }) {
  const shaped = shapeReply(content);
  if (!shaped) return null;

  return (
    <GlassCard
      padding="lg"
      glow={saviGlow.shadow}
      // Mirror of the user bubble: tail bottom-left, and it stops short of the
      // full width so the thread reads as two columns rather than one.
      style={{ gap: space[2], maxWidth: '92%', borderBottomLeftRadius: radius.xs }}
    >
      <SaviMark label="Savi" />

      <Text variant="bodyLg" weight="500">
        {shaped.answer}
      </Text>

      {shaped.rest.map((line, i) => (
        <Text key={i} variant="bodySm" tone="secondary">
          {line}
        </Text>
      ))}
    </GlassCard>
  );
}

/**
 * AI-BOUNDARY §3 — shown before the first message, not buried in a policy.
 *
 * Names what leaves the device AND what does not. "We may share data with
 * third parties" is technically true and tells the user nothing; the specific
 * version is the one that lets them decide.
 */
function Disclosure({ onAcknowledge }: { onAcknowledge: () => void }) {
  return (
    <GlassCard variant="subtle" padding="lg" style={{ gap: space[3] }}>
      <Text variant="label" weight="600">
        Before you start
      </Text>
      <Text variant="bodySm" tone="secondary">
        To answer, Savi sends your question and a summary of your amounts, bills and schedule to
        an AI service. Your name, email and account details are never sent. Savi can&apos;t move
        money or change anything you already have, and anything it does create it asks you to
        confirm first.
      </Text>
      <Text variant="bodySm" tone="secondary">
        You can turn this off any time in Settings.
      </Text>
      <Button label="Got it" variant="secondary" size="sm" onPress={onAcknowledge} />
    </GlassCard>
  );
}

function Suggestions({ onPick }: { onPick: (q: string) => void }) {
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="label" tone="secondary">
        Try asking
      </Text>
      {SUGGESTED_QUESTIONS.map((q) => (
        <Pressable
          key={q}
          onPress={() => onPick(q)}
          accessibilityRole="button"
          accessibilityLabel={`Ask: ${q}`}
          style={({ pressed }) => ({
            paddingVertical: space[3],
            paddingHorizontal: space[4],
            borderRadius: radius.md,
            // A15: 44px minimum touch target.
            minHeight: 44,
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text variant="body" tone="brand">
            {q}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * The confirmation gate (P§30 Phase 8) — nothing Savi proposes is saved until
 * the user taps here.
 *
 * The user approves the plain-language `summary`, not a JSON blob, and the
 * decline is a real, equally weighted option rather than a greyed-out afterthought.
 */
function ConfirmAction({
  action,
  onConfirm,
  onCancel,
  pending,
}: {
  action: PendingAction;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  return (
    <GlassCard variant="elevated" padding="lg" style={{ gap: space[3] }}>
      <SaviMark label="Savi wants to do this" />

      <Text variant="bodyLg" weight="500">
        {action.summary}
      </Text>
      <Text variant="bodySm" tone="secondary">
        Nothing has been saved yet.
      </Text>

      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <Button label="Confirm" onPress={onConfirm} loading={pending} />
        <Button label="No thanks" variant="ghost" onPress={onCancel} disabled={pending} />
      </View>
    </GlassCard>
  );
}

/**
 * The pill composer (handoff 2d) — the input bar replaces the FAB on this
 * screen, so it IS the one obvious primary action D§62 asks for.
 *
 * Built inline rather than from `Input` because the field and the send button
 * share a single pill: `Input` owns its own border, radius and 50px height, and
 * nesting it here would draw a rounded rectangle inside a pill.
 *
 * **Deviation from the reference, deliberately.** The handoff's send button is
 * 34px. A15 sets 44px as the floor for a touch target and it is the primary
 * action of the screen, so the circle is 44. That makes the bar 56px tall
 * rather than 50 — the only measurement on this screen that does not match the
 * HTML.
 */
function Composer({
  value,
  onChangeText,
  onSend,
  pending,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  pending: boolean;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const canSend = value.trim().length > 0 && !pending;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: space[2],
          borderRadius: radius['2xl'],
          borderWidth: 1,
          borderColor: focused ? focus.glowBorder : theme.glass.default.border,
          backgroundColor: theme.glass.default.fallback,
          paddingLeft: space[4],
          padding: space[2],
        },
        focused && { boxShadow: `0 0 0 3px ${focus.glow}` },
      ]}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Ask anything…"
        placeholderTextColor={theme.color.textSecondary}
        multiline
        // Measured: without this, RN Web's <textarea> takes its default TWO
        // rows and the pill renders 82px tall for an empty field. `multiline`
        // stays so a long question wraps rather than scrolling sideways.
        numberOfLines={1}
        accessibilityLabel="Ask Savi a question"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={onSend}
        editable={!pending}
        returnKeyType="send"
        style={[
          {
            flex: 1,
            // Matches the send button so a one-line question sits on its centre
            // line, and grows from there.
            minHeight: a11y.minTouchTarget,
            paddingHorizontal: 0,
            paddingVertical: space[3],
            fontSize: 15,
            color: theme.color.textPrimary,
          },
          // RN Web draws its own ring on the inner <input>; ours is on the pill.
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null,
        ]}
      />

      <Pressable
        onPress={onSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send question"
        accessibilityState={{ disabled: !canSend }}
        style={({ pressed }) => ({
          width: a11y.minTouchTarget,
          height: a11y.minTouchTarget,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          // A3: the same fill the primary Button uses — 5.70:1 with white.
          backgroundColor: pressed ? brand[800] : brandRole.action,
          opacity: canSend ? 1 : opacity.disabled,
        })}
      >
        {pending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <ArrowUp size={iconSize.md} color="#FFFFFF" strokeWidth={2.6} />
        )}
      </Pressable>
    </View>
  );
}

export function AskSavi({
  conversationId,
  onConversationStarted,
  disclosed,
  header,
}: {
  conversationId: string | null;
  onConversationStarted: (id: string) => void;
  disclosed: boolean;
  /** Rendered above the thread when it is empty — the current insight. */
  header?: React.ReactNode;
}) {
  const [draft, setDraft] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);

  const { data: messages = [], isLoading } = useConversationMessages(conversationId);
  const ask = useAskSavi();
  const confirm = useConfirmAction();
  const acknowledge = useAcknowledgeDisclosure();

  const { useSidebar } = useBreakpoint();
  // The pinned composer sits where a scroll inset would otherwise go, so it
  // takes the nav clearance itself: the floating bar's height plus its margin
  // on mobile, and nothing but breathing room on desktop.
  const composerBottomInset = useSidebar
    ? space[4]
    : layout.navHeight + space[3] + space[2];

  const isEmpty = messages.length === 0;

  function send(text: string) {
    const question = text.trim();
    if (!question || ask.isPending) return;

    setErrorMessage(null);
    setActionResult(null);
    // A new question supersedes any proposal the user did not act on. Leaving
    // it on screen would let them confirm an action belonging to a conversation
    // that has moved on.
    setPendingAction(null);
    setDraft('');

    ask.mutate(
      { message: question, conversationId },
      {
        onSuccess: (result) => {
          if (!conversationId) onConversationStarted(result.conversationId);
          if (result.pendingAction) setPendingAction(result.pendingAction);
        },
        onError: (err) => {
          setErrorMessage(err.message);
          // Hand the question back rather than losing what they typed.
          setDraft(question);
        },
      }
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: space[4], paddingBottom: space[4] }}
        keyboardShouldPersistTaps="handled"
      >
        {isEmpty && !isLoading && (
          <>
            {header}
            {!disclosed && <Disclosure onAcknowledge={acknowledge} />}
            <Suggestions onPick={send} />
          </>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <UserBubble key={m.id} content={m.content} />
          ) : (
            <SaviBubble key={m.id} content={m.content} />
          )
        )}

        {pendingAction && (
          <ConfirmAction
            action={pendingAction}
            pending={confirm.isPending}
            onConfirm={() =>
              confirm.mutate(pendingAction, {
                onSuccess: (result) => {
                  setPendingAction(null);
                  setActionResult(result.reply);
                },
                onError: (err) => {
                  setPendingAction(null);
                  setErrorMessage(err.message);
                },
              })
            }
            onCancel={() => {
              setPendingAction(null);
              setActionResult('Nothing was saved.');
            }}
          />
        )}

        {actionResult && (
          <Text variant="bodySm" tone="secondary">
            {actionResult}
          </Text>
        )}

        {ask.isPending && (
          <GlassCard padding="lg" style={{ gap: space[2] }}>
            <SaviMark label="Savi" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <ActivityIndicator color={brand[500]} />
              {/* D§63: calm, and honest about what is happening. */}
              <Text variant="bodySm" tone="secondary">
                Looking at your figures…
              </Text>
            </View>
          </GlassCard>
        )}

        {errorMessage && (
          <GlassCard variant="subtle" padding="lg" style={{ gap: space[2] }}>
            <Text variant="body" tone="danger">
              {errorMessage}
            </Text>
            <Text variant="bodySm" tone="secondary">
              Your question is still in the box — try sending it again.
            </Text>
          </GlassCard>
        )}
      </ScrollView>

      <View
        style={{
          paddingTop: space[2],
          // The composer is pinned, so it has to clear the floating nav (A15) —
          // but only where there IS one. With the sidebar the nav is gone, and
          // reserving its height would leave a hole under the input.
          paddingBottom: composerBottomInset,
        }}
      >
        <Composer
          value={draft}
          onChangeText={setDraft}
          onSend={() => send(draft)}
          pending={ask.isPending}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
