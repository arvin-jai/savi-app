/**
 * Input (D§36) and MoneyInput (D§37).
 *
 * D§36 gave a focus state; A15 adds the rest. Error state is included because
 * every money form needs one and D§58's "make errors understandable" applies to
 * field-level validation, not only screens.
 */

import { useState } from 'react';
import {
  Platform,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { currencySymbol, type CurrencyCode } from '@/lib/money';
import { focus, money as moneyType, opacity, radius, space } from '@/theme/tokens';

import { Text } from './Text';

/**
 * RN Web draws its own focus ring on the inner <input>. Ours lives on the
 * wrapper, so the inner one is suppressed rather than showing two rings.
 * `outlineStyle` is a web-only style that RN's TextStyle type doesn't model.
 */
const SUPPRESS_WEB_OUTLINE = (
  Platform.OS === 'web' ? { outlineStyle: 'none' } : null
) as TextStyle | null;

export type InputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  /** Shown below the field. Replaced by `error` when present. */
  hint?: string;
  error?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Input({
  label,
  hint,
  error,
  disabled = false,
  style,
  ...rest
}: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.semanticText('danger')
    : focused
      ? focus.glowBorder
      : theme.color.border;

  return (
    <View style={[{ gap: space[2] }, style]}>
      {label && (
        <Text variant="label" tone="secondary">
          {label}
        </Text>
      )}

      <View
        style={[
          {
            height: 50, // D§36: 48–52px
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor,
            backgroundColor: theme.isDark
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(255,255,255,0.55)',
            paddingHorizontal: space[4],
            justifyContent: 'center',
            opacity: disabled ? opacity.disabled : 1,
          },
          // D§36 focus glow. boxShadow rather than a second border so the
          // field doesn't shift by a pixel when focused.
          focused && !error && { boxShadow: `0 0 0 3px ${focus.glow}` },
        ]}
      >
        <TextInput
          editable={!disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={theme.color.textSecondary}
          accessibilityLabel={label}
          style={[
            {
              // Without an explicit width the web <input> falls back to its
              // default ~400px intrinsic size and overflows a 375px viewport
              // horizontally. `height: '100%'` makes the whole 50px field
              // tappable rather than just the 20px text box inside it.
              flex: 1,
              width: '100%',
              height: '100%',
              fontSize: 15,
              color: theme.color.textPrimary,
            },
            SUPPRESS_WEB_OUTLINE,
          ]}
          {...rest}
        />
      </View>

      {(error || hint) && (
        <Text variant="caption" tone={error ? 'danger' : 'secondary'}>
          {error ?? hint}
        </Text>
      )}
    </View>
  );
}

/**
 * Money input (D§37) — the amount is the dominant element, and the currency
 * symbol is a separate glyph rather than part of the editable string, so the
 * user never has to delete or retype it.
 */
export function MoneyInput({
  label = 'Amount',
  value,
  onChangeText,
  currency = 'PHP',
  error,
  autoFocus,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  currency?: CurrencyCode;
  error?: string;
  autoFocus?: boolean;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: space[2] }}>
      <Text variant="label" tone="secondary">
        {label}
      </Text>

      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
            minHeight: 64,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: error
              ? theme.semanticText('danger')
              : focused
                ? focus.glowBorder
                : theme.color.border,
            backgroundColor: theme.isDark
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(255,255,255,0.55)',
            paddingHorizontal: space[4],
          },
          focused && !error && { boxShadow: `0 0 0 3px ${focus.glow}` },
        ]}
      >
        <Text variant="h2" tone="secondary">
          {currencySymbol(currency)}
        </Text>

        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          autoFocus={autoFocus}
          placeholder="0"
          placeholderTextColor={theme.color.textSecondary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          style={[
            {
              flex: 1,
              // A flex child will not shrink below its intrinsic width without
              // this — the web <input> defaults to ~400px and overflows a
              // 375px viewport even with flex: 1 set.
              minWidth: 0,
              alignSelf: 'stretch',
              fontSize: moneyType.input.size,
              lineHeight: moneyType.input.lineHeight,
              fontWeight: moneyType.input.weight,
              letterSpacing: moneyType.input.letterSpacing,
              color: theme.color.textPrimary,
            },
            SUPPRESS_WEB_OUTLINE,
          ]}
        />
      </View>

      {error && (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      )}
    </View>
  );
}
