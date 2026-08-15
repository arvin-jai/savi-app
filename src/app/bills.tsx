/**
 * Bills (P§15).
 *
 * D§62: one primary action — "+ Add Bill".
 */

import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/AmbientBackground';
import { BillCard } from '@/components/domain/BillCard';
import { GlassCard } from '@/components/glass/GlassCard';
import { GlassSheet } from '@/components/glass/GlassSheet';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/controls';
import { EmptyState, Skeleton, Toast } from '@/components/ui/feedback';
import { Input, MoneyInput } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { useAccounts } from '@/features/accounts/api';
import { accountLabel } from '@/features/accounts/label';
import {
  useBills,
  useCreateBill,
  useDeleteBill,
  useMarkBillPaid,
  useUndoBillPayment,
  type BillWithStatus,
} from '@/features/bills/api';
import { useCategories } from '@/features/transactions/api';
import { formatMoney, parseMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, space, type CategoryName } from '@/theme/tokens';
import { useBreakpoint, useScrollBottomInset } from '@/theme/useBreakpoint';

/**
 * How often a bill repeats. The values match `bills.interval_months`, and the
 * DB constraint allows 1, 2, 3, 4, 6 and 12 — these are the four people
 * actually asked for.
 */
const BILL_INTERVALS: { months: number; label: string }[] = [
  { months: 1, label: 'Monthly' },
  { months: 3, label: 'Every 3 months' },
  { months: 6, label: 'Every 6 months' },
  { months: 12, label: 'Yearly' },
];

export default function Bills() {
  const { pagePadding } = useBreakpoint();
  const bottomInset = useScrollBottomInset();
  const theme = useTheme();
  const { data: bills = [], isLoading } = useBills();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();

  const create = useCreateBill();
  const markPaid = useMarkBillPaid();
  const undo = useUndoBillPayment();
  const remove = useDeleteBill();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState('15');
  const [intervalMonths, setIntervalMonths] = useState(1);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BillWithStatus | null>(null);

  const unpaidTotal = bills
    .filter((b) => b.status !== 'paid')
    .reduce((sum, b) => sum + b.amount_minor, 0);

  async function handleMarkPaid(bill: BillWithStatus) {
    setBusyId(bill.id);
    try {
      const payment = await markPaid.mutateAsync(bill);
      // D§59: no dialog, but always an undo. That pairing is what makes the
      // missing confirmation safe rather than reckless.
      setToast({
        message: `${bill.name} marked as paid`,
        undo: async () => {
          await undo.mutateAsync(payment);
          setToast(null);
        },
      });
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'Could not mark that as paid' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleUndo(bill: BillWithStatus) {
    if (!bill.payment) return;
    setBusyId(bill.id);
    try {
      await undo.mutateAsync(bill.payment);
      setToast({ message: `${bill.name} is unpaid again` });
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'Could not undo that' });
    } finally {
      setBusyId(null);
    }
  }

  async function saveBill() {
    setError(null);
    const amountMinor = parseMoney(amount);
    const day = Number(dueDay);

    if (!amountMinor || amountMinor <= 0) return setError('Enter an amount.');
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      return setError('Due day must be between 1 and 31.');
    }

    try {
      await create.mutateAsync({
        name,
        amountMinor,
        dueDay: day,
        intervalMonths,
        accountId,
        categoryId,
      });
      setAdding(false);
      setName('');
      setAmount('');
      setDueDay('15');
      setIntervalMonths(1);
      setAccountId(null);
      setCategoryId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that bill.');
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
          <ScreenHeader title="Bills" />

          {bills.length > 0 && (
            <GlassCard variant="subtle" padding="md" style={{ gap: space[1] }}>
              <Text variant="label" tone="secondary">
                Still to pay this month
              </Text>
              <Text variant="h2">{formatMoney(unpaidTotal)}</Text>
              <Text variant="caption" tone="secondary">
                This is what Savi subtracts from your available money.
              </Text>
            </GlassCard>
          )}

          {isLoading && (
            <GlassCard padding="lg" style={{ gap: space[3] }}>
              <Skeleton width="45%" height={18} />
              <Skeleton width="60%" height={28} />
              <Skeleton width="30%" height={14} />
            </GlassCard>
          )}

          {!isLoading && bills.length === 0 && (
            <EmptyState
              title="No bills yet"
              body="Add your recurring bills and Savi will remind you before they're due."
              action={<Button label="Add a bill" onPress={() => setAdding(true)} />}
            />
          )}

          {bills.map((bill) => (
            <BillCard
              key={bill.id}
              bill={bill}
              busy={busyId === bill.id}
              onMarkPaid={() => handleMarkPaid(bill)}
              onUndo={() => handleUndo(bill)}
              onDelete={() => setConfirmDelete(bill)}
            />
          ))}

          {bills.length > 0 && (
            <Button label="Add bill" variant="secondary" block onPress={() => setAdding(true)} />
          )}
        </ScrollView>
      </SafeAreaView>

      <GlassSheet
        visible={adding}
        onClose={() => setAdding(false)}
        title="Add a bill"
        footer={
          <View style={{ gap: space[3] }}>
            {error && (
              <Text variant="caption" tone="danger">
                {error}
              </Text>
            )}
            <Button
              label="Add bill"
              block
              loading={create.isPending}
              disabled={name.trim().length === 0 || create.isPending}
              onPress={saveBill}
            />
          </View>
        }
      >
        <Input
          label="What is it?"
          value={name}
          onChangeText={setName}
          placeholder="Internet, Electricity, Rent…"
          autoFocus
        />

        <MoneyInput value={amount} onChangeText={setAmount} />

        <Input
          label="Due day of the month"
          value={dueDay}
          onChangeText={setDueDay}
          keyboardType="number-pad"
          hint="Savi moves it to the last day in shorter months."
        />

        <View style={{ gap: space[2] }}>
          <Text variant="label" tone="secondary">
            How often
          </Text>
          <ChipRow>
            {BILL_INTERVALS.map((i) => (
              <Chip
                key={i.months}
                label={i.label}
                selected={i.months === intervalMonths}
                onPress={() => setIntervalMonths(i.months)}
              />
            ))}
          </ChipRow>
          <Text variant="caption" tone="secondary">
            {intervalMonths === 1
              ? 'Every month.'
              : `Every ${intervalMonths} months, starting this month.`}
          </Text>
        </View>

        {accounts.length > 0 && (
          <View style={{ gap: space[2] }}>
            <Text variant="label" tone="secondary">
              Pay from
            </Text>
            <ChipRow>
              {accounts.map((a) => (
                <Chip
                  key={a.id}
                  label={accountLabel(a, accounts)}
                  selected={a.id === accountId}
                  onPress={() => setAccountId(a.id === accountId ? null : a.id)}
                />
              ))}
            </ChipRow>
            <Text variant="caption" tone="secondary">
              Optional. If set, marking it paid also records the expense.
            </Text>
          </View>
        )}

        <View style={{ gap: space[2] }}>
          <Text variant="label" tone="secondary">
            Category
          </Text>
          <ChipRow>
            {categories.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                selected={c.id === categoryId}
                dotColor={c.slug ? theme.categoryColor(c.slug as CategoryName) : undefined}
                onPress={() => setCategoryId(c.id === categoryId ? null : c.id)}
              />
            ))}
          </ChipRow>
        </View>
      </GlassSheet>

      {/* D§59: deleting is destructive, so it is confirmed — unlike "mark as
          paid", which is not. */}
      <GlassSheet
        visible={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete this bill?"
        footer={
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <Button
              label="Delete bill"
              variant="danger"
              loading={remove.isPending}
              onPress={async () => {
                if (!confirmDelete) return;
                const name = confirmDelete.name;
                try {
                  await remove.mutateAsync(confirmDelete.id);
                  setConfirmDelete(null);
                  setToast({ message: `${name} deleted` });
                } catch (e) {
                  setToast({
                    message: e instanceof Error ? e.message : 'Could not delete that bill',
                  });
                }
              }}
            />
            <Button label="Keep it" variant="ghost" onPress={() => setConfirmDelete(null)} />
          </View>
        }
      >
        <Text variant="body" tone="secondary">
          {confirmDelete
            ? `"${confirmDelete.name}" and its payment history will be removed, and it will stop counting towards your upcoming bills.`
            : ''}
        </Text>
        <Text variant="caption" tone="secondary">
          Payments you already made stay in your transactions — this removes the bill, not the
          money you spent.
        </Text>
      </GlassSheet>

      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        actionLabel={toast?.undo ? 'Undo' : undefined}
        onAction={toast?.undo}
        onDismiss={() => setToast(null)}
      />
    </View>
  );
}
