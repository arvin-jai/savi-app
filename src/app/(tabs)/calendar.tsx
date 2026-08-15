/**
 * Calendar (P§16) — the time + money calendar.
 *
 * "Savi's calendar is different from a normal calendar. It combines Money,
 * Work and Life."
 *
 * Month grid with D§35 indicator dots, plus an agenda for the selected day.
 * Bills and paydays appear without ever being stored as calendar rows — they
 * are derived from the ledger, so the two cannot disagree.
 */

import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AmbientBackground } from "@/components/AmbientBackground";
import { GlassCard } from "@/components/glass/GlassCard";
import { GlassSheet } from "@/components/glass/GlassSheet";
import { Button } from "@/components/ui/Button";
import { Chip, ChipRow, Segmented } from "@/components/ui/controls";
import { EmptyState, Skeleton, Toast } from "@/components/ui/feedback";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { useCreateEvent, useTimeline } from "@/features/calendar/api";
import { MonthGrid } from "@/features/calendar/MonthGrid";
import {
  groupTimelineByDate,
  type TimelineEntry,
} from "@/features/calendar/timeline";
import { shiftWeek, weekBounds, weekLabel } from "@/features/calendar/week";
import { WeekStrip } from "@/features/calendar/WeekStrip";
import { WeekSummary } from "@/features/calendar/WeekView";
import type { EventKind } from "@/lib/database.types";
import { dayLabel, parseISODate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { useTheme } from "@/theme/ThemeProvider";
import { brand, layout, radius, space } from "@/theme/tokens";
import { useBreakpoint, useScrollBottomInset } from "@/theme/useBreakpoint";

/** D§67 lists Month · Week · Agenda. The agenda is always below, per day. */
type CalendarView = "month" | "week";

const EVENT_KINDS: { value: EventKind; label: string }[] = [
  { value: "personal", label: "Personal" },
  { value: "work", label: "Work" },
  { value: "appointment", label: "Appointment" },
  { value: "deadline", label: "Deadline" },
];

function monthBounds(anchor: string) {
  const d = parseISODate(anchor);
  const y = d.getFullYear();
  const m = d.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const p = (n: number) => String(n).padStart(2, "0");
  return { start: `${y}-${p(m + 1)}-01`, end: `${y}-${p(m + 1)}-${p(last)}` };
}

function shiftMonth(anchor: string, delta: number): string {
  const d = parseISODate(anchor);
  const shifted = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getFullYear()}-${p(shifted.getMonth() + 1)}-01`;
}

export default function CalendarScreen() {
  const { pagePadding } = useBreakpoint();
  const bottomInset = useScrollBottomInset();

  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(todayISO());
  const [selected, setSelected] = useState(todayISO());
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // The range follows the view, so week mode fetches and renders one week
  // rather than filtering a month down.
  const { start, end } = useMemo(
    () => (view === "month" ? monthBounds(anchor) : weekBounds(anchor)),
    [anchor, view],
  );
  const { entries, isLoading } = useTimeline(start, end);
  const byDate = useMemo(() => groupTimelineByDate(entries), [entries]);

  const dayEntries = byDate.get(selected) ?? [];

  const periodLabel =
    view === "month"
      ? parseISODate(anchor).toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        })
      : weekLabel(anchor);

  const step = (delta: number) =>
    setAnchor(
      view === "month" ? shiftMonth(anchor, delta) : shiftWeek(anchor, delta),
    );

  return (
    <View style={{ flex: 1 }}>
      <AmbientBackground />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View
          style={{
            width: "100%",
            maxWidth: layout.maxContentWidth,
            alignSelf: "center",
            paddingHorizontal: pagePadding,
            paddingTop: pagePadding,
            paddingBottom: space[5],
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: space[3],
          }}
        >
          <Text variant="h1">Calendar</Text>
          <Segmented
            value={view}
            onChange={setView}
            style={{ width: 136 }}
            options={[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
            ]}
          />
        </View>
        <ScrollView
          contentContainerStyle={{
            padding: pagePadding,
            paddingTop: 0,
            gap: space[4],
            paddingBottom: bottomInset,
            width: "100%",
            maxWidth: layout.maxContentWidth,
            alignSelf: "center",
          }}
        >
          <GlassCard padding="lg" style={{ gap: space[4] }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Button
                label="‹"
                size="sm"
                variant="ghost"
                onPress={() => step(-1)}
              />
              <Text variant="h4">{periodLabel}</Text>
              <Button
                label="›"
                size="sm"
                variant="ghost"
                onPress={() => step(1)}
              />
            </View>

            {isLoading ? (
              <Skeleton width="100%" height={260} />
            ) : view === "month" ? (
              <MonthGrid
                month={anchor}
                selected={selected}
                onSelect={setSelected}
                byDate={byDate}
              />
            ) : (
              <View style={{ gap: space[3] }}>
                <WeekSummary entries={entries} />
                {/*
                  Strip only — the agenda below carries the detail for the
                  selected day (handoff 2b).

                  M14's seven-column `WeekView` used to sit here too, but with
                  the strip above it the same seven days were rendered twice,
                  once as columns and once as a row. The strip answers "where am
                  I in the week"; the agenda answers "what is on this day". The
                  columns answered neither better than those two together, and
                  cost a horizontal scroll on a phone.
                */}
                <WeekStrip
                  anchor={anchor}
                  selected={selected}
                  onSelect={setSelected}
                  byDate={byDate}
                />
              </View>
            )}
          </GlassCard>

          {/* ── Agenda for the selected day ──────────────────────────── */}
          <View style={{ gap: space[2] }}>
            <Text variant="label" tone="secondary">
              {dayLabel(selected)}
            </Text>

            {dayEntries.length === 0 ? (
              <EmptyState
                title="Nothing scheduled"
                body="Bills, paydays, events, and tasks with a due date all show up here together."
                action={
                  <Button
                    label="Add an event"
                    onPress={() => setAdding(true)}
                  />
                }
              />
            ) : (
              /* No gap here on purpose: each row carries its own bottom padding
                 so the timeline rail runs through it as one continuous line. */
              <View>
                {dayEntries.map((entry, i) => (
                  <AgendaRow
                    key={entry.id}
                    entry={entry}
                    isLast={i === dayEntries.length - 1}
                  />
                ))}
              </View>
            )}
          </View>

          {dayEntries.length > 0 && (
            <Button
              label="Add event"
              variant="secondary"
              block
              onPress={() => setAdding(true)}
            />
          )}
        </ScrollView>
      </SafeAreaView>

      <AddEventSheet
        visible={adding}
        date={selected}
        onClose={() => setAdding(false)}
        onSaved={setToast}
      />

      <Toast
        visible={!!toast}
        message={toast ?? ""}
        onDismiss={() => setToast(null)}
      />
    </View>
  );
}

/**
 * One agenda row, hung off a vertical timeline rail (handoff 2b).
 *
 * The rail is what makes a list of times read as a *day* rather than as rows in
 * a table — you can see the gaps. It is drawn as a hairline behind an outlined
 * node per row, so it needs no absolute positioning and survives rows of
 * different heights.
 */
function AgendaRow({
  entry,
  isLast,
}: {
  entry: TimelineEntry;
  isLast: boolean;
}) {
  const theme = useTheme();

  const dotColor =
    entry.tone === "brand"
      ? brand[400]
      : entry.tone === "secondary"
        ? theme.color.textSecondary
        : theme.semanticFill(entry.tone);

  return (
    // The spacing between rows lives INSIDE the row, as padding, so the rail's
    // `flex: 1` line runs through it. A `gap` on the parent list would break the
    // line into disconnected segments.
    <View
      style={{
        flexDirection: "row",
        gap: space[3],
        paddingBottom: isLast ? 0 : space[2],
      }}
    >
      {/* The rail. Decorative — every row already states its own time and
          title, so this is hidden from screen readers. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: 12, alignItems: "center" }}
      >
        <View
          style={{
            width: 11,
            height: 11,
            borderRadius: radius.full,
            borderWidth: 2,
            borderColor: dotColor,
            backgroundColor: theme.color.background,
            marginTop: space[4],
            opacity: entry.done ? 0.4 : 1,
          }}
        />
        {!isLast && (
          <View
            style={{ flex: 1, width: 1.5, backgroundColor: theme.color.border }}
          />
        )}
      </View>

      <GlassCard
        variant="subtle"
        padding="md"
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            variant="body"
            weight="500"
            numberOfLines={1}
            // A completed task reads as settled without being hidden.
            style={
              entry.done
                ? { textDecorationLine: "line-through", opacity: 0.6 }
                : undefined
            }
          >
            {entry.title}
          </Text>
          {entry.meta && (
            <Text
              variant="caption"
              tone={entry.tone === "danger" ? "danger" : "secondary"}
            >
              {entry.meta}
            </Text>
          )}
        </View>

        {entry.amountMinor != null && (
          <Text
            variant="body"
            weight="600"
            tone={entry.kind === "income" ? "income" : "primary"}
          >
            {formatMoney(entry.amountMinor, {
              signDisplay: entry.kind === "income" ? "always" : "never",
            })}
          </Text>
        )}
      </GlassCard>
    </View>
  );
}

function AddEventSheet({
  visible,
  date,
  onClose,
  onSaved,
}: {
  visible: boolean;
  date: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const create = useCreateEvent();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<EventKind>("personal");
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    try {
      await create.mutateAsync({
        title,
        date,
        kind,
        // Empty time means all-day, which the DB constraint also enforces.
        startTime: time.trim() ? `${time.trim()}:00` : null,
      });
      setTitle("");
      setTime("");
      setKind("personal");
      onClose();
      onSaved("Event added");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that event.");
    }
  }

  return (
    <GlassSheet
      visible={visible}
      onClose={onClose}
      title={`Add to ${dayLabel(date)}`}
      footer={
        <View style={{ gap: space[3] }}>
          {error && (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          )}
          <Button
            label="Add event"
            block
            loading={create.isPending}
            disabled={title.trim().length === 0 || create.isPending}
            onPress={save}
          />
        </View>
      }
    >
      <Input
        label="What is it?"
        value={title}
        onChangeText={setTitle}
        placeholder="Meeting, gym, deadline…"
        autoFocus
      />

      <View style={{ gap: space[2] }}>
        <Text variant="label" tone="secondary">
          Kind
        </Text>
        <ChipRow>
          {EVENT_KINDS.map((k) => (
            <Chip
              key={k.value}
              label={k.label}
              selected={k.value === kind}
              onPress={() => setKind(k.value)}
            />
          ))}
        </ChipRow>
      </View>

      <Input
        label="Time"
        value={time}
        onChangeText={setTime}
        placeholder="HH:MM"
        hint="Leave empty for an all-day event"
      />
    </GlassSheet>
  );
}
