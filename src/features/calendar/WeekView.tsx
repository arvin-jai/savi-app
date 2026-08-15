/**
 * Week view (D§67, P§16) — the third calendar mode, alongside Month and Agenda.
 *
 * Deferred at v0.2 on the grounds that "month + agenda covers the P§16 use
 * case", which was true for *seeing* a month. What it did not cover is the
 * question a week actually answers: **what does my week look like?** — the one
 * you ask when deciding whether you can take on something else.
 *
 * Seven columns, each a day, each showing its entries in the same order the
 * timeline sorts them: money first, then shifts, then events, then tasks.
 * Money leads because it has a deadline the user cannot move.
 *
 * D§35: subtle coloured indicators, never colour-filled cards. D§44: every
 * indicator sits beside text, so the colour is never the only signal.
 */

import { Pressable, ScrollView, View } from 'react-native';

import { GlassCard } from '@/components/glass/GlassCard';
import { Text } from '@/components/ui/Text';
import { parseISODate, todayISO } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { a11y, brand, radius, space } from '@/theme/tokens';

import { WEEKDAYS } from './shifts';
import type { TimelineEntry } from './timeline';
import { weekDates } from './week';

/**
 * Seven-column week grid.
 *
 * NOT currently rendered: the A17 redesign uses `WeekStrip` plus the agenda,
 * which answer "where am I in the week" and "what is on this day" without
 * drawing the same seven days twice. Kept because it is tested and is the
 * obvious surface for a tablet/desktop week layout, where the horizontal room
 * exists and the columns stop being a scroll.
 */
export function WeekView({
  anchor,
  selected,
  onSelect,
  byDate,
}: {
  anchor: string;
  selected: string;
  onSelect: (date: string) => void;
  byDate: Map<string, TimelineEntry[]>;
}) {
  const theme = useTheme();
  const today = todayISO();
  const dates = weekDates(anchor);

  return (
    // Horizontal scroll on narrow screens: seven readable columns do not fit a
    // 375px phone, and squeezing them to fit produces columns too small to tap.
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        {dates.map((date) => {
          const entries = byDate.get(date) ?? [];
          const d = parseISODate(date);
          const isToday = date === today;
          const isSelected = date === selected;

          return (
            <Pressable
              key={date}
              onPress={() => onSelect(date)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${WEEKDAYS[d.getDay()]} ${d.getDate()}, ${
                entries.length === 0
                  ? 'nothing scheduled'
                  : `${entries.length} ${entries.length === 1 ? 'item' : 'items'}`
              }`}
              style={{
                width: 132,
                minHeight: a11y.minTouchTarget,
                borderRadius: radius.lg,
                padding: space[3],
                gap: space[2],
                borderWidth: 1,
                borderColor: isSelected ? brand[400] : 'transparent',
                backgroundColor: isSelected
                  ? theme.isDark
                    ? 'rgba(167,139,250,0.12)'
                    : 'rgba(124,58,237,0.08)'
                  : 'transparent',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
                <Text variant="caption" tone="secondary">
                  {WEEKDAYS[d.getDay()]}
                </Text>
                <Text variant="body" weight={isToday ? '700' : '500'} tone={isToday ? 'brand' : 'primary'}>
                  {d.getDate()}
                </Text>
              </View>

              {entries.length === 0 ? (
                <Text variant="caption" tone="secondary">
                  —
                </Text>
              ) : (
                entries.slice(0, 4).map((entry) => <WeekEntry key={entry.id} entry={entry} />)
              )}

              {entries.length > 4 && (
                <Text variant="caption" tone="secondary">
                  +{entries.length - 4} more
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function WeekEntry({ entry }: { entry: TimelineEntry }) {
  const theme = useTheme();

  const dotColor =
    entry.tone === 'brand'
      ? brand[400]
      : entry.tone === 'secondary'
        ? theme.color.textSecondary
        : theme.semanticFill(entry.tone);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: radius.full,
          backgroundColor: dotColor,
          opacity: entry.done ? 0.4 : 1,
        }}
      />
      <Text
        variant="caption"
        numberOfLines={1}
        style={[
          { flex: 1 },
          entry.done ? { textDecorationLine: 'line-through', opacity: 0.6 } : null,
        ]}
      >
        {/* Money says its amount here — on a week view the number IS the
            information, and "Internet" alone does not help you plan. */}
        {entry.amountMinor != null
          ? `${entry.title} ${formatMoney(entry.amountMinor, { compact: true, signDisplay: 'never' })}`
          : entry.title}
      </Text>
    </View>
  );
}

/** A one-line summary of the week's money, shown above the columns. */
export function WeekSummary({ entries }: { entries: TimelineEntry[] }) {
  const incoming = entries
    .filter((e) => e.kind === 'income')
    .reduce((sum, e) => sum + (e.amountMinor ?? 0), 0);
  const dueOut = entries
    .filter((e) => e.kind === 'bill' && e.meta !== 'Paid')
    .reduce((sum, e) => sum + (e.amountMinor ?? 0), 0);

  if (incoming === 0 && dueOut === 0) return null;

  return (
    <GlassCard variant="subtle" padding="md" style={{ flexDirection: 'row', gap: space[5] }}>
      {incoming > 0 && (
        <View>
          <Text variant="caption" tone="secondary">
            Coming in
          </Text>
          <Text variant="body" weight="600" tone="income">
            {formatMoney(incoming, { signDisplay: 'never' })}
          </Text>
        </View>
      )}
      {dueOut > 0 && (
        <View>
          <Text variant="caption" tone="secondary">
            Due out
          </Text>
          <Text variant="body" weight="600" tone="bill">
            {formatMoney(dueOut, { signDisplay: 'never' })}
          </Text>
        </View>
      )}
    </GlassCard>
  );
}
