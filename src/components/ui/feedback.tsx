/**
 * Feedback primitives: Badge, Skeleton, EmptyState, Divider, Toast.
 *
 * Toast exists because D§59 removes confirmation from "Mark as paid" and
 * "Complete task" — which is only safe if the action can be undone. D§54's
 * component list had no toast, so the undo affordance had nowhere to live.
 */

import { useEffect, useRef } from 'react';
import { Animated, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useReducedMotion } from '@/theme/useReducedMotion';
import {
  a11y,
  duration,
  opacity,
  radius,
  semantic,
  space,
  z,
  type SemanticName,
} from '@/theme/tokens';

import { Text } from './Text';

// ─────────────────────────────────────────────────────────────────────────────
// Badge
// ─────────────────────────────────────────────────────────────────────────────

export function Badge({
  label,
  tone = 'info',
}: {
  label: string;
  tone?: SemanticName;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: space[2],
        paddingVertical: space[1],
        borderRadius: radius.full,
        backgroundColor: theme.isDark
          ? `${semantic[tone].fill}26` // ~15% — A11 tint range
          : semantic[tone].tintLight,
      }}
    >
      {/* A2: text variant, not the fill. The fill fails AA at this size. */}
      <Text variant="micro" weight="600" tone={tone}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Status pill for bills (D§34) and financial state.
 *
 * D§44 is explicit: never color alone. The label IS the accessibility mechanism,
 * so `label` is required — there is no icon-only variant on purpose.
 */
export function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: SemanticName;
}) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: radius.full,
          backgroundColor: theme.semanticFill(tone),
        }}
      />
      <Text variant="caption" weight="500" tone={tone}>
        {label}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton (D§57)
// ─────────────────────────────────────────────────────────────────────────────

export function Skeleton({
  width = '100%',
  height = 16,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // A15: the shimmer becomes a static block under reduced motion. The
    // accessibilityRole below is what actually conveys "loading" — the pulse
    // was only ever decoration, so removing it costs no information.
    if (reducedMotion) {
      pulse.setValue(1);
      return;
    }

    // D§57: 1.2–1.6s. Slow enough to read as "loading", not as a flicker.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reducedMotion]);

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[
        {
          width,
          height,
          borderRadius: radius.sm,
          backgroundColor: theme.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [opacity.skeleton * 0.7, opacity.skeleton],
          }),
        },
        style,
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state (D§56)
// ─────────────────────────────────────────────────────────────────────────────

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: space[10], gap: space[3] }}>
      <Text variant="h4">{title}</Text>
      <Text variant="bodySm" tone="secondary" style={{ textAlign: 'center', maxWidth: 280 }}>
        {body}
      </Text>
      {action && <View style={{ marginTop: space[2] }}>{action}</View>}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Divider
// ─────────────────────────────────────────────────────────────────────────────

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[{ height: 1, backgroundColor: theme.color.border }, style]} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast (A15)
// ─────────────────────────────────────────────────────────────────────────────

export function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
  visible,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  visible: boolean;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      // A15: the fade is kept but shortened; only the translate is dropped.
      duration: reducedMotion ? duration.fast : duration.normal,
      useNativeDriver: true,
    }).start();

    if (!visible || !onDismiss) return;
    const t = setTimeout(onDismiss, a11y.toastDuration);
    return () => clearTimeout(t);
  }, [visible, onDismiss, slide]);

  if (!visible) return null;

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        left: space[4],
        right: space[4],
        // Sits above the floating nav, below modals — A15 layering.
        bottom: space[4],
        zIndex: z.toast,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space[4],
        paddingHorizontal: space[4],
        paddingVertical: space[3],
        borderRadius: radius.lg,
        backgroundColor: theme.isDark ? '#2A2A3A' : '#26262F',
        opacity: slide,
        // Key omitted entirely under reduced motion — see Button.tsx: a
        // `transform: undefined` crashes the native style processor.
        ...(reducedMotion
          ? null
          : {
              transform: [
                { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
              ],
            }),
      }}
    >
      <Text variant="bodySm" style={{ color: '#F8FAFC', flex: 1 }}>
        {message}
      </Text>

      {actionLabel && (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          hitSlop={12}
          style={{ minHeight: a11y.minTouchTarget, justifyContent: 'center' }}
        >
          <Text variant="bodySm" weight="600" style={{ color: '#C4B5FD' }}>
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}
