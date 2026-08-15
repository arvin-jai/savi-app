/**
 * Savi Insight card (D§31) — the signature component, wearing the Savi Glow
 * (D§65): a soft purple ambient shadow plus a faint brand tint over the glass.
 *
 * The glow is a tinted boxShadow, which M0 confirmed renders on Android under
 * RN 0.86's New Architecture. Opacity stays inside D§65's 8–15% band — the
 * glow marks "Savi is speaking", it does not shout.
 *
 * The card renders ONE insight (D§30). If there is nothing worth saying, the
 * card does not render at all — an empty slot beats a hollow one.
 */

import { router } from 'expo-router';
import { View } from 'react-native';

import { GlassCard } from '@/components/glass/GlassCard';
import { Text } from '@/components/ui/Text';
import type { Insight } from '@/features/insights/rules';
import { useTheme } from '@/theme/ThemeProvider';
import { ambient, brand, saviGlow, space } from '@/theme/tokens';

export function InsightCard({ insight }: { insight: Insight | null }) {
  const theme = useTheme();

  if (!insight) return null;

  return (
    <GlassCard
      padding="lg"
      interactive={!!insight.action}
      onPress={insight.action ? () => router.push(insight.action!.href) : undefined}
      // Through `glow`, not `style` — a boxShadow passed via `style` would stack
      // on top of the card's own shadow instead of replacing it.
      //
      // Attention keeps the brand glow: the TEXT carries the urgency (D§44),
      // and turning the whole card red would be the alarm D§63 forbids.
      glow={insight.tone === 'attention' ? saviGlow.shadowAttention : saviGlow.shadow}
      style={{
        gap: space[2],
        // D§31's brand tint, pre-composited over the glass fallback.
        backgroundColor: theme.isDark ? saviGlow.surfaceDark : saviGlow.surfaceLight,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        {/* D§65's ✦ mark, drawn as a dot pair so no icon font is needed. */}
        <View style={{ flexDirection: 'row', gap: 3 }}>
          <View
            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: brand[400] }}
          />
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
          Savi Insight
        </Text>
      </View>

      <Text
        variant="bodyLg"
        weight="500"
        tone={insight.tone === 'attention' ? 'danger' : 'primary'}
      >
        {insight.headline}
      </Text>

      {insight.detail && (
        <Text variant="bodySm" tone="secondary">
          {insight.detail}
        </Text>
      )}

      {insight.action && (
        <Text variant="label" weight="600" tone="brand">
          {insight.action.label} →
        </Text>
      )}
    </GlassCard>
  );
}
