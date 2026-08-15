/**
 * Dashboard — Home (D§25, D§26, D§71).
 *
 * The hierarchy is strict and load-bearing:
 *   1  Available Money (with the A1 caption)
 *   2  Upcoming obligations — the ₱X the caption refers to, as a swipeable row
 *   3  Today's schedule — ABSENT until the calendar exists (v0.2). The slot is
 *      genuinely omitted, not stubbed: an empty "Schedule" card would be a
 *      promise the app can't keep yet.
 *   4  Savi Insight
 *
 * "Do not put charts above the most important information."
 */

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BillsThisWeek } from '@/components/domain/BillsThisWeek';
import { InsightCard } from '@/components/domain/InsightCard';
import { SplitBar } from '@/components/domain/SplitBar';
import { GlassCard } from '@/components/glass/GlassCard';
import { PageShell } from '@/components/PageShell';
import { Fab } from '@/components/ui/Button';
import { Skeleton, Toast } from '@/components/ui/feedback';
import { Sparkline } from '@/components/ui/Sparkline';
import { Text } from '@/components/ui/Text';
import { useAccounts } from '@/features/accounts/api';
import { useBills } from '@/features/bills/api';
import { STATUS_META } from '@/features/bills/schedule';
import { useTodayTimeline } from '@/features/calendar/api';
import { useGenerateRecurring, useInsight, useProfile } from '@/features/insights/api';
import { useBalanceTrend, useFinancialSummary } from '@/features/transactions/api';
import { QuickAdd } from '@/features/transactions/QuickAdd';
import { trendChangePercent } from '@/features/transactions/trend';
import { dueLabel } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { brand, brandRole, layout, radius, saviGlow, space, z } from '@/theme/tokens';
import { useBreakpoint } from '@/theme/useBreakpoint';

function greeting(hour = new Date().getHours()): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** "Friday, August 15" — the handoff's line under the greeting. */
function longDateLabel(date = new Date()): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Initial-only avatar (handoff 2a).
 *
 * Decorative: it repeats the name already in the greeting beside it, so it is
 * hidden from screen readers rather than announcing "A" a second time.
 */
function Avatar({ name }: { name: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 36,
        height: 36,
        borderRadius: radius.full,
        backgroundColor: brandRole.action,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="bodySm" weight="700" tone="onBrand">
        {name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

export default function Dashboard() {
  const { data: profile } = useProfile();
  const { data: summary, isLoading: summaryLoading } = useFinancialSummary();
  const {
    data: accounts,
    isLoading: accountsLoading,
    isFetching: accountsFetching,
  } = useAccounts();
  const { data: bills = [] } = useBills();
  const { insight } = useInsight();
  // Materialise any payday that has come due (idempotent, see the hook).
  useGenerateRecurring();
  const { entries: todayEntries } = useTodayTimeline();
  const { data: trend = [] } = useBalanceTrend();
  const { pagePadding, useSidebar } = useBreakpoint();
  const theme = useTheme();

  // null when there is nothing honest to say — too few points, or a baseline of
  // zero or less, where a percentage is arithmetic rather than information.
  const changePercent = trendChangePercent(trend);

  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const upcomingBills = bills.filter((b) => b.status !== 'paid').slice(0, 3);

  /**
   * A brand-new user has nothing to dashboard. Send them through P§34's
   * onboarding instead of showing a page of zeros — but only once accounts
   * have actually LOADED as empty, never while they're still in flight.
   *
   * `isLoading` alone is not "in flight". It is false whenever the cache holds
   * *any* data, including the stale `[]` from before onboarding created an
   * account. So finishing onboarding used to land on the dashboard, read that
   * stale empty array while the invalidated refetch was still running, and
   * bounce the user straight back into onboarding a second time — which is
   * exactly what skipping the income and bills steps made easy to hit, because
   * skipping gets you back here faster than the refetch resolves.
   *
   * `isFetching` covers the refetch case that `isLoading` does not.
   */
  useEffect(() => {
    if (accountsLoading || accountsFetching) return;
    if (accounts && accounts.length === 0) {
      router.replace('/onboarding');
    }
  }, [accountsLoading, accountsFetching, accounts]);

  const name = profile?.display_name?.trim();

  return (
    <View style={{ flex: 1 }}>
      <PageShell
        header={
          /* Greeting + date (D§25, handoff 2a) */
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text variant="h2">
                {greeting()}
                {name ? `, ${name}` : ''} 👋
              </Text>
              <Text variant="caption" tone="secondary">
                {longDateLabel()}
              </Text>
            </View>

            {name && <Avatar name={name} />}
          </View>
        }
      >

          {/* ── Level 1 — Available Money, the hero ───────────────────────
              Bigger than before and carrying its own trend line. D§26 puts the
              largest number on the screen here, and the sparkline gives it a
              direction without adding a second figure to read. */}
          <GlassCard
            variant="elevated"
            padding="lg"
            radius="2xl"
            glow={saviGlow.shadow}
            style={{ gap: space[1], overflow: 'hidden' }}
          >
            <Text variant="label" tone="brand">
              Available money
            </Text>

            {summaryLoading ? (
              <Skeleton width="55%" height={48} />
            ) : (
              <Text variant="displayLg" style={{ letterSpacing: -1.5 }}>
                {summary ? formatMoney(summary.available_money_minor) : '—'}
              </Text>
            )}

            {/* A1: the caption is what stops users subtracting bills twice.
                The trend clause joins it rather than becoming a second line. */}
            {summary && (summary.upcoming_bills_minor > 0 || changePercent !== null) && (
              <Text variant="caption" tone="secondary">
                {summary.upcoming_bills_minor > 0
                  ? `after ${formatMoney(summary.upcoming_bills_minor)} in upcoming bills`
                  : ''}
                {summary.upcoming_bills_minor > 0 && changePercent !== null ? ' · ' : ''}
                {changePercent !== null && (
                  <Text
                    variant="caption"
                    tone={changePercent >= 0 ? 'income' : 'expense'}
                  >
                    {changePercent >= 0 ? '+' : ''}
                    {changePercent}% vs last week
                  </Text>
                )}
              </Text>
            )}

            {summary && summary.available_money_minor < 0 && (
              <Text variant="caption" tone="danger">
                Your upcoming bills are more than your current balance.
              </Text>
            )}

            {/* Bleeds to the card edges — the handoff's `padding: 24 22 0`. */}
            <View style={{ marginHorizontal: -space[5], marginBottom: -space[5], marginTop: space[2] }}>
              <Sparkline
                points={trend}
                accessibilityLabel={
                  changePercent === null
                    ? 'Balance over the last two weeks'
                    : `Balance over the last two weeks, ${changePercent >= 0 ? 'up' : 'down'} ${Math.abs(changePercent)} percent versus last week`
                }
              />
            </View>
          </GlassCard>

          {/* ── Level 5 moved up as a proportion, not a headline ─────────
              One bar instead of two cards: the relationship is the point, and
              two separate numbers make you compute it yourself. */}
          {summary && (
            <GlassCard variant="subtle" padding="md">
              <SplitBar
                incomeMinor={summary.total_income_minor}
                expensesMinor={summary.total_expenses_minor}
              />
            </GlassCard>
          )}

          {/* ── Level 2 — Upcoming obligations ────────────────────────── */}
          {upcomingBills.length > 0 && (
            <View style={{ gap: space[2] }}>
              <Text variant="label" tone="secondary">
                Bills this week
              </Text>
              <BillsThisWeek bills={upcomingBills} onPress={() => router.push('/bills')} />
            </View>
          )}

          {/* ── Level 3 — Today's schedule ────────────────────────────
              Activated in v0.2. Held genuinely absent until the calendar
              existed rather than stubbed with an empty card. */}
          {todayEntries.length > 0 && (
            <View style={{ gap: space[2] }}>
              <Text variant="label" tone="secondary">
                Today
              </Text>
              {todayEntries.slice(0, 4).map((entry) => (
                <GlassCard
                  key={entry.id}
                  variant="subtle"
                  padding="md"
                  interactive
                  onPress={() => router.push('/calendar')}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor:
                        entry.tone === 'brand'
                          ? brand[400]
                          : entry.tone === 'secondary'
                            ? theme.color.textSecondary
                            : theme.semanticFill(entry.tone),
                      opacity: entry.done ? 0.4 : 1,
                    }}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      variant="body"
                      weight="500"
                      numberOfLines={1}
                      style={entry.done ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}
                    >
                      {entry.title}
                    </Text>
                    {entry.meta && (
                      <Text variant="caption" tone="secondary">
                        {entry.meta}
                      </Text>
                    )}
                  </View>
                  {entry.amountMinor != null && (
                    <Text
                      variant="body"
                      weight="600"
                      tone={entry.kind === 'income' ? 'income' : 'primary'}
                    >
                      {formatMoney(entry.amountMinor, {
                        signDisplay: entry.kind === 'income' ? 'always' : 'never',
                      })}
                    </Text>
                  )}
                </GlassCard>
              ))}
            </View>
          )}

          {/* ── Level 4 — Savi Insight ────────────────────────────────── */}
          <InsightCard insight={insight} />
      </PageShell>

      {/* D§62: the dashboard's one primary action. Clears the floating nav on
          mobile; on desktop there is no nav to clear, so it sits lower. */}
      <View
        style={{
          position: 'absolute',
          right: pagePadding,
          bottom: useSidebar ? pagePadding : layout.fabBottomOffset,
          zIndex: z.fab,
        }}
      >
        <Fab accessibilityLabel="Add" onPress={() => setAdding(true)}>
          <Text variant="h3" tone="onBrand">
            +
          </Text>
        </Fab>
      </View>

      <QuickAdd visible={adding} onClose={() => setAdding(false)} onSaved={setToast} />
      <Toast visible={!!toast} message={toast ?? ''} onDismiss={() => setToast(null)} />
    </View>
  );
}
