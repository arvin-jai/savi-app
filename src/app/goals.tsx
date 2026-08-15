/**
 * Savings goals (P§25), with D§39 progress bars.
 *
 * D§62: one primary action — "+ Create Goal".
 * D§64: quiet encouragement, never gamification. No streaks, no trophies.
 *
 * Adding to a goal records money the user has already set aside. It does NOT
 * move money between accounts — see `useAddToGoal` for why.
 */

import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/AmbientBackground';
import { GlassCard } from '@/components/glass/GlassCard';
import { GlassSheet } from '@/components/glass/GlassSheet';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Celebration } from '@/components/ui/Celebration';
import { EmptyState, Skeleton, StatusPill, Toast } from '@/components/ui/feedback';
import { Input, MoneyInput } from '@/components/ui/Input';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import {
  useAddToGoal,
  useCreateGoal,
  useDeleteGoal,
  useGoals,
} from '@/features/goals/api';
import {
  GOAL_STATUS_META,
  goalEncouragement,
  goalProgress,
  goalStatus,
  monthsUntil,
  recommendedMonthlyMinor,
} from '@/features/goals/goals';
import type { FinancialGoal } from '@/lib/database.types';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { formatMoney, parseMoney } from '@/lib/money';
import { layout, space } from '@/theme/tokens';
import { useBreakpoint, useScrollBottomInset } from '@/theme/useBreakpoint';

export default function GoalsScreen() {
  const { pagePadding } = useBreakpoint();
  const bottomInset = useScrollBottomInset();

  const { data: goals = [], isLoading } = useGoals();
  const create = useCreateGoal();
  const addTo = useAddToGoal();
  const remove = useDeleteGoal();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const [contributing, setContributing] = useState<FinancialGoal | null>(null);
  const [contribution, setContribution] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<FinancialGoal | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reached, setReached] = useState<string | null>(null);

  function createGoal() {
    const targetMinor = parseMoney(target);
    if (!name.trim()) return setToast('Give your goal a name');
    if (targetMinor === null || targetMinor <= 0) return setToast('Set an amount to aim for');

    // An empty date means no deadline, which is a valid goal — the UI then
    // says there is no monthly figure rather than inventing one.
    const date = /^\d{4}-\d{2}-\d{2}$/.test(targetDate.trim()) ? targetDate.trim() : null;

    create.mutate(
      { name, targetMinor, savedMinor: parseMoney(saved) ?? 0, targetDate: date },
      {
        onSuccess: () => {
          setAdding(false);
          setName('');
          setTarget('');
          setSaved('');
          setTargetDate('');
          setToast('Goal created');
        },
        onError: () => setToast('Could not create that goal'),
      }
    );
  }

  function addContribution() {
    if (!contributing) return;
    const amountMinor = parseMoney(contribution);
    if (amountMinor === null || amountMinor === 0) return setToast('Enter an amount');

    const goal = contributing;
    // Crossing the line, not sitting on it: a contribution to an already-reached
    // goal should not re-fire the celebration every time.
    const crossesTarget =
      goal.saved_minor < goal.target_minor &&
      goal.saved_minor + amountMinor >= goal.target_minor;

    addTo.mutate(
      { goal, amountMinor },
      {
        onSuccess: () => {
          setContributing(null);
          setContribution('');
          if (crossesTarget) {
            // A goal reaching its target is the milestone; every other
            // contribution is a toast. See Celebration.tsx's scarcity rule.
            setReached(goal.name);
          } else {
            hapticSuccess();
            setToast('Progress updated');
          }
        },
        onError: () => {
          hapticError();
          setToast('Could not update that goal');
        },
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
          <ScreenHeader title="Goals" />

          {isLoading && <Skeleton height={160} />}

          {!isLoading && goals.length === 0 && (
            <EmptyState
              title="No goals yet"
              body="Set something you're saving towards and Savi will work out what to put aside each month."
            />
          )}

          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onAdd={() => {
                setContributing(goal);
                setContribution('');
              }}
              onDelete={() => setConfirmDelete(goal)}
            />
          ))}

          <Button label="+ Create goal" block onPress={() => setAdding(true)} />
        </ScrollView>
      </SafeAreaView>

      {/* ── Create ─────────────────────────────────────────────────────── */}
      <GlassSheet
        visible={adding}
        onClose={() => setAdding(false)}
        title="Create a goal"
        footer={
          <Button label="Create goal" block loading={create.isPending} onPress={createGoal} />
        }
      >
        <View style={{ gap: space[4] }}>
          <Input
            label="What are you saving for?"
            value={name}
            onChangeText={setName}
            placeholder="Emergency fund, laptop…"
          />
          <MoneyInput label="Amount to reach" value={target} onChangeText={setTarget} />
          <MoneyInput label="Already saved (optional)" value={saved} onChangeText={setSaved} />
          <Input
            label="Target date (optional)"
            value={targetDate}
            onChangeText={setTargetDate}
            placeholder="2026-12-31"
            hint="Leave blank if there's no deadline — Savi just won't suggest a monthly amount."
          />
        </View>
      </GlassSheet>

      {/* ── Contribute ─────────────────────────────────────────────────── */}
      <GlassSheet
        visible={contributing !== null}
        onClose={() => setContributing(null)}
        title={contributing ? `Add to ${contributing.name}` : ''}
        footer={
          <Button
            label="Update progress"
            block
            loading={addTo.isPending}
            onPress={addContribution}
          />
        }
      >
        <View style={{ gap: space[3] }}>
          <MoneyInput
            label="How much have you put aside?"
            value={contribution}
            onChangeText={setContribution}
            autoFocus
          />
          <Text variant="caption" tone="secondary">
            This records progress towards the goal. It doesn&apos;t move money between your
            accounts — if you want to do that too, use Add on the Money screen.
          </Text>
        </View>
      </GlassSheet>

      {/* ── Delete (D§59: destructive, so it is confirmed) ─────────────── */}
      <GlassSheet
        visible={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete this goal?"
        footer={
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <Button
              label="Delete"
              variant="danger"
              onPress={() => {
                if (confirmDelete) remove.mutate(confirmDelete.id);
                setConfirmDelete(null);
                setToast('Goal deleted');
              }}
            />
            <Button label="Keep it" variant="ghost" onPress={() => setConfirmDelete(null)} />
          </View>
        }
      >
        <Text variant="body" tone="secondary">
          {confirmDelete
            ? `"${confirmDelete.name}" and its progress will be removed. Your money isn't affected — this is only the goal.`
            : ''}
        </Text>
      </GlassSheet>

      <Toast visible={!!toast} message={toast ?? ''} onDismiss={() => setToast(null)} />

      <Celebration
        visible={!!reached}
        title="Goal reached 🎉"
        body={reached ? `You saved everything you set out to for ${reached}.` : undefined}
        onDismiss={() => setReached(null)}
      />
    </View>
  );
}

function GoalCard({
  goal,
  onAdd,
  onDelete,
}: {
  goal: FinancialGoal;
  onAdd: () => void;
  onDelete: () => void;
}) {
  const progress = goalProgress(goal);
  const status = goalStatus(goal);
  const meta = GOAL_STATUS_META[status];
  const recommended = recommendedMonthlyMinor(goal);
  const encouragement = goalEncouragement(goal);

  return (
    <GlassCard padding="lg" style={{ gap: space[3] }}>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Text variant="h4">{goal.name}</Text>
        <StatusPill tone={meta.tone} label={meta.label} />
      </View>

      <Text variant="displayMd">{formatMoney(goal.target_minor)}</Text>

      <ProgressBar
        ratio={progress.ratio}
        tone={progress.achieved ? 'income' : 'brand'}
        accessibilityLabel={`${progress.percent}% saved — ${formatMoney(
          goal.saved_minor
        )} of ${formatMoney(goal.target_minor)}`}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="bodySm" tone="secondary">
          {formatMoney(goal.saved_minor)} saved
        </Text>
        <Text variant="bodySm" tone="secondary">
          {progress.percent}%
        </Text>
      </View>

      {/* The recommendation is arithmetic, not advice. */}
      {recommended !== null && goal.target_date && (
        <Text variant="bodySm" tone="secondary">
          About {formatMoney(recommended)} a month to reach it by {goal.target_date} —{' '}
          {monthsUntil(goal.target_date)} months to go.
        </Text>
      )}

      {recommended === null && !progress.achieved && goal.target_date && (
        // The honest answer for a passed deadline, stated rather than dressed
        // up as a monthly plan.
        <Text variant="bodySm" tone="secondary">
          {formatMoney(progress.remainingMinor)} still to go, and the target date has passed.
        </Text>
      )}

      {recommended === null && !progress.achieved && !goal.target_date && (
        <Text variant="bodySm" tone="secondary">
          {formatMoney(progress.remainingMinor)} to go. Set a date and Savi can suggest a
          monthly amount.
        </Text>
      )}

      {encouragement && (
        <Text variant="bodySm" tone="income">
          {encouragement}
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <Button label="Add progress" size="sm" onPress={onAdd} />
        <Button label="Delete" variant="ghost" size="sm" onPress={onDelete} />
      </View>
    </GlassCard>
  );
}
