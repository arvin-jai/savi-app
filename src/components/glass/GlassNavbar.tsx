/**
 * Floating glass bottom navigation (D§27, A13).
 *
 * Five tabs: Home · Calendar · Money · Savi · More. This is one of the four
 * surfaces A6 permits blur on — bounded, non-scrolling, exactly one on screen.
 * Per the M0 findings, blur still only actually engages where it is cheap
 * (web/iOS); Android renders the solid fallback, which is the baseline, not a
 * degraded state.
 *
 * **Icon-only, per A17** — a deliberate deviation from D§44's "icon PLUS label".
 * The label is gone from the screen but not from the accessibility tree, and
 * the active state is carried by three things at once (colour, stroke weight,
 * and a pill) so it never rests on colour alone. Read A17 before changing this;
 * the trade is recorded there rather than being an oversight here.
 */

import { BlurView } from 'expo-blur';
import type { LucideIcon } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ANDROID_BLUR, BLUR_IS_CHEAP, surfaceColor } from '@/components/glass/GlassCard';
import { useTheme } from '@/theme/ThemeProvider';
import { a11y, focus, iconSize, layout, radius, space, z } from '@/theme/tokens';

export type NavTab = {
  name: string;
  label: string;
  icon: LucideIcon;
};

/**
 * Loosely typed on purpose: the exact BottomTabBarProps type lives in
 * @react-navigation/bottom-tabs, which is a transitive dependency of
 * expo-router — importing its types directly would couple us to a package we
 * don't declare. The three fields used here are stable across versions.
 */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    navigate: (name: string) => void;
    emit: (e: { type: string; target?: string; canPreventDefault?: boolean }) => {
      defaultPrevented: boolean;
    };
  };
};

export function GlassNavbar({ tabs, state, navigation }: TabBarProps & { tabs: NavTab[] }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // A18: Android is translucent either way (see surfaceColor); this is only
  // about whether the expensive real blur runs behind it.
  const blurred = BLUR_IS_CHEAP || (Platform.OS === 'android' && ANDROID_BLUR);

  /**
   * `subtle` either way (A24).
   *
   * A18 briefly stepped the *unblurred* nav up to `elevated` (75%), because a
   * translucent-but-unblurred bar floating over scrolling content let a list
   * scroll visibly through the tab icons — `subtle` is only 40–45% alpha and
   * blur is normally what absorbs that. A24 reverted the translucency itself,
   * so an unblurred nav is now opaque and there is nothing to see through.
   * The step-up solved a problem that no longer exists, and keeping it would
   * only make the bar a shade lighter than the level it is specified at.
   */
  const level = theme.glass.subtle;

  return (
    <View
      style={{
        position: 'absolute',
        left: space[4],
        right: space[4],
        bottom: Math.max(insets.bottom, space[3]),
        zIndex: z.bottomNav,
        height: layout.navHeight,
        borderRadius: radius['2xl'],
        borderWidth: 1,
        borderColor: level.border,
        backgroundColor: surfaceColor(level, blurred),
        overflow: 'hidden',
        flexDirection: 'row',
        /**
         * **No drop shadow.** The bar carried `shadow.md` — `elevation` on
         * Android, `boxShadow` elsewhere — and on a device it read as a dark
         * smear under a floating slab rather than as lift. Android's
         * `elevation` is the worse half: it is untinted and drawn natively, so
         * it cannot be softened to match the tinted shadow the other platforms
         * get, and against the dark theme it mostly just muddied the edge.
         *
         * The bar does not need one. It already separates from the page with a
         * 1px border and its own surface colour, and it is the only floating
         * element at its position — there is nothing for a shadow to
         * disambiguate it from.
         */
      }}
    >
      {blurred && (
        <BlurView
          intensity={level.blur}
          tint={theme.isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
          experimentalBlurMethod={
            Platform.OS === 'android' ? 'dimezisBlurView' : undefined
          }
        />
      )}

      {state.routes.map((route, index) => {
        const tab = tabs.find((t) => t.name === route.name);
        if (!tab) return null;

        const active = state.index === index;
        const Icon = tab.icon;
        const color = active ? theme.color.brand : theme.color.textSecondary;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!active && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            // `aria-selected` explicitly as well as `accessibilityState`:
            // measured on web, the state prop alone produced NO aria-selected
            // attribute, which would have made "which tab am I on" invisible to
            // assistive tech — the one thing A17 leans on now the label is gone.
            // The state prop is what native reads; this is what the DOM reads.
            aria-selected={active}
            accessibilityLabel={tab.label}
            style={({ focused }: any) => [
              {
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                // Taller now that the label is gone: the row still has to give
                // every tab a 44px target (D§44), and the icon alone does not.
                minHeight: a11y.minTouchTarget,
                borderRadius: radius.full,
                // A shape cue for the active tab, so "which one am I on" does
                // not rest on icon colour alone — the thing the label used to
                // help with (A17).
                backgroundColor: active
                  ? theme.isDark
                    ? 'rgba(167,139,250,0.16)'
                    : 'rgba(124,58,237,0.10)'
                  : 'transparent',
              },
              focused && {
                outlineWidth: focus.width,
                outlineColor: focus.color,
                outlineStyle: 'solid',
                outlineOffset: -focus.width,
              },
            ]}
          >
            {/*
              Icon-only — A17, a deliberate deviation from D§44's "icon PLUS
              label". See DESIGN-SYSTEM A17 for the trade and the mitigations.

              What replaces the label:
                - `accessibilityLabel` above, so screen readers are unaffected
                - `accessibilityState.selected`, which is how assistive tech
                  announces the active tab — the label never conveyed that anyway
                - colour AND stroke weight together, so the active state does not
                  rest on colour alone (D§44's actual requirement)
                - the pill behind the active icon, a non-colour cue
            */}
            <Icon size={iconSize.lg} color={color} strokeWidth={active ? 2.4 : 2} />
          </Pressable>
        );
      })}
    </View>
  );
}
