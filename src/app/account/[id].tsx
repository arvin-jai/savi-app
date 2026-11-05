/**
 * One account, and what happened in it (P§13).
 *
 * Reached by tapping an account on the dashboard or the Money screen. The
 * question it answers is "where did the money in THIS account go", which the
 * combined ledger cannot: a single list of every account's movements is the
 * right default and the wrong answer when someone is reconciling one card
 * against its statement.
 *
 * The balance is read from the account row, not summed from the transactions
 * below it. The database maintains that number in the same transaction as the
 * movement that changed it, and the list here is capped at the most recent 100
 * — summing a truncated list would render a confidently wrong balance.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/AmbientBackground';
import { GlassCard } from '@/components/glass/GlassCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Text } from '@/components/ui/Text';
import { ACCOUNT_TYPE_LABELS, useAccounts } from '@/features/accounts/api';
import { TransactionList } from '@/features/transactions/TransactionList';
import { formatMoney } from '@/lib/money';
import { space } from '@/theme/tokens';
import { useBreakpoint } from '@/theme/useBreakpoint';

export default function AccountDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: accounts = [], isLoading, isFetching } = useAccounts();
  const { pagePadding } = useBreakpoint();

  const account = accounts.find((a) => a.id === id) ?? null;

  if (isLoading || (isFetching && !account)) {
    return (
      <View style={{ flex: 1 }}>
        <AmbientBackground />
        <SafeAreaView style={{ flex: 1 }}>
          <ScreenHeader title="Account" />
          <View style={{ padding: pagePadding, gap: space[3] }}>
            <Skeleton width="60%" height={28} />
            <Skeleton width="40%" height={16} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  /**
   * An archived or deleted account is reachable by a stale deep link or by the
   * back stack after an archive. Say so plainly rather than rendering an empty
   * ledger, which would read as "this account has no history".
   */
  if (!account) {
    return (
      <View style={{ flex: 1 }}>
        <AmbientBackground />
        <SafeAreaView style={{ flex: 1 }}>
          <ScreenHeader title="Account" />
          <View style={{ padding: pagePadding }}>
            <EmptyState
              title="That account is not here"
              body="It may have been archived or removed. Your transactions are still on the Money screen."
              action={<Button label="Back to accounts" onPress={() => router.push('/accounts')} />}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AmbientBackground />
      <SafeAreaView style={{ flex: 1 }}>
        <ScreenHeader title={account.name} />

        <TransactionList
          accountId={account.id}
          emptyTitle="Nothing in this account yet"
          emptyBody={`When you record something against ${account.name}, it will show up here.`}
          header={
            <View style={{ gap: space[2] }}>
              <GlassCard padding="lg" style={{ gap: space[1] }}>
                <Text variant="label" tone="secondary">
                  {ACCOUNT_TYPE_LABELS[account.type]}
                  {account.is_default ? ' · Default' : ''}
                </Text>
                <Text variant="displayMd">{formatMoney(account.balance_minor)}</Text>

                {/**
                 * A card balance is money OWED. Saying so here matters more
                 * than anywhere else in the app: this screen shows the number
                 * on its own, with none of the dashboard's context to make the
                 * sign obvious (BUILD-PLAN P1).
                 */}
                {account.is_liability && (
                  <Text variant="caption" tone="danger">
                    Owed · not counted in Available Money
                  </Text>
                )}
              </GlassCard>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}
