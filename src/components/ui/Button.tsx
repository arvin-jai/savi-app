/**
 * Button (D§22).
 *
 * D§22 defined only a pressed state. A15 requires the full set — default,
 * hover (web), pressed, focus, disabled, loading — because a component that
 * ships with three of six states gets the other three invented per screen.
 *
 * `loading` keeps the button's width and swaps the label for a spinner, so the
 * layout doesn't jump on submit. It also implies disabled: a double-submit on a
 * money form creates a duplicate transaction.
 */

import { ActivityIndicator, Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import {
  a11y,
  brand,
  brandRole,
  focus,
  opacity,
  pressScale,
  radius,
  space,
} from '@/theme/tokens';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Stretch to the container width. */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const HEIGHT: Record<ButtonSize, number> = {
  md: 48, // D§22
  sm: 40,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  block = false,
  style,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const palette = (() => {
    switch (variant) {
      case 'primary':
        return {
          bg: brandRole.action, // #7C3AED — 5.70:1 with white (A3)
          // Hover and press both go DARKER, never lighter. brand[500] would be
          // the intuitive "lighter on hover", but it measures 4.22:1 against
          // white and fails AA — the exact trap A3 documents. Verified by the
          // kitchen-sink contrast audit, which caught it at 4.23:1.
          bgHover: brandRole.pressed, // #6D28D9 — 6.63:1
          bgPressed: brand[800], // #5B21B6 — 8.59:1
          border: 'transparent',
          tone: 'onBrand' as const,
        };
      case 'danger':
        // Fixed in BOTH themes, deliberately. A solid button always carries
        // white text, so its background needs a dark value regardless of theme.
        // Using semanticText('danger') here put white on #F87171 in dark mode —
        // 2.77:1, caught by the kitchen-sink audit. That token is a TEXT value
        // for dark surfaces; as a fill it fails, which is A2 in reverse.
        return {
          bg: '#B91C1C', // 6.49:1 with white
          bgHover: '#991B1B', // 8.31:1
          bgPressed: '#7F1D1D', // 9.9:1
          border: 'transparent',
          tone: 'onBrand' as const,
        };
      case 'secondary':
        return {
          bg: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.45)',
          bgPressed: theme.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.65)',
          bgHover: theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.60)',
          border: theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.60)',
          tone: 'brand' as const,
        };
      case 'ghost':
      default:
        return {
          bg: 'transparent',
          bgPressed: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
          bgHover: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          border: 'transparent',
          tone: 'brand' as const,
        };
    }
  })();

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      // D§44 requires a 44px minimum target. `sm` is 40px by design, so the
      // touch area is extended past the visual bounds rather than inflating
      // the button — the visual scale and the a11y floor are different things.
      hitSlop={size === 'sm' ? { top: 2, bottom: 2, left: 0, right: 0 } : undefined}
      style={({ pressed, hovered, focused }: any) => [
        {
          height: HEIGHT[size],
          // A15: never below the 44px target, whatever the visual height.
          minWidth: a11y.minTouchTarget,
          alignSelf: block ? 'stretch' : 'flex-start',
          paddingHorizontal: space[4],
          borderRadius: radius.md, // 12px — D§18
          borderWidth: palette.border === 'transparent' ? 0 : 1,
          borderColor: palette.border,
          backgroundColor: pressed
            ? palette.bgPressed
            : hovered && Platform.OS === 'web'
              ? palette.bgHover
              : palette.bg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: space[2],
          opacity: isDisabled ? opacity.disabled : 1,
          /**
           * Spread the key in, never set it to undefined.
           *
           * React Native registers `processTransform` as a style processor for
           * the `transform` key, and it runs whenever the key is PRESENT —
           * `undefined` flattens to `null` on Fabric and the processor calls
           * `.forEach` on it, crashing the render. `react-native-web` has no
           * such processor, so this was invisible on web and broke every
           * button press on Android.
           */
          ...(pressed ? { transform: [{ scale: pressScale.button }] } : null),
        },
        // A15: focus ring on every interactive element, not just inputs.
        focused && {
          outlineWidth: focus.width,
          outlineColor: focus.color,
          outlineStyle: 'solid',
          outlineOffset: focus.offset,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={palette.tone === 'onBrand' ? '#FFFFFF' : theme.color.brand}
        />
      ) : (
        <Text variant="body" weight="600" tone={palette.tone}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Floating Action Button (D§23) — the Quick Add entry point (P§9).
 */
export function Fab({
  onPress,
  accessibilityLabel = 'Add',
  children,
  style,
}: {
  onPress?: () => void;
  accessibilityLabel?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed, focused }: any) => [
        {
          width: 56,
          height: 56,
          borderRadius: radius.full,
          backgroundColor: pressed ? brandRole.pressed : brandRole.action,
          alignItems: 'center',
          justifyContent: 'center',
          /**
           * Spread the key in, never set it to undefined.
           *
           * React Native registers `processTransform` as a style processor for
           * the `transform` key, and it runs whenever the key is PRESENT —
           * `undefined` flattens to `null` on Fabric and the processor calls
           * `.forEach` on it, crashing the render. `react-native-web` has no
           * such processor, so this was invisible on web and broke every
           * button press on Android.
           */
          ...(pressed ? { transform: [{ scale: pressScale.button }] } : null),
        },
        Platform.OS === 'android'
          ? { elevation: theme.shadow.fab.elevation }
          : { boxShadow: theme.shadow.fab.boxShadow },
        focused && {
          outlineWidth: focus.width,
          outlineColor: focus.color,
          outlineStyle: 'solid',
          outlineOffset: focus.offset,
        },
        style,
      ]}
    >
      <View>{children}</View>
    </Pressable>
  );
}
