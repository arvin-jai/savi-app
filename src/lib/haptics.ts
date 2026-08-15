/**
 * Haptics — the half of "rewarding" that does not occupy the screen.
 *
 * Wrapped rather than imported directly for three reasons:
 *
 *  1. **It must never be able to break an action.** Paying a bill succeeding
 *     and then throwing on the way out because the vibrator is unavailable is
 *     strictly worse than no haptic at all. Every call here is fire-and-forget
 *     and swallows its own failure.
 *  2. **Web has no equivalent.** `expo-haptics` no-ops there, but the guard
 *     keeps that a stated fact rather than a thing to rediscover.
 *  3. **A15's reduced-motion rule is about motion, not touch.** They are
 *     separate settings and the OS already honours a user who has switched
 *     haptics off system-wide, so this deliberately does *not* read
 *     `useReducedMotion`. Don't "fix" that — see the note in Celebration.tsx.
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

/** A completed, consequential action — bill paid, goal reached. */
export function hapticSuccess(): void {
  if (!SUPPORTED) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Something did not go through. */
export function hapticError(): void {
  if (!SUPPORTED) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

/** A step landed — advancing onboarding, a selection committing. */
export function hapticStep(): void {
  if (!SUPPORTED) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** The big one. Reserved for milestones, not for every save. */
export function hapticCelebrate(): void {
  if (!SUPPORTED) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  setTimeout(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, 120);
}
