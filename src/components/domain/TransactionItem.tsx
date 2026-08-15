/**
 * Transaction row (D§32).
 *
 * "Each transaction should be visually simple."
 *
 * Amount tone follows A2: the semantic TEXT value, never the fill. And D§33 —
 * expenses are neutral, not red. Red is reserved for a problem; spending money
 * is not a problem, it is the thing the app is for.
 *
 * Never blurs. This is a list row, which the M0 spike disqualified.
 */

import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { TransactionWithCategory } from '@/features/transactions/api';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { a11y, radius, space, type CategoryName } from '@/theme/tokens';

export function TransactionItem({
  txn,
  onPress,
}: {
  txn: TransactionWithCategory;
  onPress?: () => void;
}) {
  const theme = useTheme();

  const isIncome = txn.type === 'income';
  const isTransfer = txn.type === 'transfer';

  // Signed for display only — the stored amount is a positive magnitude.
  const signedMinor = txn.direction === 'in' ? txn.amount_minor : -txn.amount_minor;

  const tone = isIncome ? 'income' : isTransfer ? 'secondary' : 'primary';

  const meta = [
    isTransfer ? (txn.direction === 'in' ? 'Transfer in' : 'Transfer out') : null,
    txn.category?.name ?? null,
    txn.classification ? capitalise(txn.classification) : null,
    txn.account?.name ?? null,
  ]
    .filter(Boolean)
    .join(' · ');

  const dotColor = txn.category?.slug
    ? theme.categoryColor(txn.category.slug as CategoryName)
    : theme.color.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${txn.description ?? 'Transaction'}, ${formatMoney(signedMinor, {
        signDisplay: 'always',
      })}, ${meta}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        // D§44: rows are the target that fails this most easily.
        minHeight: a11y.minTouchTarget,
        paddingVertical: space[3],
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: radius.full,
          backgroundColor: dotColor,
          opacity: isTransfer ? 0.4 : 1,
        }}
      />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="body" weight="500" numberOfLines={1}>
          {txn.description || (isTransfer ? 'Transfer' : isIncome ? 'Income' : 'Expense')}
        </Text>
        {meta.length > 0 && (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>

      <Text variant="body" weight="600" tone={tone}>
        {formatMoney(signedMinor, { signDisplay: 'always' })}
      </Text>
    </Pressable>
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
