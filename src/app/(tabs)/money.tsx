/**
 * Money — transactions, balances, and the Quick Add entry point.
 *
 * D§62: one obvious primary action per screen. Here it is the FAB.
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/AmbientBackground';
import { GlassCard } from '@/components/glass/GlassCard';
import { Fab } from '@/components/ui/Button';
import { Toast } from '@/components/ui/feedback';
import { Text } from '@/components/ui/Text';
import { useAccounts } from '@/features/accounts/api';
import { accountLabel } from '@/features/accounts/label';
import { useBills } from '@/features/bills/api';
import { STATUS_META } from '@/features/bills/schedule';
import { useFinancialSummary, type TransactionWithCategory } from '@/features/transactions/api';
import { dueLabel } from '@/lib/dates';
import { QuickAdd } from '@/features/transactions/QuickAdd';
import { TransactionDetail } from '@/features/transactions/TransactionDetail';
import { TransactionList } from '@/features/transactions/TransactionList';
import { formatMoney } from '@/lib/money';
import { accountRoute } from '@/lib/routes';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { layout, space, z } from '@/theme/tokens';
import { useBreakpoint } from '@/theme/useBreakpoint';

export default function Money() {
  return (
    <ThemeProvider forcedTheme="dark">
      <MoneyWorkspace />
    </ThemeProvider>
  );
}

function MoneyWorkspace() {
  const { data: summary } = useFinancialSummary();
  const { data: accounts = [] } = useAccounts();
  const { data: bills = [] } = useBills();
  const { pagePadding, useSidebar } = useBreakpoint();
  const theme = useTheme();

  const upcomingBills = bills.filter((b) => b.status !== 'paid');

  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<TransactionWithCategory | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
            paddingTop: space[2],
            paddingBottom: space[4],
          }}
        >
          <Text variant="h1">Money</Text>
          <Text variant="caption" tone="secondary">
            Your accounts, bills, and recent activity
          </Text>
        </View>
        <TransactionList
          onSelect={setSelected}
          onAdd={() => setAdding(true)}
          bottomInset={
            useSidebar ? undefined : layout.fabBottomOffset + layout.fabSize + space[4]
          }
          header={
            <View style={{ gap: space[4] }}>
              {/* Level 1 (D§26) — Available as a compact STRIP, not a hero
                  (handoff 2c). The dashboard already owns the big number; here
                  the deduction sits beside it so the row states the whole
                  arithmetic on one line. */}
              <GlassCard
                padding="lg"
                style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[3] }}
              >
                <View style={{ flex: 1, gap: space[1] }}>
                  <Text variant="label" tone="brand">
                    Available
                  </Text>
                  <Text variant="displayMd">
                    {summary ? formatMoney(summary.available_money_minor) : '—'}
                  </Text>
                </View>

                {/* Amendment A1: show the deduction so users don't subtract twice. */}
                {summary && summary.upcoming_bills_minor > 0 && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text variant="caption" tone="secondary">
                      after bills
                    </Text>
                    <Text variant="body" weight="600" tone="bill">
                      −{formatMoney(summary.upcoming_bills_minor)}
                    </Text>
                  </View>
                )}
              </GlassCard>

              {summary && summary.available_money_minor < 0 && (
                <Text variant="caption" tone="danger">
                  Your upcoming bills are more than your current balance.
                </Text>
              )}

              {/* Accounts as a horizontal row (handoff 2c) — "where is my
                  money" answered at a glance, before the transaction list. */}
              {accounts.length > 0 && (
                <View style={{ gap: space[2] }}>
                  <Text variant="label" tone="secondary">
                    Accounts
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    // The cards carry a glass edge and shadow. Let their small
                    // bleed area render instead of clipping it at the horizontal
                    // scroller's bounds, which reads as a hard backdrop cut.
                    style={{ overflow: 'visible' }}
                    contentContainerStyle={{
                      gap: space[3],
                      paddingHorizontal: space[1],
                      paddingVertical: space[1],
                      paddingRight: space[5],
                    }}
                  >
                    {accounts.map((a) => (
                      <GlassCard
                        key={a.id}
                        variant="subtle"
                        padding="md"
                        interactive
                        // Its own ledger, not the management screen: from here
                        // the question is "what happened in this account", and
                        // /accounts answers "let me rename or archive it".
                        onPress={() => router.push(accountRoute(a.id))}
                        accessibilityLabel={`${a.name}, ${formatMoney(a.balance_minor)}. View transactions.`}
                        style={{ width: 150, gap: space[1] }}
                      >
                        <Text variant="caption" tone="secondary" numberOfLines={1}>
                          {accountLabel(a, accounts)}
                        </Text>
                        <Text variant="h4" numberOfLines={1}>
                          {formatMoney(a.balance_minor)}
                        </Text>
                        {a.is_liability && (
                          <Text variant="micro" tone="danger">
                            Owed · not in Available
                          </Text>
                        )}
                      </GlassCard>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Level 2 (D§26) — the obligations that explain Level 1.
                  These sit directly under Available on purpose: the caption
                  says "after ₱X in upcoming bills", and this is the ₱X. */}
              {upcomingBills.length > 0 && (
                <View style={{ gap: space[2] }}>
                  <Text variant="label" tone="secondary">
                    Upcoming
                  </Text>
                  {upcomingBills.slice(0, 3).map((b) => (
                    <GlassCard
                      key={b.id}
                      variant="subtle"
                      padding="md"
                      interactive
                      onPress={() => router.push('/bills')}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text variant="body" weight="500">
                          {b.name}
                        </Text>
                        <Text
                          variant="caption"
                          tone={b.status === 'overdue' ? 'danger' : 'secondary'}
                        >
                          {STATUS_META[b.status].label}
                          {b.dueDate ? ` · ${dueLabel(b.dueDate)}` : ''}
                        </Text>
                      </View>
                      <Text variant="body" weight="600">
                        {formatMoney(b.amount_minor)}
                      </Text>
                    </GlassCard>
                  ))}
                </View>
              )}

              {/* Level 5 — detailed analytics, last. D§26: "Do not put charts
                  above the most important information." Note this pair is
                  Income/Expenses, i.e. Remaining — a different figure from
                  Available (BUILD-PLAN P1). */}
              {summary && (
                <View style={{ flexDirection: 'row', gap: space[3] }}>
                  <GlassCard variant="subtle" padding="md" style={{ flex: 1, gap: space[1] }}>
                    <Text variant="caption" tone="secondary">
                      Income
                    </Text>
                    <Text variant="h3" tone="income">
                      {formatMoney(summary.total_income_minor, { compact: true })}
                    </Text>
                  </GlassCard>
                  <GlassCard variant="subtle" padding="md" style={{ flex: 1, gap: space[1] }}>
                    <Text variant="caption" tone="secondary">
                      Expenses
                    </Text>
                    <Text variant="h3">
                      {formatMoney(summary.total_expenses_minor, { compact: true })}
                    </Text>
                  </GlassCard>
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: space[3] }}>
                <GlassCard
                  variant="subtle"
                  padding="md"
                  interactive
                  onPress={() => router.push('/accounts')}
                  style={{ flex: 1 }}
                >
                  <Text variant="body" weight="500">
                    Accounts
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {accounts.length === 0
                      ? 'Add your first'
                      : `${accounts.length} account${accounts.length === 1 ? '' : 's'}`}
                  </Text>
                </GlassCard>

                <GlassCard
                  variant="subtle"
                  padding="md"
                  interactive
                  onPress={() => router.push('/bills')}
                  style={{ flex: 1 }}
                >
                  <Text variant="body" weight="500">
                    Bills
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {bills.length === 0
                      ? 'Add your first'
                      : `${upcomingBills.length} to pay`}
                  </Text>
                </GlassCard>
              </View>
            </View>
          }
        />

        <View
          style={{
            position: 'absolute',
            right: layout.pagePaddingMobile,
            // Above the floating nav, not behind it.
            bottom: layout.fabBottomOffset,
            zIndex: z.fab,
          }}
        >
          <Fab accessibilityLabel="Add transaction" onPress={() => setAdding(true)}>
            <Text variant="h3" tone="onBrand" style={{ color: theme.isDark ? '#111111' : '#FFFFFF' }}>
              +
            </Text>
          </Fab>
        </View>
      </SafeAreaView>

      <QuickAdd visible={adding} onClose={() => setAdding(false)} onSaved={setToast} />

      <TransactionDetail
        txn={selected}
        onClose={() => setSelected(null)}
        onUpdated={setToast}
        onDeleted={() => setToast('Transaction deleted')}
      />

      <Toast
        visible={!!toast}
        message={toast ?? ''}
        onDismiss={() => setToast(null)}
      />
    </View>
  );
}
