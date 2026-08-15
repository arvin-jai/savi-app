/**
 * Transaction detail — view, edit, delete.
 *
 * D§59: delete requires confirmation (it is destructive and silently rewrites
 * a month's totals). Everything else does not — edits are reversible by
 * editing again.
 *
 * The confirm step is a second sheet rather than a native Alert, because
 * RN's Alert is a no-op on web and this app ships to web at v0.7.
 */

import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { GlassSheet } from '@/components/glass/GlassSheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { dayLabel } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { space } from '@/theme/tokens';

import { useDeleteTransaction, useUpdateTransaction, type TransactionWithCategory } from './api';

export function TransactionDetail({
  txn,
  onClose,
  onDeleted,
  onUpdated,
}: {
  txn: TransactionWithCategory | null;
  onClose: () => void;
  onDeleted: (txn: TransactionWithCategory) => void;
  onUpdated: (message: string) => void;
}) {
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();

  const [description, setDescription] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDescription(txn?.description ?? '');
    setConfirming(false);
    setError(null);
  }, [txn]);

  if (!txn) return null;

  const signedMinor = txn.direction === 'in' ? txn.amount_minor : -txn.amount_minor;
  const isTransfer = txn.type === 'transfer';

  async function save() {
    if (!txn) return;
    setError(null);
    try {
      await update.mutateAsync({ id: txn.id, description: description.trim() || null });
      onUpdated('Transaction updated');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that change.');
    }
  }

  async function confirmDelete() {
    if (!txn) return;
    setError(null);
    try {
      await remove.mutateAsync({ id: txn.id, transfer_group_id: txn.transfer_group_id });
      onDeleted(txn);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete that.');
    }
  }

  // ── Confirmation step (D§59) ──────────────────────────────────────────────
  if (confirming) {
    return (
      <GlassSheet
        visible
        onClose={() => setConfirming(false)}
        title="Delete this transaction?"
        footer={
          <View style={{ gap: space[3] }}>
            {error && (
              <Text variant="caption" tone="danger">
                {error}
              </Text>
            )}
            <Button
              label="Delete"
              variant="danger"
              block
              loading={remove.isPending}
              onPress={confirmDelete}
            />
            <Button label="Keep it" variant="ghost" block onPress={() => setConfirming(false)} />
          </View>
        }
      >
        <Text variant="body" tone="secondary">
          {isTransfer
            ? 'This removes both sides of the transfer and adjusts both account balances.'
            : 'This removes it from your history and adjusts your balance. It cannot be undone.'}
        </Text>
      </GlassSheet>
    );
  }

  return (
    <GlassSheet
      visible
      onClose={onClose}
      title={txn.description || 'Transaction'}
      footer={
        <View style={{ gap: space[3] }}>
          {error && (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          )}
          <Button label="Save changes" block loading={update.isPending} onPress={save} />
          <Button label="Delete" variant="ghost" block onPress={() => setConfirming(true)} />
        </View>
      }
    >
      <View style={{ gap: space[1] }}>
        <Text
          variant="displayMd"
          tone={txn.type === 'income' ? 'income' : isTransfer ? 'secondary' : 'primary'}
        >
          {formatMoney(signedMinor, { signDisplay: 'always' })}
        </Text>
        <Text variant="bodySm" tone="secondary">
          {dayLabel(txn.transaction_date)}
          {txn.account ? ` · ${txn.account.name}` : ''}
          {txn.category ? ` · ${txn.category.name}` : ''}
          {txn.classification ? ` · ${txn.classification}` : ''}
        </Text>
      </View>

      {isTransfer ? (
        <Text variant="bodySm" tone="secondary">
          Transfers move money between your own accounts, so they don&apos;t count as income or
          spending.
        </Text>
      ) : (
        <Input label="Description" value={description} onChangeText={setDescription} />
      )}
    </GlassSheet>
  );
}
