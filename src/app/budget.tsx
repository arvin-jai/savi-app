/**
 * Budget (P§24) — the Income → Bills → Needs → Wants → Savings waterfall.
 *
 * D§62: one primary action — set or update the plan.
 * D§63: the headline observes, it never judges.
 *
 * The screen shows PLANNED against ACTUAL for each step. Bills is rendered as a
 * fact rather than an editable field, because it is derived from the bills
 * table and is not an allocation the user chooses.
 */

import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/AmbientBackground';
import { GlassCard } from '@/components/glass/GlassCard';
import { GlassSheet } from '@/components/glass/GlassSheet';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Divider, EmptyState, Skeleton, StatusPill, Toast } from '@/components/ui/feedback';
import { MoneyInput } from '@/components/ui/Input';
import { ProgressBar, type ProgressTone } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { useUpsertBudget, useWaterfall } from '@/features/budgets/api';
import { suggestPlan, waterfallHeadline, type WaterfallStep } from '@/features/budgets/waterfall';
import { formatMoney, parseMoney } from '@/lib/money';
import { layout, space } from '@/theme/tokens';
import { useBreakpoint, useScrollBottomInset } from '@/theme/useBreakpoint';

/**
 * D§44 — never colour alone, so every state carries a label and the label is
 * the accessible signal.
 *
 * `over` is amber, not red. Being above a self-set plan is not a failure, and
 * red would be the alarm D§63 forbids — red is reserved for overdue bills and
 * genuinely destructive things.
 */
const STEP_META: Record<WaterfallStep['status'], { tone: ProgressTone; label: string }> = {
  under: { tone: 'brand', label: 'On plan' },
  near: { tone: 'bill', label: 'Nearly there' },
  over: { tone: 'bill', label: 'Above plan' },
  unplanned: { tone: 'brand', label: 'No plan set' },
};

export default function BudgetScreen() {
  const { pagePadding } = useBreakpoint();
  const bottomInset = useScrollBottomInset();

  const { waterfall, budget, isLoading } = useWaterfall();
  const upsert = useUpsertBudget();

  const [editing, setEditing] = useState(false);
  const [income, setIncome] = useState('');
  const [needs, setNeeds] = useState('');
  const [wants, setWants] = useState('');
  const [savings, setSavings] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Seed the form from the saved plan once it loads, so opening the sheet
  // shows what is currently set rather than empty fields.
  useEffect(() => {
    if (!budget) return;
    setIncome(String(budget.income_minor / 100));
    setNeeds(String(budget.needs_minor / 100));
    setWants(String(budget.wants_minor / 100));
    setSavings(String(budget.savings_minor / 100));
  }, [budget]);

  function applySuggestion() {
    if (!waterfall) return;
    const incomeMinor = parseMoney(income) ?? waterfall.incomeMinor;
    const plan = suggestPlan(incomeMinor, waterfall.steps[0].plannedMinor);
    if (!plan) {
      setToast('Your bills already use up that income');
      return;
    }
    setNeeds(String(plan.needsMinor / 100));
    setWants(String(plan.wantsMinor / 100));
    setSavings(String(plan.savingsMinor / 100));
  }

  function save() {
    const incomeMinor = parseMoney(income);
    if (incomeMinor === null || incomeMinor < 0) {
      setToast('Enter the income you expect this month');
      return;
    }

    upsert.mutate(
      {
        incomeMinor,
        needsMinor: parseMoney(needs) ?? 0,
        wantsMinor: parseMoney(wants) ?? 0,
        savingsMinor: parseMoney(savings) ?? 0,
      },
      {
        onSuccess: () => {
          setEditing(false);
          setToast('Plan saved');
        },
        onError: () => setToast('Could not save that plan'),
      }
    );
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
          <ScreenHeader title="Budget" />

          {isLoading && <Skeleton height={200} />}

          {!isLoading && waterfall && (
            <>
              {/* The one thought, in D§63's voice. */}
              <GlassCard padding="lg" style={{ gap: space[2] }}>
                <Text variant="bodyLg" weight="500">
                  {waterfallHeadline(waterfall)}
                </Text>

                <Divider />

                <Row label="Expected income" value={formatMoney(waterfall.incomeMinor)} />
                <Row
                  label={waterfall.overAllocated ? 'Over-allocated by' : 'Not yet allocated'}
                  value={formatMoney(Math.abs(waterfall.unallocatedMinor))}
                  tone={waterfall.overAllocated ? 'danger' : 'secondary'}
                />
              </GlassCard>

              {waterfall.steps.map((step) => (
                <StepCard key={step.key} step={step} />
              ))}

              <Button
                label={budget ? 'Update plan' : 'Set a plan'}
                block
                onPress={() => setEditing(true)}
              />

              <Text variant="caption" tone="secondary">
                Bills come out first and aren&apos;t part of the plan — Savi takes that figure
                from your bills, so the two can&apos;t disagree.
              </Text>
            </>
          )}

          {!isLoading && !waterfall && (
            <EmptyState
              title="No budget yet"
              body="Add some income and bills first, then Savi can show you where your money is going."
            />
          )}
        </ScrollView>
      </SafeAreaView>

      <GlassSheet
        visible={editing}
        onClose={() => setEditing(false)}
        title={budget ? 'Update your plan' : 'Set your plan'}
        footer={
          <Button label="Save plan" block loading={upsert.isPending} onPress={save} />
        }
      >
        <View style={{ gap: space[4] }}>
          <MoneyInput label="Income you expect" value={income} onChangeText={setIncome} />

          <Button
            label="Suggest a split for me"
            variant="secondary"
            size="sm"
            onPress={applySuggestion}
          />
          <Text variant="caption" tone="secondary">
            A 50 / 30 / 20 starting point after bills. It&apos;s a starting point, not advice —
            change it to whatever fits your life.
          </Text>

          <MoneyInput label="Needs" value={needs} onChangeText={setNeeds} />
          <MoneyInput label="Wants" value={wants} onChangeText={setWants} />
          <MoneyInput label="Savings" value={savings} onChangeText={setSavings} />
        </View>
      </GlassSheet>

      <Toast visible={!!toast} message={toast ?? ''} onDismiss={() => setToast(null)} />
    </View>
  );
}

function StepCard({ step }: { step: WaterfallStep }) {
  const meta = STEP_META[step.status];

  return (
    <GlassCard padding="lg" style={{ gap: space[3] }}>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Text variant="h4">{step.label}</Text>
        {/* D§44: the label is the signal, the colour is on top of it. */}
        <StatusPill tone={meta.tone === 'brand' ? 'info' : 'bill'} label={meta.label} />
      </View>

      <ProgressBar
        ratio={step.ratio ?? 0}
        tone={meta.tone}
        accessibilityLabel={`${step.label}: ${formatMoney(step.actualMinor)} of ${formatMoney(
          step.plannedMinor
        )}`}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="bodySm" tone="secondary">
          {formatMoney(step.actualMinor)} of {formatMoney(step.plannedMinor)}
        </Text>
        <Text variant="bodySm" tone={step.remainingMinor < 0 ? 'bill' : 'secondary'}>
          {step.remainingMinor >= 0
            ? `${formatMoney(step.remainingMinor)} left`
            : `${formatMoney(Math.abs(step.remainingMinor))} over`}
        </Text>
      </View>

      {step.derived && (
        <Text variant="caption" tone="secondary">
          From your bills — not something you allocate.
        </Text>
      )}
    </GlassCard>
  );
}

function Row({
  label,
  value,
  tone = 'secondary',
}: {
  label: string;
  value: string;
  tone?: 'secondary' | 'danger';
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant="body" tone="secondary">
        {label}
      </Text>
      <Text variant="body" weight="600" tone={tone === 'danger' ? 'danger' : 'primary'}>
        {value}
      </Text>
    </View>
  );
}
