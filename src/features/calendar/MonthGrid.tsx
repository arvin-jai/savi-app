/**
 * Month grid (D§35).
 *
 * "Calendar events should use subtle colored indicators rather than completely
 * colored cards. This maintains the premium aesthetic."
 *
 * So each day cell is a number plus up to three dots — never a filled block.
 * The dots are an at-a-glance density signal; the agenda below carries the
 * detail. D§44 applies too: the dots are never the only signal, because
 * selecting a day shows the labelled list.
 */

import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { parseISODate, todayISO } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { a11y, brand, radius, space } from '@/theme/tokens';

import { dayIndicators, type TimelineEntry } from './timeline';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export type MonthGridProps = {
  /** Any date within the month to render. */
  month: string;
  selected: string;
  onSelect: (date: string) => void;
  byDate: Map<string, TimelineEntry[]>;
};

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function MonthGrid({ month, selected, onSelect, byDate }: MonthGridProps) {
  const theme = useTheme();
  const today = todayISO();

  const ref = parseISODate(month);
  const year = ref.getFullYear();
  const monthIndex = ref.getMonth();

  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  // Leading blanks so the 1st lands under the right weekday.
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => iso(year, monthIndex, i + 1)),
  ];

  const toneColor = (tone: TimelineEntry['tone']): string => {
    switch (tone) {
      case 'income':
      case 'bill':
      case 'danger':
      case 'info':
        return theme.semanticFill(tone);
      case 'brand':
        return brand[400];
      default:
        return theme.color.textSecondary;
    }
  };

  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="micro" tone="secondary">
              {d}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((date, i) => {
          if (!date) return <View key={`blank-${i}`} style={{ width: `${100 / 7}%`, height: 52 }} />;

          const entries = byDate.get(date) ?? [];
          const isSelected = date === selected;
          const isToday = date === today;
          const dots = dayIndicators(entries);

          return (
            <Pressable
              key={date}
              onPress={() => onSelect(date)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              // Screen readers get the count in words — the dots alone would
              // be meaningless to them (D§44).
              accessibilityLabel={`${parseISODate(date).toDateString()}${
                entries.length ? `, ${entries.length} item${entries.length === 1 ? '' : 's'}` : ''
              }`}
              style={{
                width: `${100 / 7}%`,
                height: 52,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelected
                    ? theme.color.brand
                    : isToday
                      ? theme.isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(0,0,0,0.05)'
                      : 'transparent',
                }}
              >
                <Text
                  variant="bodySm"
                  weight={isSelected || isToday ? '600' : '400'}
                  style={{
                    color: isSelected ? '#FFFFFF' : theme.color.textPrimary,
                  }}
                >
                  {parseISODate(date).getDate()}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 2, height: 5 }}>
                {dots.map((tone, di) => (
                  <View
                    key={di}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: radius.full,
                      backgroundColor: toneColor(tone),
                    }}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The 44px rule applies to the cells; 52px height with a 7-column split
 *  clears it at any phone width down to 320px (320/7 ≈ 45.7). */
export const MIN_CELL_WIDTH = a11y.minTouchTarget;
