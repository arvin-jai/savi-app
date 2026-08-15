/**
 * Onboarding (P§34) — what makes the app useful in the first five minutes
 * instead of presenting an empty dashboard.
 *
 *   welcome → account → monthly income → recurring bills → ready
 *
 * **The two bookend steps are the point, not decoration.** The middle three
 * collect data, and a screen that only collects data reads as a form — which is
 * exactly what a money app has to avoid, because the user arrived apprehensive
 * about their money, not eager to do data entry. So:
 *
 *   - `welcome` states what Savi is *for* before asking for anything. It is the
 *     only screen with no input on it, and that is deliberate: the first thing
 *     the user does here is agree to start, not type.
 *   - `ready` reads back what they told Savi and turns it into the questions it
 *     can now answer. That is what makes the three middle steps feel like they
 *     bought something. Skipping is still fine — the recap only claims what was
 *     actually entered.
 *
 * Every step past the account is skippable: P§9's philosophy is minimum input,
 * and someone who only creates an account still lands on a working dashboard.
 * The income and bills they DO enter are exactly what the welcome insight
 * (rules.ts) turns into the P§34 closing message.
 */

import { router } from 'expo-router';
import { CalendarClock, PiggyBank, Sparkles, Wallet } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
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
import { hapticCelebrate, hapticStep } from '@/lib/haptics';
import { formatMoney, parseMoney } from '@/lib/money';
import { qk } from '@/lib/queryClient';
import { HOME } from '@/lib/routes';
import { useTheme } from '@/theme/ThemeProvider';
import { iconSize, layout, radius, space } from '@/theme/tokens';

type Step = 'welcome' | 'account' | 'income' | 'bills' | 'ready';

/**
 * Only the steps that ask for something are counted. `welcome` and `ready` are
 * the frame around the journey, and numbering them would make the whole thing
 * read as five forms instead of three questions.
 */
const COUNTED: Step[] = ['account', 'income', 'bills'];

const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];

export default function Onboarding() {
  const qc = useQueryClient();
  const createAccount = useCreateAccount();
  const createIncome = useCreateRecurringIncome();
  const createBill = useCreateBill();
  const { data: bills = [] } = useBills();

  const [step, setStep] = useState<Step>('welcome');
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  // Step 1 — account
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('cash');
  const [opening, setOpening] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);

  // Step 2 — income
  const [income, setIncome] = useState('');
  const [payday, setPayday] = useState('15');
  const [savedIncomeMinor, setSavedIncomeMinor] = useState<number | null>(null);

  // Step 3 — bills
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDay, setBillDay] = useState('15');

  function go(next: Step) {
    setError(null);
    hapticStep();
    setStep(next);
  }

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
      go('income');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create that account.');
    }
  }

  async function saveIncome() {
    setError(null);
    const amountMinor = parseMoney(income);
    const day = Number(payday);

    if (!amountMinor || amountMinor <= 0) return go('bills'); // treat empty as skip
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      return setError('Payday must be a day between 1 and 31.');
    }
    if (!accountId) return go('bills');

    try {
      await createIncome.mutateAsync({ amountMinor, dayOfMonth: day, accountId });
      setSavedIncomeMinor(amountMinor);
      go('bills');
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
      hapticStep();
      setBillName('');
      setBillAmount('');
      setBillDay('15');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add that bill.');
    }
  }

  function reachReady() {
    setError(null);
    hapticCelebrate();
    setStep('ready');
  }

  /**
   * Wait for the accounts cache to actually hold the new account before
   * navigating.
   *
   * The dashboard sends anyone with zero accounts straight back here, and the
   * cached `[]` from before onboarding stays readable until the invalidated
   * refetch lands. The dashboard now also guards on `isFetching`, so this is
   * belt and braces — but it is the half that removes the race outright rather
   * than narrowing it, and a user bounced back into onboarding they just
   * finished has no way to understand what happened.
   */
  async function finish() {
    setLeaving(true);
    try {
      await qc.refetchQueries({ queryKey: qk.accounts });
    } catch {
      // A failed refetch is not a reason to trap the user on this screen; the
      // dashboard will retry on mount.
    }
    router.replace(HOME);
  }

  const stepIndex = COUNTED.indexOf(step);

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
          {stepIndex >= 0 && <StepProgress index={stepIndex} total={COUNTED.length} />}

          {step === 'welcome' && (
            <>
              <View style={{ gap: space[3] }}>
                <Text variant="h1">Money and time, on one screen.</Text>
                <Text variant="body" tone="secondary">
                  Most budget apps can tell you what you spent. None of them know your rent is
                  due Friday — so none of them can answer the only question that matters.
                </Text>
              </View>

              <GlassCard variant="subtle" padding="lg" style={{ gap: space[4] }}>
                <Pillar
                  icon={Wallet}
                  title="What's actually yours to spend"
                  body="Your balance, minus what's already committed. Not the same number your bank shows you."
                />
                <Pillar
                  icon={CalendarClock}
                  title="Before it catches you out"
                  body="Bills and paydays sit on the same calendar as the rest of your week."
                />
                <Pillar
                  icon={PiggyBank}
                  title="Three questions, then you're in"
                  body="Skip anything you're not sure about. You can add it later, and nothing here is locked in."
                />
              </GlassCard>

              <Button label="Let's set it up" block onPress={() => go('account')} />
            </>
          )}

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
              <Button label="Skip for now" variant="ghost" block onPress={() => go('bills')} />
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
                label={bills.length > 0 ? "That's all of them" : 'Skip for now'}
                block
                onPress={reachReady}
              />
            </>
          )}

          {step === 'ready' && (
            <Ready
              accountName={accountName || 'Cash'}
              openingMinor={parseMoney(opening) ?? 0}
              incomeMinor={savedIncomeMinor}
              billCount={bills.length}
              billsTotalMinor={bills.reduce((sum, b) => sum + b.amount_minor, 0)}
              leaving={leaving}
              onFinish={finish}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/**
 * Three dots, not "Step 2 of 3".
 *
 * The number is a countdown the user has to hold in their head; the dots are
 * peripheral. Filled/unfilled is not carried by colour alone — the completed
 * dots are wider as well, which is what keeps this inside D§44.
 */
function StepProgress({ index, total }: { index: number; total: number }) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${index + 1} of ${total}`}
      style={{ flexDirection: 'row', gap: space[2], alignSelf: 'center' }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            height: 6,
            width: i <= index ? 28 : 12,
            borderRadius: radius.full,
            backgroundColor: i <= index ? theme.color.brand : theme.color.border,
          }}
        />
      ))}
    </View>
  );
}

function Pillar({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Wallet;
  title: string;
  body: string;
}) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: space[3] }}>
      <Icon size={iconSize.lg} color={theme.color.brand} />
      <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
        <Text variant="body" weight="600">
          {title}
        </Text>
        <Text variant="caption" tone="secondary">
          {body}
        </Text>
      </View>
    </View>
  );
}

/**
 * The closing step. Reads back only what was actually entered, then names the
 * questions Savi can now answer — the recap is what turns three forms into
 * something the user got in return for filling them in.
 */
function Ready({
  accountName,
  openingMinor,
  incomeMinor,
  billCount,
  billsTotalMinor,
  leaving,
  onFinish,
}: {
  accountName: string;
  openingMinor: number;
  incomeMinor: number | null;
  billCount: number;
  billsTotalMinor: number;
  leaving: boolean;
  onFinish: () => void;
}) {
  const theme = useTheme();

  const facts: string[] = [
    openingMinor > 0
      ? `${accountName} — ${formatMoney(openingMinor)} to start`
      : `${accountName} is set up`,
  ];
  if (incomeMinor !== null) facts.push(`${formatMoney(incomeMinor)} coming in each month`);
  if (billCount > 0) {
    facts.push(
      `${billCount} ${billCount === 1 ? 'bill' : 'bills'} worth ${formatMoney(billsTotalMinor)}`
    );
  }

  return (
    <>
      <View style={{ alignItems: 'center', gap: space[4] }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            // A11's tint range. Decoration behind an icon, never behind text.
            backgroundColor: `${theme.color.brand}26`,
          }}
        >
          <Sparkles size={iconSize.hero} color={theme.color.brand} />
        </View>

        <View style={{ gap: space[2] }}>
          <Text variant="h1" style={{ textAlign: 'center' }}>
            You&apos;re set up.
          </Text>
          <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
            That&apos;s everything Savi needs to start being useful.
          </Text>
        </View>
      </View>

      <GlassCard variant="subtle" padding="lg" style={{ gap: space[3] }}>
        <Text variant="label" tone="secondary">
          What you told Savi
        </Text>
        {facts.map((f) => (
          <Text key={f} variant="body">
            · {f}
          </Text>
        ))}
      </GlassCard>

      <GlassCard variant="subtle" padding="lg" style={{ gap: space[3] }}>
        <Text variant="label" tone="brand">
          What it can answer now
        </Text>
        <Text variant="body">· Can I afford this right now?</Text>
        <Text variant="body">· What&apos;s left after everything that&apos;s already owed?</Text>
        <Text variant="body">· What&apos;s coming this week?</Text>
      </GlassCard>

      <Button label="Show me my dashboard" block loading={leaving} onPress={onFinish} />
    </>
  );
}
