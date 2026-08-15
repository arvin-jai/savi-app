/**
 * Page shell — the responsive frame every screen sits in (D§17, D§45).
 *
 * Centralises three rules that were otherwise repeated (and drifting) per
 * screen: breakpoint padding, the 1200px max content width, and the bottom
 * inset that clears the floating nav on mobile but not on desktop.
 */

import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/AmbientBackground';
import { layout, space } from '@/theme/tokens';
import { useBreakpoint, useScrollBottomInset } from '@/theme/useBreakpoint';

export function PageShell({
  children,
  scroll = true,
  contentStyle,
  header,
}: {
  children: ReactNode;
  /** Set false when the screen owns its own scrolling (e.g. a FlashList). */
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Fixed content above the page's scroll area. */
  header?: ReactNode;
}) {
  const { pagePadding } = useBreakpoint();
  const bottomInset = useScrollBottomInset();

  const inner: StyleProp<ViewStyle> = [
    {
      padding: pagePadding,
      paddingTop: header ? 0 : pagePadding,
      paddingBottom: bottomInset,
      gap: space[4],
      width: '100%',
      // D§17: content stops at 1200px and centres. Without this, a dashboard
      // on a 2560px monitor stretches a single card across a metre of glass.
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
    },
    contentStyle,
  ];

  return (
    <View style={{ flex: 1 }}>
      <AmbientBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {header && (
          <View
            style={{
              width: '100%',
              maxWidth: layout.maxContentWidth,
              alignSelf: 'center',
              paddingHorizontal: pagePadding,
              paddingTop: pagePadding,
              paddingBottom: space[4],
            }}
          >
            {header}
          </View>
        )}
        {scroll ? (
          <ScrollView contentContainerStyle={inner}>{children}</ScrollView>
        ) : (
          <View style={[{ flex: 1 }, inner]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}
