/**
 * Screen header with a back affordance (D§27, D§44).
 *
 * The five tab screens always carry navigation chrome — the floating navbar on
 * mobile, the sidebar past 1024px. Every other screen sits OUTSIDE the tab
 * group and so renders neither. Without a back control those screens are a dead
 * end anywhere the platform does not supply one: web has no system back inside
 * the app frame, and Android's gesture-back is invisible affordance-wise.
 *
 * Back goes to the previous history entry when there is one, and to HOME when
 * there is not. That second case is not hypothetical — a bill reminder deep
 * links straight to /bills on a cold start, where the stack is one screen deep
 * and `router.back()` would no-op silently.
 *
 * `canGoBack()` is read inside the handler rather than at render: it is not
 * reactive, and a header that mounted before a push would otherwise cache a
 * stale answer.
 */

import { router, type Href } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { HOME } from '@/lib/routes';
import { useTheme } from '@/theme/ThemeProvider';
import { a11y, focus, iconSize, pressScale, radius, space } from '@/theme/tokens';

export function ScreenHeader({
  title,
  fallbackHref = HOME,
  right,
}: {
  title: string;
  /** Where back goes when there is no history to pop — see the module comment. */
  fallbackHref?: Href;
  /** Optional trailing control, e.g. an add button. */
  right?: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace(fallbackHref))}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        // The arrow is an icon with no label, so D§44's 44px floor is the whole
        // target — it cannot be inherited from surrounding text.
        style={({ pressed, hovered, focused }: any) => [
          {
            width: a11y.minTouchTarget,
            height: a11y.minTouchTarget,
            // Cancel the padding the 44px target adds around a 24px glyph, so
            // the arrow lines up with the page's left edge and the title stays
            // where it sat before. Derived, not a magic -10.
            marginLeft: -(a11y.minTouchTarget - iconSize.lg) / 2,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.full,
            backgroundColor: pressed
              ? theme.isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.05)'
              : hovered && Platform.OS === 'web'
                ? theme.isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.03)'
                : 'transparent',
            /**
             * Spread the key in, never set it to undefined — `transform: undefined`
             * flattens to `null` on Fabric and crashes RN's style processor.
             * See the same guard in Button.
             */
            ...(pressed ? { transform: [{ scale: pressScale.button }] } : null),
          },
          // A15: focus ring on every interactive element.
          focused && {
            outlineWidth: focus.width,
            outlineColor: focus.color,
            outlineStyle: 'solid',
            outlineOffset: focus.offset,
          },
        ]}
      >
        <ArrowLeft size={iconSize.lg} color={theme.color.textPrimary} />
      </Pressable>

      <Text variant="h1" style={{ flex: 1 }}>
        {title}
      </Text>

      {right}
    </View>
  );
}
