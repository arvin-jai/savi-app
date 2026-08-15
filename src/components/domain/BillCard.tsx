/**
 * Bill card (D§34).
 *
 * D§44 is the governing constraint: never colour alone. Every state carries a
 * written label — "Overdue", "Due soon", "Paid" — and the accent is decoration
 * layered on top of text that already says it. A colourblind user, or anyone
 * glancing at a dim screen outdoors, reads the same information.
 *
 * "Mark as paid" has no confirmation (D§59). It is safe without one because
 * the action writes a row that Undo deletes.
 */

import { View } from 'react-native';

import { GlassCard } from '@/components/glass/GlassCard';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/feedback';
import { Text } from '@/components/ui/Text';
import type { BillWithStatus } from '@/features/bills/api';
import { STATUS_META } from '@/features/bills/schedule';
import { dueLabel } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { space } from '@/theme/tokens';

export function BillCard({
  bill,
  onMarkPaid,
  onUndo,
  onDelete,
  busy,
}: {
  bill: BillWithStatus;
  onMarkPaid: () => void;
  onUndo: () => void;
  onDelete?: () => void;
  busy?: boolean;
}) {
  const meta = STATUS_META[bill.status];
  const isPaid = bill.status === 'paid';

  return (
    <GlassCard padding="lg" style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <Text variant="h4" style={{ flex: 1 }} numberOfLines={1}>
          {bill.name}
        </Text>
        <StatusPill label={meta.label} tone={meta.tone} />
      </View>

      <View style={{ gap: space[1] }}>
        <Text variant="displayMd">{formatMoney(bill.amount_minor)}</Text>
        <Text variant="bodySm" tone={bill.status === 'overdue' ? 'danger' : 'secondary'}>
          {isPaid
            ? 'Paid this month'
            : bill.dueDate
              ? dueLabel(bill.dueDate)
              : 'No schedule set'}
        </Text>

        {/* Only when it isn't monthly. Labelling every bill "Monthly" would be
            noise on the common case, but a quarterly bill showing a date with
            no cadence reads as a one-off. */}
        {bill.interval_months > 1 && (
          <Text variant="caption" tone="secondary">
            {bill.interval_months === 12
              ? 'Yearly'
              : `Every ${bill.interval_months} months`}
          </Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        {isPaid ? (
          <Button label="Undo" variant="ghost" onPress={onUndo} loading={busy} />
        ) : (
          <Button label="Mark as paid" variant="secondary" onPress={onMarkPaid} loading={busy} />
        )}

        {/* Ghost, and last: D§62 says one obvious primary action per surface,
            and on a bill card that is paying it, not destroying it. */}
        {onDelete && <Button label="Delete" variant="ghost" size="sm" onPress={onDelete} />}
      </View>
    </GlassCard>
  );
}
