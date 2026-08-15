/**
 * Tasks (P§17) — reached from More, per the A13 IA decision.
 *
 * D§59: completing a task needs no confirmation (it toggles back); deleting
 * one does. D§62: one primary action — "+ Add Task".
 */

import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/AmbientBackground';
import { GlassCard } from '@/components/glass/GlassCard';
import { GlassSheet } from '@/components/glass/GlassSheet';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Celebration } from '@/components/ui/Celebration';
import { Chip, ChipRow } from '@/components/ui/controls';
import { EmptyState, Skeleton, StatusPill, Toast } from '@/components/ui/feedback';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import {
  useCreateTask,
  useDeleteTask,
  useTasks,
  useToggleTask,
} from '@/features/calendar/api';
import type { Task, TaskPriority } from '@/lib/database.types';
import { dueLabel, todayISO } from '@/lib/dates';
import { hapticError, hapticStep } from '@/lib/haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { a11y, layout, radius, space } from '@/theme/tokens';
import { useBreakpoint, useScrollBottomInset } from '@/theme/useBreakpoint';

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function Tasks() {
  const { pagePadding } = useBreakpoint();
  const bottomInset = useScrollBottomInset();

  const { data: tasks = [], isLoading } = useTasks();
  const create = useCreateTask();
  const toggle = useToggleTask();
  const remove = useDeleteTask();

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Task | null>(null);
  const [clearedList, setClearedList] = useState(false);

  const open = tasks.filter((t) => t.status === 'todo');
  const done = tasks.filter((t) => t.status === 'done');

  /**
   * Ticking a task off gets a haptic and nothing more. Per Celebration.tsx's
   * scarcity rule this happens several times a day, so the reward is the one
   * that costs no screen and no attention — clearing the *last* one gets the
   * card, because an empty to-do list is the thing that doesn't happen daily.
   */
  function toggleTask(t: Task) {
    const completing = t.status === 'todo';
    const wasLastOpen = completing && open.length === 1;

    toggle.mutate(t, {
      onSuccess: () => {
        if (wasLastOpen) setClearedList(true);
        else if (completing) hapticStep();
      },
      onError: () => {
        hapticError();
        setToast('Could not update that task');
      },
    });
  }

  async function save() {
    setError(null);
    try {
      await create.mutateAsync({
        title,
        dueDate: dueDate.trim() || null,
        priority,
      });
      setTitle('');
      setDueDate('');
      setPriority('medium');
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add that task.');
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
          <ScreenHeader title="Tasks" />

          {isLoading && <Skeleton width="100%" height={64} />}

          {!isLoading && tasks.length === 0 && (
            <EmptyState
              title="No tasks yet"
              body="Add something you need to do. Tasks with a due date show up on your calendar next to your bills."
              action={<Button label="Add a task" onPress={() => setAdding(true)} />}
            />
          )}

          {open.length > 0 && (
            <View style={{ gap: space[2] }}>
              <Text variant="label" tone="secondary">
                To do
              </Text>
              {open.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onToggle={() => toggleTask(t)}
                  onDelete={() => setConfirming(t)}
                />
              ))}
            </View>
          )}

          {done.length > 0 && (
            <View style={{ gap: space[2] }}>
              <Text variant="label" tone="secondary">
                Done
              </Text>
              {done.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onToggle={() => toggleTask(t)}
                  onDelete={() => setConfirming(t)}
                />
              ))}
            </View>
          )}

          {tasks.length > 0 && (
            <Button label="Add task" variant="secondary" block onPress={() => setAdding(true)} />
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Add */}
      <GlassSheet
        visible={adding}
        onClose={() => setAdding(false)}
        title="Add a task"
        footer={
          <View style={{ gap: space[3] }}>
            {error && (
              <Text variant="caption" tone="danger">
                {error}
              </Text>
            )}
            <Button
              label="Add task"
              block
              loading={create.isPending}
              disabled={title.trim().length === 0 || create.isPending}
              onPress={save}
            />
          </View>
        }
      >
        <Input
          label="What needs doing?"
          value={title}
          onChangeText={setTitle}
          placeholder="Pay the internet bill"
          autoFocus
        />

        <View style={{ gap: space[2] }}>
          <Text variant="label" tone="secondary">
            Priority
          </Text>
          <ChipRow>
            {PRIORITIES.map((p) => (
              <Chip
                key={p.value}
                label={p.label}
                selected={p.value === priority}
                onPress={() => setPriority(p.value)}
              />
            ))}
          </ChipRow>
        </View>

        <Input
          label="Due date"
          value={dueDate}
          onChangeText={setDueDate}
          placeholder={todayISO()}
          hint="Optional — tasks with a date appear on your calendar"
        />
      </GlassSheet>

      {/* Delete confirmation (D§59) */}
      <GlassSheet
        visible={!!confirming}
        onClose={() => setConfirming(null)}
        title="Delete this task?"
        footer={
          <View style={{ gap: space[3] }}>
            <Button
              label="Delete"
              variant="danger"
              block
              loading={remove.isPending}
              onPress={async () => {
                if (!confirming) return;
                await remove.mutateAsync(confirming.id);
                setConfirming(null);
                setToast('Task deleted');
              }}
            />
            <Button label="Keep it" variant="ghost" block onPress={() => setConfirming(null)} />
          </View>
        }
      >
        <Text variant="body" tone="secondary">
          {confirming?.title}
        </Text>
      </GlassSheet>

      <Toast visible={!!toast} message={toast ?? ''} onDismiss={() => setToast(null)} />

      <Celebration
        visible={clearedList}
        title="Nothing left to do ✨"
        body="Your whole list is clear."
        tone="info"
        onDismiss={() => setClearedList(false)}
      />
    </View>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const isDone = task.status === 'done';

  return (
    <GlassCard
      variant="subtle"
      padding="md"
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}
    >
      {/* Checkbox. No confirmation (D§59) — it toggles straight back. */}
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isDone }}
        accessibilityLabel={`${isDone ? 'Mark not done' : 'Mark done'}: ${task.title}`}
        hitSlop={10}
        style={{
          width: 24,
          height: 24,
          borderRadius: radius.sm,
          borderWidth: 2,
          borderColor: isDone ? theme.semanticFill('income') : theme.color.border,
          backgroundColor: isDone ? theme.semanticFill('income') : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isDone && (
          <Text variant="micro" weight="700" style={{ color: '#FFFFFF' }}>
            ✓
          </Text>
        )}
      </Pressable>

      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          variant="body"
          weight="500"
          numberOfLines={2}
          style={isDone ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}
        >
          {task.title}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          {/* D§44: priority carries a label, never colour alone. */}
          {!isDone && task.priority !== 'medium' && (
            <StatusPill
              label={`${task.priority[0].toUpperCase()}${task.priority.slice(1)}`}
              tone={task.priority === 'urgent' ? 'danger' : task.priority === 'high' ? 'bill' : 'info'}
            />
          )}
          {task.due_date && (
            <Text variant="caption" tone={!isDone && task.due_date < todayISO() ? 'danger' : 'secondary'}>
              {dueLabel(task.due_date)}
            </Text>
          )}
        </View>
      </View>

      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${task.title}`}
        hitSlop={10}
        style={{ minHeight: a11y.minTouchTarget, justifyContent: 'center', paddingHorizontal: space[2] }}
      >
        <Text variant="bodySm" tone="secondary">
          ✕
        </Text>
      </Pressable>
    </GlassCard>
  );
}
