/**
 * Text — the only way type enters the app.
 *
 * Takes a token name from the D§14/§50 scale rather than raw sizes, so a screen
 * cannot invent 19px. Colors come from the theme, never from a literal.
 */

import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { type as typeScale, type TypeName } from '@/theme/tokens';

export type TextTone =
  | 'primary'
  | 'secondary'
  | 'brand'
  | 'income'
  | 'expense'
  | 'bill'
  | 'danger'
  | 'info'
  | 'onBrand';

export type AppTextProps = TextProps & {
  variant?: TypeName;
  tone?: TextTone;
  /** Override the token weight — e.g. a 600 body row in D§32. */
  weight?: '400' | '500' | '600' | '700';
  style?: StyleProp<TextStyle>;
};

export function Text({
  variant = 'body',
  tone = 'primary',
  weight,
  style,
  ...rest
}: AppTextProps) {
  const theme = useTheme();
  const token = typeScale[variant];

  const color = (() => {
    switch (tone) {
      case 'secondary':
        return theme.color.textSecondary;
      case 'brand':
        return theme.color.brand;
      case 'onBrand':
        return '#FFFFFF';
      // A2: semantic TEXT values, never the fill values. The fills fail AA here.
      case 'income':
      case 'expense':
      case 'bill':
      case 'danger':
      case 'info':
        return theme.semanticText(tone);
      default:
        return theme.color.textPrimary;
    }
  })();

  return (
    <RNText
      style={[
        {
          fontSize: token.size,
          lineHeight: token.lineHeight,
          fontWeight: weight ?? token.weight,
          letterSpacing: 'letterSpacing' in token ? token.letterSpacing : undefined,
          color,
        },
        style,
      ]}
      {...rest}
    />
  );
}
