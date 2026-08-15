/**
 * Progress bar (D§39).
 *
 * D§44: never colour alone. The bar is decoration on top of a label the caller
 * supplies — a screen reader user and a colourblind user get the same
 * information as everyone else, from the text.
 */

import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { brand, radius, semantic } from '@/theme/tokens';

export type ProgressTone = 'brand' | 'income' | 'bill' | 'danger';

export function ProgressBar({
  /** 0–1. Values outside are clamped rather than overflowing the track. */
  ratio,
  tone = 'brand',
  /** Announced to screen readers, e.g. "36% of ₱50,000 saved". */
  accessibilityLabel,
  style,
}: {
  ratio: number;
  tone?: ProgressTone;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  // NaN would silently produce a zero-width bar with no error; clamp it to a
  // real number so a bad input renders empty rather than mysteriously.
  const safe = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;

  const fill =
    tone === 'brand' ? brand[500] : semantic[tone].fill;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(safe * 100) }}
      style={[
        {
          height: 8, // D§39
          borderRadius: radius.full,
          // D§39's track is brand at 12%; over the glass fallback that is what
          // the contrast numbers were measured against.
          backgroundColor: theme.isDark ? 'rgba(167,139,250,0.18)' : 'rgba(139,92,246,0.12)',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View
        style={{
          width: `${safe * 100}%`,
          height: '100%',
          borderRadius: radius.full,
          backgroundColor: fill,
        }}
      />
    </View>
  );
}
