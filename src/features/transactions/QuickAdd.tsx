/**
 * Quick Add (P§9) — the signature input.
 *
 * "The user should be able to add something in seconds."
 *
 * D§60 progressive disclosure is the whole design: Amount and "What was it?"
 * are the entire first level. Account, date, classification, and notes live
 * behind "More details" pre-filled with Savi's inference, so the common case is
 * two fields and Save.
 *
 * The inferred classification is SHOWN, not hidden, and is one tap to change
 * (P§61). An inference the user can't see is a bug they can't report.
 */

import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { GlassSheet } from '@/components/glass/GlassSheet';
import { Button } from '@/components/ui/Button';
import { Chip, ChipRow, Disclosure, Segmented } from '@/components/ui/controls';
import { Input, MoneyInput } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { useAccounts, useDefaultAccount } from '@/features/accounts/api';
import { accountLabel } from '@/features/accounts/label';
import { useCreateEvent, useCreateTask } from '@/features/calendar/api';
import { todayISO } from '@/lib/dates';
import { parseMoney } from '@/lib/money';
import type { Classification, EventKind, TaskPriority } from '@/lib/database.types';
import { useTheme } from '@/theme/ThemeProvider';
import { space, type CategoryName } from '@/theme/tokens';

import { useCategories, useCreateTransaction, useCreateTransfer, useTransactions } from './api';
import { inferFromDescription } from './infer';

/**
 * P§9's five options, complete as of v0.2. Money modes take an amount; Task
 * and Event do not, which is why the sheet branches on `isMoneyMode` rather
 * than showing a disabled amount field.
 */
type Mode = 'expense' | 'income' | 'transfer' | 'task' | 'event';

const MONEY_MODES: Mode[] = ['expense', 'income', 'transfer'];

const CLASSIFICATIONS: { value: Classification; label: string }[] = [
  { value: 'need', label: 'Need' },
  { value: 'want', label: 'Want' },
  { value: 'bill', label: 'Bill' },
];

export function QuickAdd({
  visible,
  onClose,
  onSaved,
  initialMode = 'expense',
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  initialMode?: Mode;
}) {
  const theme = useTheme();
  const { data: accounts = [] } = useAccounts();
  const { data: defaultAccount } = useDefaultAccount();
  const { data: categories = [] } = useCategories();
  const { data: history = [] } = useTransactions(200);

  const createTransaction = useCreateTransaction();
  const createTransfer = useCreateTransfer();
  const createTask = useCreateTask();
  const createEvent = useCreateEvent();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Overrides. Null means "still following Savi's suggestion" — that
  // distinction is what lets the inference keep updating as the user types,
  // but stop the moment they make a choice of their own.
  const [classificationOverride, setClassificationOverride] = useState<Classification | null>(null);
  const [categoryOverride, setCategoryOverride] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [eventKind, setEventKind] = useState<EventKind>('personal');

  const isMoneyMode = MONEY_MODES.includes(mode);

  useEffect(() => {
    if (!visible) return;
    // Fresh sheet every time. A stale amount from last time is a wrong-amount
    // transaction waiting to happen.
    setMode(initialMode);
    setAmount('');
    setDescription('');
    setShowDetails(false);
    setError(null);
    setClassificationOverride(null);
    setCategoryOverride(null);
    setAccountId(null);
    setToAccountId(null);
    setDate(todayISO());
  }, [visible, initialMode]);

  const inference = useMemo(
    () => inferFromDescription(description, history),
    [description, history]
  );

  const classification = classificationOverride ?? inference.classification;
  const categorySlug = categoryOverride ?? inference.categorySlug;
  const category = categories.find((c) => c.slug === categorySlug) ?? null;
  const fromAccount = accounts.find((a) => a.id === (accountId ?? defaultAccount?.id)) ?? null;
  const toAccount = accounts.find((a) => a.id === toAccountId) ?? null;

  const amountMinor = parseMoney(amount);
  const amountValid = amountMinor !== null && amountMinor > 0;

  const busy =
    createTransaction.isPending ||
    createTransfer.isPending ||
    createTask.isPending ||
    createEvent.isPending;

  const canSave = busy
    ? false
    : isMoneyMode
      ? amountValid &&
        !!fromAccount &&
        (mode !== 'transfer' || (!!toAccount && toAccount.id !== fromAccount.id))
      : description.trim().length > 0;

  async function save() {
    setError(null);

    // ── Non-money modes (P§9) ───────────────────────────────────────────────
    if (!isMoneyMode) {
      try {
        if (mode === 'task') {
          await createTask.mutateAsync({
            title: description,
            dueDate: date || null,
            priority,
          });
          onSaved('Task added');
        } else {
          await createEvent.mutateAsync({
            title: description,
            date,
            kind: eventKind,
          });
          onSaved('Event added');
        }
        onClose();
      } catch (e) {
        setError(
          e instanceof Error ? `Savi couldn't save that. ${e.message}` : "Savi couldn't save that."
        );
      }
      return;
    }

    if (!amountValid || !fromAccount) return;

    try {
      if (mode === 'transfer') {
        if (!toAccount) return;
        await createTransfer.mutateAsync({
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          amountMinor: amountMinor!,
          description: description || null,
          date,
        });
        onSaved(`Moved money to ${toAccount.name}`);
      } else if (mode === 'expense' || mode === 'income') {
        // Narrowed explicitly rather than relying on the `isMoneyMode` guard
        // above — that is a boolean, not a type predicate, so TypeScript still
        // sees the full five-mode union here.
        await createTransaction.mutateAsync({
          accountId: fromAccount.id,
          amountMinor: amountMinor!,
          type: mode,
          classification: mode === 'expense' ? classification : null,
          categoryId: category?.id ?? null,
          description: description || null,
          date,
        });
        onSaved(mode === 'income' ? 'Income added' : 'Expense added');
      }
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? `Savi couldn't save that. ${e.message}`
          : "Savi couldn't save that right now."
      );
    }
  }

  return (
    <GlassSheet
      visible={visible}
      onClose={onClose}
      title="Add"
      footer={
        <View style={{ gap: space[3] }}>
          {error && (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          )}
          <Button
            label="Save"
            block
            onPress={save}
            disabled={!canSave}
            loading={createTransaction.isPending || createTransfer.isPending}
          />
        </View>
      }
    >
      {/* P§9's five options. Two rows so each label stays readable at 320px
          rather than five columns of truncated text. */}
      <Segmented<Mode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
          { value: 'transfer', label: 'Transfer' },
        ]}
      />
      <Segmented<Mode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'task', label: 'Task' },
          { value: 'event', label: 'Event' },
        ]}
      />

      {/* ── First level (D§60) ──────────────────────────────────────────── */}
      {isMoneyMode && <MoneyInput value={amount} onChangeText={setAmount} autoFocus />}

      <Input
        label={
          mode === 'income'
            ? 'Where from?'
            : mode === 'task'
              ? 'What needs doing?'
              : mode === 'event'
                ? 'What is it?'
                : 'What was it?'
        }
        value={description}
        onChangeText={setDescription}
        autoFocus={!isMoneyMode}
        placeholder={
          mode === 'income'
            ? 'Salary'
            : mode === 'task'
              ? 'Pay the internet bill'
              : mode === 'event'
                ? 'Meeting, gym, deadline…'
                : 'Lunch, Grab, groceries…'
        }
      />

      {mode === 'task' && (
        <View style={{ gap: space[2] }}>
          <Text variant="label" tone="secondary">
            Priority
          </Text>
          <Segmented<TaskPriority>
            value={priority}
            onChange={setPriority}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' },
            ]}
          />
        </View>
      )}

      {mode === 'event' && (
        <View style={{ gap: space[2] }}>
          <Text variant="label" tone="secondary">
            Kind
          </Text>
          <ChipRow>
            {(['personal', 'work', 'appointment', 'deadline'] as EventKind[]).map((k) => (
              <Chip
                key={k}
                label={`${k[0].toUpperCase()}${k.slice(1)}`}
                selected={k === eventKind}
                onPress={() => setEventKind(k)}
              />
            ))}
          </ChipRow>
        </View>
      )}

      {!isMoneyMode && (
        <Input
          label={mode === 'task' ? 'Due date' : 'Date'}
          value={date}
          onChangeText={setDate}
          placeholder={todayISO()}
          hint={mode === 'task' ? 'Optional — shows on your calendar' : undefined}
        />
      )}

      {mode === 'transfer' && (
        <View style={{ gap: space[2] }}>
          <Text variant="label" tone="secondary">
            To account
          </Text>
          {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
          <ChipRow>
            {accounts
              .filter((a) => a.id !== fromAccount?.id)
              .map((a) => (
                <Chip
                  key={a.id}
                  // Disambiguated against the FULL list, not the filtered one:
                  // hiding the source account could make a duplicate name look
                  // unique here while it is ambiguous in the picker above.
                  label={accountLabel(a, accounts)}
                  selected={a.id === toAccountId}
                  onPress={() => setToAccountId(a.id)}
                />
              ))}
          </ChipRow>
        </View>
      )}

      {/* Savi's guess, visible and correctable in one tap (P§61). */}
      {mode === 'expense' && (
        <View style={{ gap: space[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Text variant="label" tone="secondary">
              Classification
            </Text>
            {inference.source !== 'default' && !classificationOverride && (
              <Text variant="micro" tone="brand">
                {inference.source === 'history' ? 'from your history' : 'suggested'}
              </Text>
            )}
          </View>
          <Segmented<Classification>
            value={classification}
            onChange={setClassificationOverride}
            options={CLASSIFICATIONS}
          />
        </View>
      )}

      {/* ── Second level (D§60) ─────────────────────────────────────────── */}
      <Disclosure
        label="More details"
        open={showDetails}
        onToggle={() => setShowDetails((v) => !v)}
      >
        <View style={{ gap: space[2] }}>
          <Text variant="label" tone="secondary">
            {mode === 'transfer' ? 'From account' : 'Account'}
          </Text>
          <ChipRow>
            {accounts.map((a) => (
              <Chip
                key={a.id}
                label={accountLabel(a, accounts)}
                selected={a.id === (accountId ?? defaultAccount?.id)}
                onPress={() => setAccountId(a.id)}
              />
            ))}
          </ChipRow>
        </View>

        {mode === 'expense' && (
          <View style={{ gap: space[2] }}>
            <Text variant="label" tone="secondary">
              Category
            </Text>
            <ChipRow>
              {categories.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  selected={c.slug === categorySlug}
                  dotColor={
                    c.slug ? theme.categoryColor((c.slug as CategoryName) ?? 'other') : undefined
                  }
                  onPress={() => setCategoryOverride(c.slug)}
                />
              ))}
            </ChipRow>
          </View>
        )}

        <Input
          label="Date"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          hint="Defaults to today"
        />
      </Disclosure>
    </GlassSheet>
  );
}
