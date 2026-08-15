/**
 * Transaction list — grouped by day (D§32).
 *
 * Covers all five states the review flagged: loading (skeletons, D§57), empty
 * (D§56), error (D§58), offline, and content. The offline case is the one v1.0
 * never specified: it shows the last good data with a banner rather than a
 * blank screen, because a phone with no signal still has a wallet.
 */

import { FlashList } from '@shopify/flash-list';
import { useMemo } from 'react';
import { RefreshControl, View } from 'react-native';

import { TransactionItem } from '@/components/domain/TransactionItem';
import { GlassCard } from '@/components/glass/GlassCard';
import { Button } from '@/components/ui/Button';
import { Divider, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Text } from '@/components/ui/Text';
import { dayLabel, groupByDay } from '@/lib/dates';
import { layout, space } from '@/theme/tokens';
import { useBreakpoint, useScrollBottomInset } from '@/theme/useBreakpoint';

import { useTransactions, type TransactionWithCategory } from './api';

type Row =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'txn'; key: string; txn: TransactionWithCategory };

export function TransactionList({
  onSelect,
  onAdd,
  header,
  bottomInset: bottomInsetOverride,
}: {
  onSelect?: (txn: TransactionWithCategory) => void;
  onAdd?: () => void;
  header?: React.ReactElement;
  /** Extra clearance for a screen-level floating control, when present. */
  bottomInset?: number;
}) {
  const { data, isLoading, isError, error, refetch, isRefetching, isPlaceholderData } =
    useTransactions();
  const { pagePadding } = useBreakpoint();
  const defaultBottomInset = useScrollBottomInset();
  const bottomInset = bottomInsetOverride ?? defaultBottomInset;

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const out: Row[] = [];
    for (const [date, txns] of groupByDay(data, (t) => t.transaction_date)) {
      out.push({ kind: 'header', key: `h-${date}`, label: dayLabel(date) });
      for (const t of txns) out.push({ kind: 'txn', key: t.id, txn: t });
    }
    return out;
  }, [data]);

  // Error WITH cached data is an offline-ish state, not a failure — keep
  // showing the money and say the list may be stale.
  const isStale = isError && !!data;

  if (isLoading) {
    return (
      <View style={{ padding: pagePadding, gap: space[4] }}>
        {header}
        <GlassCard padding="lg" style={{ gap: space[4] }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={{ gap: space[2] }}>
              <Skeleton width="55%" height={16} />
              <Skeleton width="35%" height={12} />
            </View>
          ))}
        </GlassCard>
      </View>
    );
  }

  if (isError && !data) {
    return (
      <View style={{ padding: pagePadding, gap: space[4] }}>
        {header}
        <GlassCard padding="lg" style={{ gap: space[3] }}>
          {/* D§58: understandable, not "Error 500". */}
          <Text variant="h4">Something went wrong</Text>
          <Text variant="bodySm" tone="secondary">
            Savi couldn&apos;t load your transactions right now.
          </Text>
          <Button label="Try again" onPress={() => refetch()} />
          <Text variant="micro" tone="secondary">
            {error instanceof Error ? error.message : 'Unknown error'}
          </Text>
        </GlassCard>
      </View>
    );
  }

  return (
    <FlashList
      /**
       * Remount when the newest row changes.
       *
       * FlashList's recycler diffed a reordered array as an append: a
       * just-added transaction rendered at the BOTTOM of the list with no day
       * header, and only moved under "Today" after a reload. From the user's
       * side their entry had vanished — unacceptable in a ledger.
       *
       * Keyed on the newest TRANSACTION id plus the count — not on rows[0],
       * which is a day header and stays identical when a second transaction
       * joins a day that already exists. The count catches deletions.
       */
      key={`${data?.[0]?.id ?? 'empty'}:${data?.length ?? 0}`}
      data={rows}
      keyExtractor={(r) => r.key}
      // FlashList v2 measures automatically; `estimatedItemSize` was removed.
      // getItemType still matters: headers and rows have very different heights
      // and recycling them into each other causes layout thrash.
      getItemType={(r) => r.kind}
      /**
       * Off deliberately. FlashList v2 anchors scroll position when items are
       * prepended, so a transaction added just now stayed pinned below the
       * existing groups and only moved to the top on reload — the user's own
       * entry appeared to go missing. This list is newest-first; the new row
       * jumping into view at the top is the correct behaviour.
       */
      maintainVisibleContentPosition={{ disabled: true }}
      ListHeaderComponent={
        <View style={{ gap: space[4] }}>
          {header}
          {isStale && (
            <GlassCard variant="subtle" padding="md">
              <Text variant="caption" tone="secondary">
                Showing your last saved data — Savi couldn&apos;t reach the server.
              </Text>
            </GlassCard>
          )}
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title="No transactions yet"
          body="Add your first expense or income and Savi will start tracking what you can actually spend."
          action={onAdd ? <Button label="Add a transaction" onPress={onAdd} /> : undefined}
        />
      }
      renderItem={({ item }) =>
        item.kind === 'header' ? (
          <View style={{ paddingTop: space[5], paddingBottom: space[1] }}>
            <Text variant="label" tone="secondary">
              {item.label}
            </Text>
            <Divider style={{ marginTop: space[2] }} />
          </View>
        ) : (
          <TransactionItem txn={item.txn} onPress={() => onSelect?.(item.txn)} />
        )
      }
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      contentContainerStyle={{
        paddingHorizontal: pagePadding,
        // A15: clears the floating nav and FAB on mobile. No nav to clear on
        // desktop, so the inset shrinks rather than leaving a hole.
        paddingBottom: bottomInset,
        width: '100%',
        maxWidth: layout.maxContentWidth,
        alignSelf: 'center',
      }}
      // Opacity nudge while a background refetch is in flight, so the list
      // never blanks — it just looks momentarily provisional.
      style={{ opacity: isPlaceholderData ? 0.6 : 1 }}
    />
  );
}
