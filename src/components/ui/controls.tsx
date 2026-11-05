/**
 * Segmented control and Chip — the two selection affordances Quick Add needs.
 *
 * Both are single-tap. D§60's progressive disclosure only works if the visible
 * first level is genuinely one gesture per field; a dropdown that opens a modal
 * to pick "Need" would defeat it.
 */

import { Platform, Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { a11y, brandRole, focus, radius, space } from '@/theme/tokens';

import { Text } from './Text';

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        {
          flexDirection: 'row',
          padding: space[1],
          borderRadius: radius.md,
          backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          gap: space[1],
        },
        style,
      ]}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={({ focused }: any) => [
              {
                flex: 1,
                minHeight: a11y.minTouchTarget - space[2],
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: space[2],
                borderRadius: radius.sm,
                backgroundColor: selected
                  ? theme.isDark
                    ? '#FFFFFF'
                    : theme.color.surface
                  : 'transparent',
              },
              selected && Platform.OS !== 'android' && { boxShadow: theme.shadow.xs.boxShadow },
              selected && Platform.OS === 'android' && { elevation: 1 },
              focused && {
                outlineWidth: focus.width,
                outlineColor: focus.color,
                outlineStyle: 'solid',
                outlineOffset: focus.offset,
              },
            ]}
          >
            <Text
              variant="label"
              weight={selected ? '600' : '500'}
              tone={selected ? 'primary' : 'secondary'}
              style={selected && theme.isDark ? { color: '#111111' } : undefined}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  dotColor,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  dotColor?: string;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      // The chip is visually ~34px tall; hitSlop carries it to the 44px floor
      // without making a row of chips look like a row of buttons.
      hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}
      style={({ focused }: any) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
          paddingHorizontal: space[3],
          paddingVertical: space[2],
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: selected
            ? theme.isDark
              ? '#FFFFFF'
              : brandRole.action
            : theme.color.border,
          backgroundColor: selected
            ? theme.isDark
              ? '#FFFFFF'
              : 'rgba(0,0,0,0.06)'
            : 'transparent',
        },
        focused && {
          outlineWidth: focus.width,
          outlineColor: focus.color,
          outlineStyle: 'solid',
          outlineOffset: focus.offset,
        },
      ]}
    >
      {dotColor && (
        <View
          style={{ width: 8, height: 8, borderRadius: radius.full, backgroundColor: dotColor }}
        />
      )}
      <Text
        variant="label"
        weight={selected ? '600' : '500'}
        tone={selected ? 'brand' : 'secondary'}
        style={selected && theme.isDark ? { color: '#111111' } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space[2], paddingRight: space[4] }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** Collapsible "More details" section — D§60 progressive disclosure. */
export function Disclosure({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: space[4] }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ minHeight: a11y.minTouchTarget, justifyContent: 'center' }}
      >
        <Text variant="label" weight="600" tone="brand">
          {open ? `Hide ${label.toLowerCase()}` : label}
        </Text>
      </Pressable>
      {open && <View style={{ gap: space[4] }}>{children}</View>}
    </View>
  );
}
