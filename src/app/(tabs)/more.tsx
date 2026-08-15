/**
 * More tab (A13) — where Tasks will live (v0.2), plus settings-adjacent
 * things and the dev surfaces.
 */

import { router } from 'expo-router';
import {
  ChevronRight,
  CheckSquare,
  CreditCard,
  PieChart,
  Receipt,
  Settings as SettingsIcon,
  Target,
} from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/AmbientBackground';
import { GlassCard } from '@/components/glass/GlassCard';
import { Button } from '@/components/ui/Button';
import { ListRow } from '@/components/ui/ListRow';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTasks } from '@/features/calendar/api';
import { useProfile } from '@/features/insights/api';
import { useTheme } from '@/theme/ThemeProvider';
import { brandRole, iconSize, layout, radius, space } from '@/theme/tokens';
import { useBreakpoint, useScrollBottomInset } from '@/theme/useBreakpoint';

export default function More() {
  const { pagePadding } = useBreakpoint();
  const bottomInset = useScrollBottomInset();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: tasks = [] } = useTasks();
  const theme = useTheme();

  const openTasks = tasks.filter((t) => t.status !== 'done').length;

  const rows = [
    { title: 'Accounts', body: 'Where your money lives', icon: CreditCard, onPress: () => router.push('/accounts') },
    { title: 'Bills', body: 'Recurring payments', icon: Receipt, onPress: () => router.push('/bills') },
    { title: 'Budget', body: 'Your plan for the month', icon: PieChart, onPress: () => router.push('/budget') },
    { title: 'Goals', body: 'What you are saving towards', icon: Target, onPress: () => router.push('/goals') },
    { title: 'Tasks', body: 'What you need to do', icon: CheckSquare, count: openTasks, onPress: () => router.push('/tasks') },
    { title: 'Settings', body: 'Profile, appearance, data', icon: SettingsIcon, onPress: () => router.push('/settings') },
  ] as { title: string; body: string; icon: typeof CreditCard; count?: number; onPress: () => void }[];

  return (
    <View style={{ flex: 1 }}>
      <AmbientBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
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
          <Text variant="h1">More</Text>
        </View>
        <ScrollView
          contentContainerStyle={{
            padding: pagePadding,
            paddingTop: 0,
            gap: space[4],
            paddingBottom: bottomInset,
            width: '100%',
            maxWidth: layout.maxContentWidth,
            alignSelf: 'center',
          }}
        >
          {/* Profile row (handoff 2e) — avatar, name, email, chevron. */}
          <GlassCard
            padding="lg"
            interactive
            onPress={() => router.push('/settings')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.full,
                backgroundColor: brandRole.action,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="h4" tone="onBrand">
                {(profile?.display_name?.trim() || user?.email || '?').charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="h4" numberOfLines={1}>
                {profile?.display_name ?? 'Your account'}
              </Text>
              <Text variant="bodySm" tone="secondary" numberOfLines={1}>
                {user?.email}
              </Text>
            </View>

            <ChevronRight size={iconSize.sm} color={theme.color.textSecondary} strokeWidth={2} />
          </GlassCard>

          <View style={{ gap: space[2] }}>
            {rows.map((row) => (
              <ListRow
                key={row.title}
                icon={row.icon}
                label={row.title}
                hint={row.body}
                count={row.count}
                onPress={row.onPress}
              />
            ))}
          </View>

          <View style={{ gap: space[2] }}>
            <Text variant="label" tone="secondary">
              Developer
            </Text>
            <GlassCard
              variant="subtle"
              padding="md"
              interactive
              onPress={() => router.push('/dev/kitchen-sink')}
            >
              <Text variant="body" weight="500">
                Kitchen sink
              </Text>
              <Text variant="caption" tone="secondary">
                Every primitive, every state, both themes
              </Text>
            </GlassCard>
            <GlassCard
              variant="subtle"
              padding="md"
              interactive
              onPress={() => router.push('/dev/glass-spike')}
            >
              <Text variant="body" weight="500">
                Glass spike
              </Text>
              <Text variant="caption" tone="secondary">
                M0 blur + shadow feasibility harness
              </Text>
            </GlassCard>
          </View>

          <Button label="Sign out" variant="ghost" block onPress={signOut} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
