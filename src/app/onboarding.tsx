/**
 * Onboarding (P§34) — what makes the app useful in the first five minutes
 * instead of presenting an empty dashboard.
 *
 *   account → monthly income → recurring bills → dashboard + first insight
 *
 * Every step past the first is skippable: P§9's philosophy is minimum input,
 * and someone who only creates an account still lands on a working dashboard.
 * The income and bills they DO enter are exactly what the welcome insight
 * (rules.ts) turns into the P§34 closing message.
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/AmbientBackground';
import { GlassCard } from '@/components/glass/GlassCard';
import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/controls';
import { Text } from '@/components/ui/Text';
import { Input, MoneyInput } from '@/components/ui/Input';
import { ACCOUNT_TYPE_LABELS, useCreateAccount } from '@/features/accounts/api';
import { useBills, useCreateBill } from '@/features/bills/api';
import { useCreateRecurringIncome } from '@/features/insights/api';
import type { AccountType } from '@/lib/database.types';
import { formatMoney, parseMoney } from '@/lib/money';
import { HOME } from '@/lib/routes';
import { layout, space } from '@/theme/tokens';

type Step = 'account' | 'income' | 'bills';

const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];

export default function Onboarding() {
  const createAccount = useCreateAccount();
  const createIncome = useCreateRecurringIncome();
  const createBill = useCreateBill();
  const { data: bills = [] } = useBills();

  const [step, setStep] = useState<Step>('account');
  const [error, setError] = useState<string | null>(null);

  // Step 1 — account
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('cash');
  const [opening, setOpening] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);

  // Step 2 — income
  const [income, setIncome] = useState('');
  const [payday, setPayday] = useState('15');

  // Step 3 — bills
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDay, setBillDay] = useState('15');

  async function saveAccount() {
    setError(null);
    const openingMinor = parseMoney(opening) ?? 0;
    try {
      const account = await createAccount.mutateAsync({
        name: accountName || 'Cash',
        type: accountType,
        openingBalanceMinor: openingMinor > 0 ? openingMinor : undefined,
        isDefault: true,
      });
      setAccountId(account.id);
      setStep('income');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create that account.');
    }
  }

  async function saveIncome() {
    setError(null);
    const amountMinor = parseMoney(income);
    const day = Number(payday);

    if (!amountMinor || amountMinor <= 0) return setStep('bills'); // treat empty as skip
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      return setError('Payday must be a day between 1 and 31.');
    }
    if (!accountId) return setStep('bills');

    try {
      await createIncome.mutateAsync({ amountMinor, dayOfMonth: day, accountId });
      setStep('bills');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that.');
    }
  }

  async function addBill() {
    setError(null);
    const amountMinor = parseMoney(billAmount);
    const day = Number(billDay);

    if (!billName.trim() || !amountMinor || amountMinor <= 0) return;
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      return setError('Due day must be between 1 and 31.');
    }

    try {
      await createBill.mutateAsync({
        name: billName,
        amountMinor,
        dueDay: day,
        accountId,
      });
      setBillName('');
      setBillAmount('');
      setBillDay('15');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add that bill.');
    }
  }

  function finish() {
    router.replace(HOME);
  }

  return (
    <View style={{ flex: 1 }}>
      <AmbientBackground />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: layout.pagePaddingMobile,
            gap: space[5],
            maxWidth: 440,
            width: '100%',
            alignSelf: 'center',
          }}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'account' && (
            <>
              <View style={{ gap: space[2] }}>
                <Text variant="h1">Where does your money live?</Text>
                <Text variant="body" tone="secondary">
                  Start with the account you use most. You can add the rest later.
                </Text>
              </View>

              <Input
                label="Name"
                value={accountName}
                onChangeText={setAccountName}
                placeholder="Cash, BPI, GCash…"
                autoFocus
              />

              <View style={{ gap: space[2] }}>
                <Text variant="label" tone="secondary">
                  Type
                </Text>
                <ChipRow>
                  {ACCOUNT_TYPES.map((t) => (
                    <Chip
                      key={t}
                      label={ACCOUNT_TYPE_LABELS[t]}
                      selected={t === accountType}
                      onPress={() => setAccountType(t)}
                    />
                  ))}
                </ChipRow>
              </View>

              <MoneyInput label="What's in it right now?" value={opening} onChangeText={setOpening} />

              {error && (
                <Text variant="caption" tone="danger">
                  {error}
                </Text>
              )}

              <Button
                label="Continue"
                block
                loading={createAccount.isPending}
                disabled={accountName.trim().length === 0 || createAccount.isPending}
                onPress={saveAccount}
              />
            </>
          )}

          {step === 'income' && (
            <>
              <View style={{ gap: space[2] }}>
                <Text variant="h1">What do you earn monthly?</Text>
                <Text variant="body" tone="secondary">
                  Savi uses this to work out what&apos;s yours to plan after bills. A rough
                  figure is fine.
                </Text>
              </View>

              <MoneyInput value={income} onChangeText={setIncome} autoFocus />

              <Input
                label="Which day do you usually get paid?"
                value={payday}
                onChangeText={setPayday}
                keyboardType="number-pad"
              />

              {error && (
                <Text variant="caption" tone="danger">
                  {error}
                </Text>
              )}

              <Button
                label="Continue"
                block
                loading={createIncome.isPending}
                onPress={saveIncome}
              />
              <Button label="Skip for now" variant="ghost" block onPress={() => setStep('bills')} />
            </>
          )}

          {step === 'bills' && (
            <>
              <View style={{ gap: space[2] }}>
                <Text variant="h1">Any regular bills?</Text>
                <Text variant="body" tone="secondary">
                  Rent, internet, electricity — Savi subtracts what&apos;s coming from what you
                  can spend, and reminds you before they&apos;re due.
                </Text>
              </View>

              {bills.length > 0 && (
                <View style={{ gap: space[2] }}>
                  {bills.map((b) => (
                    <GlassCard
                      key={b.id}
                      variant="subtle"
                      padding="md"
                      style={{ flexDirection: 'row', justifyContent: 'space-between' }}
                    >
                      <Text variant="body" weight="500">
                        {b.name}
                      </Text>
                      <Text variant="body" weight="600">
                        {formatMoney(b.amount_minor)}
                      </Text>
                    </GlassCard>
                  ))}
                </View>
              )}

              <Input
                label="What is it?"
                value={billName}
                onChangeText={setBillName}
                placeholder="Internet, Rent…"
              />
              <MoneyInput value={billAmount} onChangeText={setBillAmount} />
              <Input
                label="Due day of the month"
                value={billDay}
                onChangeText={setBillDay}
                keyboardType="number-pad"
              />

              {error && (
                <Text variant="caption" tone="danger">
                  {error}
                </Text>
              )}

              <Button
                label="Add this bill"
                variant="secondary"
                block
                loading={createBill.isPending}
                disabled={billName.trim().length === 0 || createBill.isPending}
                onPress={addBill}
              />
              <Button
                label={bills.length > 0 ? "Done — show me Savi" : 'Skip for now'}
                block
                onPress={finish}
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
