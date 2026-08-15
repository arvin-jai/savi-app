/**
 * "Bills this week" — a horizontal, snapping row with dot pagination
 * (design handoff 2a).
 *
 * Replaces the dashboard's vertical list of three bills. The reason it is worth
 * the extra machinery: bills are the one thing on this screen with a *deadline*,
 * and a row you swipe reads as "these are coming at you" in a way a stack of
 * cards does not. It also stops three bills from pushing the insight card off
 * the fold.
 *
 * D§44 is why each card carries its status as a word, not just an accent
 * colour, and why the dots are decoration — the cards remain reachable by
 * scrolling regardless of whether the dots are perceivable.
 */

import { useRef, useState } from 'react';
import { Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { BillWithStatus } from '@/features/bills/api';
import { STATUS_META } from '@/features/bills/schedule';
import { dueLabel } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { a11y, brand, radius, space } from '@/theme/tokens';

/** Handoff: 150px fixed-width cards. Plus the gap, this is the snap interval. */
const CARD_WIDTH = 150;
const GAP = space[3];

export function BillsThisWeek({
  bills,
  onPress,
}: {
  bills: BillWithStatus[];
  onPress: (bill: BillWithStatus) => void;
}) {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const lastIndex = useRef(0);

  if (bills.length === 0) return null;

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + GAP));
    // Only re-render when the page actually changes; onScroll fires per frame
    // and setState on every one of them would make the row jerk on Android.
    if (next !== lastIndex.current) {
      lastIndex.current = next;
      setIndex(next);
    }
  }

  return (
    <View style={{ gap: space[3] }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + GAP}
        snapToAlignment="start"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ gap: GAP, paddingRight: space[4] }}
      >
        {bills.map((bill) => {
          const meta = STATUS_META[bill.status];
          const accent = theme.semanticFill(meta.tone);

          return (
            <Pressable
              key={bill.id}
              onPress={() => onPress(bill)}
              accessibilityRole="button"
              accessibilityLabel={`${bill.name}, ${formatMoney(bill.amount_minor)}, ${
                meta.label
              }${bill.dueDate ? `, ${dueLabel(bill.dueDate)}` : ''}`}
              style={({ pressed }) => ({
                width: CARD_WIDTH,
                minHeight: a11y.minTouchTarget,
                borderRadius: radius.lg,
                padding: space[4],
                gap: space[1],
                backgroundColor: theme.glass.subtle.fallback,
                borderWidth: 1,
                // The status tint is on the border, not the fill — D§35's
                // "subtle coloured indicators, never colour-filled cards".
                borderColor: `${accent}66`,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: radius.full,
                    backgroundColor: accent,
                  }}
                />
                <Text variant="bodySm" weight="500" numberOfLines={1} style={{ flex: 1 }}>
                  {bill.name}
                </Text>
              </View>

              <Text variant="h4">{formatMoney(bill.amount_minor)}</Text>

              <Text variant="caption" tone={bill.status === 'overdue' ? 'danger' : 'secondary'}>
                {bill.dueDate ? dueLabel(bill.dueDate) : meta.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Progressive dots. Purely positional feedback, so they are hidden from
          screen readers — the cards themselves are already announced. */}
      {bills.length > 1 && (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: 'row', gap: space[1], justifyContent: 'center' }}
        >
          {bills.map((bill, i) => (
            <View
              key={bill.id}
              style={{
                width: i === index ? 16 : 6,
                height: 6,
                borderRadius: radius.full,
                backgroundColor: i === index ? brand[500] : theme.color.border,
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
