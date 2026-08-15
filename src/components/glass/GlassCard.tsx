/**
 * GlassCard — the default Savi surface (D§24, D§55).
 *
 * Blur is OPT-IN, not default. That inverts v1.0's assumption deliberately (A6):
 * `backdrop-filter` does not exist in React Native, and on Android — the primary
 * platform — blur costs real frames and misbehaves inside scrolling content.
 * D§32, D§34 and D§35 are all lists of glass cards, i.e. the worst case.
 *
 * So the safe rendering is the default and blur is something a surface asks for.
 * A forgotten `blur` prop costs a little beauty; a forgotten `blur={false}` in a
 * 200-row list costs the frame rate. Make the cheap mistake the default one.
 *
 * Per A6, blur is appropriate for: bottom nav, modals, sheets, dashboard hero —
 * a bounded number of simultaneously visible surfaces. Never a list row.
 */

import { BlurView } from 'expo-blur';
import { type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { pressScale, radius as radiusTokens, space, type GlassLevel } from '@/theme/tokens';

type RadiusName = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type PaddingName = 'none' | 'sm' | 'md' | 'lg';

const PADDING: Record<PaddingName, number> = {
  none: 0,
  sm: space[3],
  md: space[4],
  lg: space[5],
};

/**
 * Whether real backdrop blur is available and affordable on this platform.
 * Web composites it on the GPU cheaply; iOS has a native implementation.
 * Android is gated behind an explicit opt-in even when requested — see
 * `allowAndroidBlur`.
 */
export const BLUR_IS_CHEAP = Platform.OS === 'web' || Platform.OS === 'ios';

export type GlassCardProps = {
  children?: ReactNode;
  /** D§9 glass level. `default` is the standard Savi surface. */
  variant?: GlassLevel;
  radius?: RadiusName;
  padding?: PaddingName;
  /** Adds press feedback and the correct accessibility role. */
  interactive?: boolean;
  onPress?: () => void;
  /**
   * Request backdrop blur. Ignored inside lists by convention — see the module
   * comment. Defaults to false so the safe path is the default path.
   */
  blur?: boolean;
  /**
   * Escape hatch for the M0 spike, which needs to force blur on Android to
   * measure it. Product code should not set this until M0 says Android blur is
   * affordable.
   */
  allowAndroidBlur?: boolean;
  /**
   * §65's Savi Glow — a tinted drop shadow that REPLACES the card's default one.
   *
   * Replacing matters. On Android the default shadow is `elevation`, drawn
   * natively behind the view; a `boxShadow` set through `style` does not
   * override it, it paints a second halo on top of it. Routing the glow through
   * this prop lets the card emit exactly one shadow on every platform.
   */
  glow?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function GlassCard({
  children,
  variant = 'default',
  radius = 'xl',
  padding = 'md',
  interactive = false,
  onPress,
  blur = false,
  allowAndroidBlur = false,
  glow,
  style,
  testID,
}: GlassCardProps) {
  const theme = useTheme();
  const level = theme.glass[variant];

  const useRealBlur = blur && (BLUR_IS_CHEAP || allowAndroidBlur);

  const shape: ViewStyle = {
    borderRadius: radiusTokens[radius],
    borderWidth: StyleSheet.hairlineWidth > 1 ? 1 : StyleSheet.hairlineWidth,
    borderColor: level.border,
    padding: PADDING[padding],
    overflow: 'hidden',
  };

  const surface: ViewStyle = useRealBlur
    ? { backgroundColor: level.background }
    : // A4: the solid composite. Not a degraded state — the baseline.
      { backgroundColor: level.fallback };

  // A7: `elevation` is the untinted Android fallback, so a tinted glow has to
  // take the `boxShadow` path on every platform — including Android, where M0
  // confirmed RN 0.86's New Architecture renders it.
  const dropShadow = glow
    ? { boxShadow: glow }
    : Platform.OS === 'android'
      ? { elevation: theme.shadow.md.elevation }
      : { boxShadow: theme.shadow.md.boxShadow };

  const content = (
    <View style={[shape, surface, dropShadow, style]} testID={testID}>
      {useRealBlur && (
        <BlurView
          intensity={level.blur}
          tint={theme.isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
          // Android needs this to do anything at all; it is the expensive path.
          experimentalBlurMethod={allowAndroidBlur ? 'dimezisBlurView' : undefined}
        />
      )}
      {children}
    </View>
  );

  if (!interactive && !onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => (pressed ? { transform: [{ scale: pressScale.card }] } : null)}
    >
      {content}
    </Pressable>
  );
}
