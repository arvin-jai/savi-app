/**
 * The income / expense split bar (design handoff 2a).
 *
 * Replaces the dashboard's two side-by-side summary cards with one bar. The
 * point is the *relationship* — how much of what came in has gone out — which
 * two separate numbers make you compute in your head.
 *
 * D§26 still holds: this is Level 5, detail, and it sits below Available Money
 * and the bills. It is a proportion, not a headline.
 *
 * D§44: never colour alone. The two amounts are labelled in words underneath,
 * and the accessibility label states the whole relationship in a sentence, so
 * the bar itself is the decoration on top of the text.
 */

import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, semantic, space } from '@/theme/tokens';

export function SplitBar({
  incomeMinor,
  expensesMinor,
}: {
  incomeMinor: number;
  expensesMinor: number;
}) {
  const theme = useTheme();
  const total = incomeMinor + expensesMinor;

  // Nothing recorded yet: a bar of zero width reads as a rendering bug, and an
  // empty month has nothing to say about proportion.
  if (total <= 0) return null;

  const incomeFlex = incomeMinor / total;

  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" tone="secondary">
          This month
        </Text>
        <Text variant="caption" weight="600" tone="secondary">
          {formatMoney(total)} total
        </Text>
      </View>

      <View
        accessibilityRole="image"
        accessibilityLabel={`${formatMoney(incomeMinor)} in, ${formatMoney(
          expensesMinor
        )} out this month`}
        style={{ flexDirection: 'row', height: 10, gap: 2 }}
      >
        {incomeMinor > 0 && (
          <View
            style={{
              flex: incomeFlex,
              backgroundColor: semantic.income.fill,
              borderTopLeftRadius: radius.full,
              borderBottomLeftRadius: radius.full,
              // A single-sided segment should still be a pill, not a tab.
              borderTopRightRadius: expensesMinor > 0 ? 0 : radius.full,
              borderBottomRightRadius: expensesMinor > 0 ? 0 : radius.full,
            }}
          />
        )}
        {expensesMinor > 0 && (
          <View
            style={{
              flex: 1 - incomeFlex,
              backgroundColor: semantic.expense.fill,
              borderTopRightRadius: radius.full,
              borderBottomRightRadius: radius.full,
              borderTopLeftRadius: incomeMinor > 0 ? 0 : radius.full,
              borderBottomLeftRadius: incomeMinor > 0 ? 0 : radius.full,
            }}
          />
        )}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {/* Text variants, not the fills above — the fills fail AA as text
            (A2). "Spent", not "Expenses": D§33's orange means money moved, not
            money wasted. */}
        <Text variant="bodySm" weight="500" tone="income">
          Income {formatMoney(incomeMinor)}
        </Text>
        <Text variant="bodySm" weight="500" tone="expense">
          Spent {formatMoney(expensesMinor)}
        </Text>
      </View>

      {/* Fallback for a month with only one side, where the bar alone would
          look like a full green or full orange track and mean nothing. */}
      {(incomeMinor === 0 || expensesMinor === 0) && (
        <Text variant="caption" tone="secondary" style={{ color: theme.color.textSecondary }}>
          {incomeMinor === 0 ? 'No income recorded yet this month.' : 'Nothing spent yet this month.'}
        </Text>
      )}
    </View>
  );
}
