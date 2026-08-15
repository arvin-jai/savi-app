/**
 * A glass list row: icon · label · optional count · chevron
 * (design handoff 2e).
 *
 * The More screen was a stack of cards with a title and a description line
 * each. Rows with a leading icon and a trailing chevron read as *navigation*
 * rather than as content, which is what that screen actually is.
 *
 * The count badge exists for Tasks — a number you want to see before deciding
 * whether to tap. Its text stays in the accessibility tree so the count is
 * never a sighted-only signal.
 */

import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import { View } from 'react-native';

import { GlassCard } from '@/components/glass/GlassCard';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { a11y, brand, iconSize, radius, space } from '@/theme/tokens';

export function ListRow({
  icon: Icon,
  label,
  hint,
  count,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  /** Optional second line. Omit it where the label speaks for itself. */
  hint?: string;
  count?: number;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <GlassCard
      variant="subtle"
      padding="md"
      interactive
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        minHeight: a11y.minTouchTarget,
      }}
    >
      {/* Tinted tile rather than a bare icon: it gives the row a consistent
          left edge whatever the glyph's own width is. */}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.isDark ? 'rgba(167,139,250,0.14)' : 'rgba(124,58,237,0.08)',
        }}
      >
        <Icon size={iconSize.sm} color={theme.color.brand} strokeWidth={2} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="body" weight="500" numberOfLines={1}>
          {label}
        </Text>
        {hint && (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {hint}
          </Text>
        )}
      </View>

      {/* NOT hidden from screen readers: the row has no accessibilityLabel of
          its own, so assistive tech reads its child text. Hiding the badge
          would make the count a sighted-only signal. */}
      {count != null && count > 0 && (
        <View
          style={{
            minWidth: 22,
            paddingHorizontal: space[2],
            paddingVertical: 2,
            borderRadius: radius.full,
            alignItems: 'center',
            backgroundColor: theme.isDark ? 'rgba(167,139,250,0.2)' : 'rgba(124,58,237,0.12)',
          }}
        >
          <Text variant="micro" weight="600" tone="brand">
            {count}
          </Text>
        </View>
      )}

      <ChevronRight size={iconSize.sm} color={theme.color.textSecondary} strokeWidth={2} />
    </GlassCard>
  );
}
