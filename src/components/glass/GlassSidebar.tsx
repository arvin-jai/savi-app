/**
 * Desktop glass sidebar (D§28, P§27).
 *
 * 240px, standard glass, 24px radius. Replaces the bottom nav at desktop
 * widths — a floating pill nav on a 1440px screen would strand the controls in
 * the middle of nothing.
 *
 * IA matches the mobile tabs exactly (A13, P9): the same five destinations in
 * the same order, so moving between phone and laptop doesn't relearn anything.
 * Secondary destinations that live under More on mobile are listed directly
 * here, because a desktop sidebar has the room and hiding them behind a menu
 * would be worse.
 */

import { BlurView } from 'expo-blur';
import { router, usePathname } from 'expo-router';
import {
  Calendar,
  CreditCard,
  House,
  Menu,
  PieChart,
  Receipt,
  Settings,
  Sparkles,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { BLUR_IS_CHEAP, surfaceColor } from '@/components/glass/GlassCard';
import { Text } from '@/components/ui/Text';
import { HOME } from '@/lib/routes';
import { useTheme } from '@/theme/ThemeProvider';
import { focus, iconSize, radius, space } from '@/theme/tokens';
import type { Href } from 'expo-router';

type Item = { label: string; href: Href; icon: LucideIcon; match: (p: string) => boolean };

const PRIMARY: Item[] = [
  { label: 'Dashboard', href: HOME, icon: House, match: (p) => p === '/' || p === '' },
  { label: 'Calendar', href: '/calendar', icon: Calendar, match: (p) => p.startsWith('/calendar') },
  { label: 'Money', href: '/money', icon: Wallet, match: (p) => p.startsWith('/money') },
  { label: 'Ask Savi', href: '/savi', icon: Sparkles, match: (p) => p.startsWith('/savi') },
];

const SECONDARY: Item[] = [
  { label: 'Accounts', href: '/accounts', icon: CreditCard, match: (p) => p.startsWith('/accounts') },
  { label: 'Bills', href: '/bills', icon: Receipt, match: (p) => p.startsWith('/bills') },
  // P§27 / A13: Budget and Goals sit under Money, on both platforms.
  { label: 'Budget', href: '/budget', icon: PieChart, match: (p) => p.startsWith('/budget') },
  { label: 'Goals', href: '/goals', icon: Target, match: (p) => p.startsWith('/goals') },
  { label: 'More', href: '/more', icon: Menu, match: (p) => p.startsWith('/more') },
  { label: 'Settings', href: '/settings', icon: Settings, match: (p) => p.startsWith('/settings') },
];

export function GlassSidebar() {
  const theme = useTheme();
  const pathname = usePathname();

  return (
    <View
      style={{
        width: 240,
        margin: space[4],
        borderRadius: radius['2xl'],
        borderWidth: 1,
        borderColor: theme.glass.default.border,
        // Through the same helper as every other glass surface, so there is one
        // answer to "what colour is a glass surface" rather than four.
        backgroundColor: surfaceColor(theme.glass.default, BLUR_IS_CHEAP),
        overflow: 'hidden',
        padding: space[4],
        gap: space[5],
        // No drop shadow — the same call as GlassNavbar, kept identical so the
        // two navigation surfaces do not drift apart. See the note there.
      }}
    >
      {BLUR_IS_CHEAP && (
        <BlurView
          intensity={theme.glass.default.blur}
          tint={theme.isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      )}

      <Text variant="h3" tone="brand">
        SAVI
      </Text>

      <View style={{ gap: space[1] }}>
        {PRIMARY.map((item) => (
          <SidebarLink key={item.label} item={item} active={item.match(pathname)} />
        ))}
      </View>

      <View style={{ gap: space[1] }}>
        <Text variant="micro" tone="secondary" style={{ paddingHorizontal: space[3] }}>
          MANAGE
        </Text>
        {SECONDARY.map((item) => (
          <SidebarLink key={item.label} item={item} active={item.match(pathname)} />
        ))}
      </View>
    </View>
  );
}

function SidebarLink({ item, active }: { item: Item; active: boolean }) {
  const theme = useTheme();
  const Icon = item.icon;
  const color = active ? theme.color.brand : theme.color.textSecondary;

  return (
    <Pressable
      onPress={() => router.push(item.href)}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      accessibilityLabel={item.label}
      style={({ hovered, focused }: any) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          // 44px target even though the visual row is shorter (D§44).
          minHeight: 44,
          paddingHorizontal: space[3],
          borderRadius: radius.md,
          backgroundColor: active
            ? theme.isDark
              ? 'rgba(139,92,246,0.16)'
              : 'rgba(139,92,246,0.10)'
            : hovered
              ? theme.isDark
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,0,0,0.04)'
              : 'transparent',
        },
        focused && {
          outlineWidth: focus.width,
          outlineColor: focus.color,
          outlineStyle: 'solid',
          outlineOffset: focus.offset,
        },
      ]}
    >
      <Icon size={iconSize.md} color={color} strokeWidth={active ? 2.4 : 2} />
      <Text variant="body" weight={active ? '600' : '500'} style={{ color }}>
        {item.label}
      </Text>
    </Pressable>
  );
}
