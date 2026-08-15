/**
 * The seven-day strip above the calendar (design handoff 2b).
 *
 * A compact "where am I in the week" row: weekday initial, date, and up to
 * three indicator dots for what is on that day. Today is a filled brand pill;
 * the selected day is outlined.
 *
 * D§35: subtle coloured indicators, never colour-filled cards. A16: the dot is
 * never load-bearing — every day announces its contents in words through
 * `accessibilityLabel`, and the agenda below spells them out. The dots are a
 * density cue ("this day is busy"), not an identification of what is on it.
 */

import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { parseISODate, todayISO } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { a11y, brand, brandRole, radius, space } from '@/theme/tokens';

import { WEEKDAYS } from './shifts';
import { dayIndicators, type TimelineEntry } from './timeline';
import { weekDates } from './week';

export function WeekStrip({
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

  return (
    <View style={{ flexDirection: 'row', gap: space[1] }}>
      {weekDates(anchor).map((date) => {
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
            accessibilityLabel={`${WEEKDAYS[d.getDay()]} ${d.getDate()}${
              isToday ? ', today' : ''
            }, ${
              entries.length === 0
                ? 'nothing scheduled'
                : `${entries.length} ${entries.length === 1 ? 'item' : 'items'}`
            }`}
            style={{
              flex: 1,
              minHeight: a11y.minTouchTarget,
              paddingVertical: space[2],
              borderRadius: radius.lg,
              alignItems: 'center',
              gap: space[1],
              // Today is filled; the selected day is outlined. Two different
              // cues, so "today" and "the day I am looking at" never collapse
              // into one another when they differ.
              backgroundColor: isToday ? brandRole.action : 'transparent',
              borderWidth: 1,
              borderColor: isSelected && !isToday ? brand[400] : 'transparent',
            }}
          >
            <Text
              variant="micro"
              tone={isToday ? 'onBrand' : 'secondary'}
              style={isToday ? undefined : { opacity: 0.8 }}
            >
              {WEEKDAYS[d.getDay()].charAt(0)}
            </Text>

            <Text variant="bodySm" weight={isToday || isSelected ? '700' : '500'} tone={isToday ? 'onBrand' : 'primary'}>
              {d.getDate()}
            </Text>

            {/* Fixed-height row so days with and without dots stay aligned —
                otherwise the numbers jump by 5px across the strip. */}
            <View style={{ flexDirection: 'row', gap: 2, height: 5 }}>
              {dayIndicators(entries, 3).map((tone, i) => (
                <View
                  key={i}
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: radius.full,
                    backgroundColor: isToday
                      ? theme.color.surface
                      : tone === 'brand'
                        ? brand[400]
                        : tone === 'secondary'
                          ? theme.color.textSecondary
                          : theme.semanticFill(tone),
                  }}
                />
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
