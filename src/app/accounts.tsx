/**
 * Accounts (P§13).
 *
 * Archive rather than delete: deleting an account cascades its transactions and
 * silently rewrites the user's history — last month's spending total would
 * change. See features/accounts/api.ts.
 */

import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/AmbientBackground';
import { GlassCard } from '@/components/glass/GlassCard';
import { GlassSheet } from '@/components/glass/GlassSheet';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/controls';
import { Badge, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input, MoneyInput } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import {
  ACCOUNT_TYPE_LABELS,
  isLiabilityType,
  useAccounts,
  useAccountDeletionImpact,
  useArchiveAccount,
  useCreateAccount,
  useDeleteAccount,
  useSetAccountBalance,
} from '@/features/accounts/api';
import type { Account, AccountType } from '@/lib/database.types';
import { formatMoney, parseMoney } from '@/lib/money';
import { layout, space } from '@/theme/tokens';
import { useBreakpoint, useScrollBottomInset } from '@/theme/useBreakpoint';

const TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];

export default function Accounts() {
  const { pagePadding } = useBreakpoint();
  const bottomInset = useScrollBottomInset();
  const { data: accounts = [], isLoading } = useAccounts();
  const create = useCreateAccount();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [opening, setOpening] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Account | null>(null);
  const [editingValue, setEditingValue] = useState<Account | null>(null);
  const [value, setValue] = useState('');
  const [valueError, setValueError] = useState<string | null>(null);

  const remove = useDeleteAccount();
  const archive = useArchiveAccount();
  const setBalance = useSetAccountBalance();
  const { data: impact } = useAccountDeletionImpact(confirmRemove?.id ?? null);
  const txnCount = impact?.transactions ?? 0;
  const schedules = impact?.schedules ?? [];

  const openingMinor = parseMoney(opening) ?? 0;

  async function save() {
    setError(null);
    try {
      await create.mutateAsync({
        name,
        type,
        openingBalanceMinor: openingMinor > 0 ? openingMinor : undefined,
        isDefault: accounts.length === 0,
      });
      setAdding(false);
      setName('');
      setOpening('');
      setType('cash');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create that account.');
    }
  }

  function openValueEditor(account: Account) {
    setEditingValue(account);
    setValue(formatMoney(account.balance_minor, { hideSymbol: true, decimals: 'always' }));
    setValueError(null);
  }

  async function saveValue() {
    if (!editingValue) return;

    const targetBalanceMinor = parseMoney(value);
    if (targetBalanceMinor === null) {
      setValueError('Enter a valid amount.');
      return;
    }

    setValueError(null);
    try {
      await setBalance.mutateAsync({
        accountId: editingValue.id,
        currentBalanceMinor: editingValue.balance_minor,
        targetBalanceMinor,
      });
      setEditingValue(null);
    } catch (e) {
      setValueError(e instanceof Error ? e.message : 'Could not update that value.');
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <AmbientBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{
            padding: pagePadding,
            gap: space[4],
            paddingBottom: bottomInset,
            width: '100%',
            maxWidth: layout.maxContentWidth,
            alignSelf: 'center',
          }}
        >
          <ScreenHeader title="Accounts" />

          {isLoading && (
            <GlassCard padding="lg" style={{ gap: space[3] }}>
              <Skeleton width="50%" height={18} />
              <Skeleton width="30%" height={14} />
            </GlassCard>
          )}

          {!isLoading && accounts.length === 0 && (
            <EmptyState
              title="No accounts yet"
              body="Add where your money lives — cash, a bank account, GCash — and Savi can work out what you can spend."
              action={<Button label="Add an account" onPress={() => setAdding(true)} />}
            />
          )}

          {accounts.map((a) => (
            <GlassCard key={a.id} padding="lg" style={{ gap: space[2] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <Text variant="h4" style={{ flex: 1 }}>
                  {a.name}
                </Text>
                {a.is_default && <Badge label="Default" tone="info" />}
                {a.is_liability && <Badge label="Owed" tone="danger" />}
              </View>

              <Text variant="displayMd">{formatMoney(a.balance_minor)}</Text>

              <Text variant="caption" tone="secondary">
                {ACCOUNT_TYPE_LABELS[a.type]}
                {a.is_liability ? ' · not counted in Available' : ''}
              </Text>

              <View style={{ flexDirection: 'row' }}>
                <Button
                  label="Edit value"
                  variant="ghost"
                  size="sm"
                  onPress={() => openValueEditor(a)}
                />
                <Button
                  label="Remove"
                  variant="ghost"
                  size="sm"
                  onPress={() => setConfirmRemove(a)}
                />
              </View>
            </GlassCard>
          ))}

          {accounts.length > 0 && (
            <Button label="Add account" variant="secondary" block onPress={() => setAdding(true)} />
          )}
        </ScrollView>
      </SafeAreaView>

      <GlassSheet
        visible={adding}
        onClose={() => setAdding(false)}
        title="Add an account"
        footer={
          <View style={{ gap: space[3] }}>
            {error && (
              <Text variant="caption" tone="danger">
                {error}
              </Text>
            )}
            <Button
              label="Add account"
              block
              loading={create.isPending}
              disabled={name.trim().length === 0 || create.isPending}
              onPress={save}
            />
          </View>
        }
      >
        <Input
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Cash, BPI, GCash…"
          autoFocus
        />

        <View style={{ gap: space[2] }}>
          <Text variant="label" tone="secondary">
            Type
          </Text>
          <ChipRow>
            {TYPES.map((t) => (
              <Chip
                key={t}
                label={ACCOUNT_TYPE_LABELS[t]}
                selected={t === type}
                onPress={() => setType(t)}
              />
            ))}
          </ChipRow>
          {isLiabilityType(type) && (
            <Text variant="caption" tone="secondary">
              A credit card is money you owe, so Savi leaves it out of what you can spend.
            </Text>
          )}
        </View>

        <MoneyInput label="Opening balance" value={opening} onChangeText={setOpening} />
        <Text variant="caption" tone="secondary">
          Recorded as a transaction so your balance always has history behind it.
        </Text>
      </GlassSheet>

      <GlassSheet
        visible={editingValue !== null}
        onClose={() => setEditingValue(null)}
        title={editingValue ? `Edit ${editingValue.name}` : ''}
        footer={
          <View style={{ gap: space[3] }}>
            <Button
              label="Save value"
              block
              loading={setBalance.isPending}
              disabled={setBalance.isPending}
              onPress={saveValue}
            />
          </View>
        }
      >
        <MoneyInput
          label="Current value"
          value={value}
          onChangeText={setValue}
          error={valueError ?? undefined}
          autoFocus
        />
        <Text variant="caption" tone="secondary">
          Savi records the difference as a balance adjustment, so your account history stays
          accurate.
        </Text>
      </GlassSheet>

      {/*
        D§59: destructive, so it is confirmed — but the confirmation has to say
        what will actually happen. `transactions.account_id` cascades, so
        deleting an account with history silently rewrites every total the app
        has ever shown. The sheet names the number, and offers archiving as the
        way out for anyone who just stopped using the account.
      */}
      <GlassSheet
        visible={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        title={confirmRemove ? `Remove ${confirmRemove.name}?` : ''}
        footer={
          <View style={{ gap: space[2] }}>
            {(txnCount > 0 || schedules.length > 0) && (
              <Button
                label="Archive instead — keeps history"
                block
                loading={archive.isPending}
                onPress={async () => {
                  if (!confirmRemove) return;
                  await archive.mutateAsync(confirmRemove.id);
                  setConfirmRemove(null);
                }}
              />
            )}
            <Button
              label={
                txnCount > 0
                  ? `Delete account and ${txnCount} ${txnCount === 1 ? 'transaction' : 'transactions'}`
                  : 'Delete account'
              }
              variant="danger"
              block
              loading={remove.isPending}
              onPress={async () => {
                if (!confirmRemove) return;
                await remove.mutateAsync(confirmRemove.id);
                setConfirmRemove(null);
              }}
            />
            <Button label="Cancel" variant="ghost" block onPress={() => setConfirmRemove(null)} />
          </View>
        }
      >
        {txnCount > 0 || schedules.length > 0 ? (
          <View style={{ gap: space[2] }}>
            {txnCount > 0 && (
              <Text variant="body">
                This account holds {txnCount}{' '}
                {txnCount === 1 ? 'transaction' : 'transactions'}. Deleting it removes{' '}
                {txnCount === 1 ? 'that too' : 'those too'}, and your income, expense and balance
                totals will change to match.
              </Text>
            )}

            {/*
              The quiet half of the cascade. Deleting the account a salary is
              paid into deletes the payday itself, and the user finds out next
              month when no income arrives. It is stated separately from the
              transaction count because it is a different kind of loss — that
              one rewrites the past, this one stops the future.
            */}
            {schedules.length > 0 && (
              <Text variant="body" tone="bill">
                {schedules.length === 1
                  ? `${schedules[0]} is paid into this account, and that schedule goes too — it will stop arriving each month.`
                  : `${schedules.length} recurring payments are paid into this account (${schedules.join(', ')}), and those schedules go too — they will stop arriving each month.`}
              </Text>
            )}

            <Text variant="bodySm" tone="secondary">
              If you have just stopped using this account, archive it instead — it disappears
              from your lists and everything you recorded stays true.
            </Text>
          </View>
        ) : (
          <Text variant="body" tone="secondary">
            This account has no transactions, so nothing else is affected.
          </Text>
        )}
      </GlassSheet>
    </View>
  );
}
