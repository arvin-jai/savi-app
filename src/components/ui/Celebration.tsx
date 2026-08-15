/**
 * Celebration (D§26, D§59) — the moment an accomplishment is acknowledged.
 *
 * **Why this is not just a nicer toast.** D§59 removed the confirmation dialog
 * from "Mark as paid" and paid for it with an undo toast. That toast is a
 * *safety* affordance: it says "this can be taken back". It is deliberately
 * quiet, and quiet is the wrong register for "you just cleared every bill you
 * owe this month". Those are two different messages and they need two
 * different surfaces, so the toast keeps its job and this takes the other one.
 *
 * **The scarcity rule — read this before adding a call site.** A celebration
 * that fires on every save is wallpaper within a day, and then the one that
 * matters lands on a user who has learned to dismiss it. So this fires on
 * *milestones only*: the last unpaid bill of the month, a goal reaching its
 * target, finishing onboarding. Paying the third of seven bills gets the toast.
 * If a new call site cannot be described as "a thing that does not happen most
 * days", it is a toast, not a celebration.
 *
 * **Reduced motion (A15).** The burst is the decoration; the headline is the
 * information. Under reduced motion the ring and rays stop moving and the card
 * cross-fades instead — nothing is conveyed by the animation alone. Haptics are
 * NOT suppressed: they are a separate OS setting which the platform already
 * honours, and suppressing them would take away the one channel that still
 * works for a user who has turned motion off (see lib/haptics.ts).
 */

import { Check } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useReducedMotion } from '@/theme/useReducedMotion';
import { hapticCelebrate } from '@/lib/haptics';
import { duration, radius, space, z, type SemanticName } from '@/theme/tokens';

import { Text } from './Text';

/** How long the card stays up before dismissing itself. */
const HOLD_MS = 2600;

/** Rays in the burst. Eight reads as a starburst; more reads as noise. */
const RAY_COUNT = 8;

export type CelebrationProps = {
  visible: boolean;
  /** The accomplishment, in the user's terms. "All bills paid." */
  title: string;
  /** What it means for them. One line. Optional. */
  body?: string;
  /** Tints the ring and rays. `income` (green) is the default success tone. */
  tone?: SemanticName;
  onDismiss: () => void;
};

export function Celebration({
  visible,
  title,
  body,
  tone = 'income',
  onDismiss,
}: CelebrationProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();

  // One driver for the whole sequence, so the ring, the rays and the card can
  // never drift out of step with each other.
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      return;
    }

    hapticCelebrate();

    Animated.timing(progress, {
      toValue: 1,
      duration: reducedMotion ? duration.fast : duration.slow,
      easing: reducedMotion ? Easing.linear : Easing.out(Easing.back(2)),
      useNativeDriver: true,
    }).start();

    const t = setTimeout(onDismiss, HOLD_MS);
    return () => clearTimeout(t);
    // `onDismiss` is intentionally out of the deps: an inline arrow at the call
    // site would otherwise restart the timer on every parent render and the
    // card would never close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reducedMotion, progress]);

  if (!visible) return null;

  const fill = theme.semanticFill(tone);

  return (
    <Modal transparent visible animationType="none" onRequestClose={onDismiss}>
      <Pressable
        onPress={onDismiss}
        // The whole scrim dismisses, so a user who has seen it is never made to
        // wait out the timer or hunt for a close button.
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: space[5],
          zIndex: z.modal,
          backgroundColor: theme.isDark ? 'rgba(6,6,12,0.62)' : 'rgba(20,18,40,0.38)',
        }}
      >
        <Animated.View
          accessibilityLiveRegion="assertive"
          style={{
            alignItems: 'center',
            gap: space[4],
            maxWidth: 340,
            paddingVertical: space[8],
            paddingHorizontal: space[6],
            borderRadius: radius['2xl'],
            borderWidth: 1,
            borderColor: theme.glass.elevated.border,
            backgroundColor: theme.glass.elevated.fallback,
            opacity: progress,
            ...(reducedMotion
              ? null
              : {
                  // A15/Button.tsx: the key is omitted entirely rather than set
                  // to undefined — `transform: undefined` crashes the native
                  // style processor.
                  transform: [
                    {
                      scale: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.86, 1],
                      }),
                    },
                  ],
                }),
          }}
        >
          <Burst progress={progress} fill={fill} reducedMotion={reducedMotion} />

          <View style={{ gap: space[2] }}>
            <Text variant="h3" style={{ textAlign: 'center' }}>
              {title}
            </Text>
            {body && (
              <Text variant="bodySm" tone="secondary" style={{ textAlign: 'center' }}>
                {body}
              </Text>
            )}
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

/**
 * The check inside a ring, with rays thrown outward from behind it.
 *
 * Plain Views on the native driver rather than a Lottie or a confetti library:
 * a milestone animation is not worth a native dependency, and everything here
 * is opacity and transform, which is exactly what the native driver can carry
 * off the JS thread.
 */
function Burst({
  progress,
  fill,
  reducedMotion,
}: {
  progress: Animated.Value;
  fill: string;
  reducedMotion: boolean;
}) {
  const RING = 88;

  return (
    <View
      style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}
    >
      {!reducedMotion &&
        Array.from({ length: RAY_COUNT }, (_, i) => {
          const angle = (i / RAY_COUNT) * 2 * Math.PI;
          // Rays travel out to just past the ring and fade as they go, so the
          // burst reads as a flash rather than as eight dots parked in a circle.
          const travel = RING * 0.62;

          return (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                width: 5,
                height: 5,
                borderRadius: radius.full,
                backgroundColor: fill,
                opacity: progress.interpolate({
                  inputRange: [0, 0.45, 1],
                  outputRange: [0, 0.9, 0],
                }),
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, Math.cos(angle) * travel],
                    }),
                  },
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, Math.sin(angle) * travel],
                    }),
                  },
                ],
              }}
            />
          );
        })}

      <View
        style={{
          width: RING,
          height: RING,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          // A11's tint range. The ring is decoration behind an icon, never a
          // background for text, so the fill colour is safe to use directly.
          backgroundColor: `${fill}26`,
          borderWidth: 2,
          borderColor: `${fill}66`,
        }}
      >
        <Check size={40} color={fill} strokeWidth={3} />
      </View>
    </View>
  );
}
