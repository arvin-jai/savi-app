/**
 * The five-tab shell (D§27, A13): Home · Calendar · Money · Savi · More.
 *
 * Calendar is v0.2 and Ask Savi is v0.4, but the tabs exist now because the IA
 * is settled — shipping four tabs and inserting a fifth later would reshuffle
 * every user's muscle memory. The unbuilt tabs hold calm, honest placeholders.
 */

import { Tabs } from 'expo-router';
import { Calendar, House, Menu, Sparkles, Wallet } from 'lucide-react-native';
import { View } from 'react-native';

import { GlassNavbar, type NavTab } from '@/components/glass/GlassNavbar';
import { GlassSidebar } from '@/components/glass/GlassSidebar';
import { useNotificationSync } from '@/features/notifications/api';
import { useTheme } from '@/theme/ThemeProvider';
import { useBreakpoint } from '@/theme/useBreakpoint';

const TABS: NavTab[] = [
  { name: 'index', label: 'Home', icon: House },
  { name: 'calendar', label: 'Calendar', icon: Calendar },
  { name: 'money', label: 'Money', icon: Wallet },
  { name: 'savi', label: 'Savi', icon: Sparkles },
  { name: 'more', label: 'More', icon: Menu },
];

export default function TabsLayout() {
  const theme = useTheme();
  const { useSidebar } = useBreakpoint();

  /**
   * Reminders are derived state — keep the OS's scheduled set in line with the
   * bills, tasks and preferences wherever the user changes them.
   *
   * Mounted here rather than at the app root on purpose: this layout only
   * renders for a signed-in user, so the bills/tasks queries it depends on
   * never fire against the auth screens where there is no session to read.
   */
  useNotificationSync();

  /**
   * The navigator is the same at every width — only the chrome changes. That
   * keeps one navigation state across a resize: dragging a browser window past
   * 1024px swaps the bar for the sidebar without remounting the screen or
   * losing scroll position.
   */
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {useSidebar && <GlassSidebar />}
      <View style={{ flex: 1 }}>
        <TabsNavigator theme={theme} hideTabBar={useSidebar} />
      </View>
    </View>
  );
}

function TabsNavigator({
  theme,
  hideTabBar,
}: {
  theme: ReturnType<typeof useTheme>;
  hideTabBar: boolean;
}) {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        /**
         * React Navigation paints each screen container with its own default
         * background — #f2f2f2, a light grey, regardless of theme. Our
         * AmbientBackground covers it, so it is invisible in normal use, but it
         * sits underneath in dark mode and shows through during screen
         * transitions and overscroll. Painting it with the theme colour costs
         * nothing and removes a latent light flash.
         */
        sceneStyle: { backgroundColor: theme.color.background },
      }}
      tabBar={(props) =>
        hideTabBar ? null : <GlassNavbar {...(props as any)} tabs={TABS} />
      }
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}
