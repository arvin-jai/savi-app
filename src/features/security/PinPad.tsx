/**
 * The PIN keypad — one component for both jobs it has to do (unlocking, and
 * choosing a PIN during onboarding or settings).
 *
 * It is a custom pad rather than a `TextInput` with `keyboardType="number-pad"`
 * for two reasons that both showed up as real bugs elsewhere in this app: a
 * software keyboard on Android can be swapped for one that does not offer
 * digits, and `KeyboardAvoidingView` on a full-screen gate is the exact shape
 * of the M11 composer problem. A pad we draw always has the keys and never
 * moves.
 *
 * Digits are shown as dots — the one place in Savi where A20's reveal toggle is
 * deliberately absent, because unlike a password field this is entered in
 * public, four characters long, and re-enterable in a second if you slip.
 */

import { Delete, Fingerprint } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { hapticError, hapticStep } from '@/lib/haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { a11y, iconSize, radius, space } from '@/theme/tokens';

import { PIN_LENGTH } from './pin';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function PinPad({
  title,
  subtitle,
  error,
  /** Fires as soon as the user has entered `length` digits. */
  onComplete,
  length = PIN_LENGTH,
  /** Renders the biometric key in the bottom-left. Omit to leave it blank. */
  onBiometric,
  biometricLabel,
  disabled = false,
}: {
  title: string;
  subtitle?: string;
  error?: string | null;
  onComplete: (pin: string) => void;
  length?: number;
  onBiometric?: () => void;
  biometricLabel?: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const [entry, setEntry] = useState('');

  /**
   * There is no `reset` prop. Callers clear the pad by changing React's `key`,
   * which remounts it — `entry` is the only state here, so a remount and a
   * reset are the same thing, and the version that syncs a prop into state
   * inside an effect is the one that renders the old digits for a frame first.
   */

  function press(digit: string) {
    if (disabled) return;
    const next = entry + digit;
    hapticStep();
    setEntry(next);

    // The fixed length is what lets the pad submit itself on the last tap —
    // no confirm key on the unlock path, which is the whole point of a PIN
    // over a password. See `PIN_LENGTH`.
    if (next.length >= length) {
      onComplete(next);
      setEntry('');
    }
  }

  function backspace() {
    if (disabled) return;
    if (entry.length === 0) return hapticError();
    setEntry(entry.slice(0, -1));
  }

  return (
    <View style={{ alignItems: 'center', gap: space[6] }}>
      <View style={{ alignItems: 'center', gap: space[2] }}>
        <Text variant="h2" style={{ textAlign: 'center' }}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="bodySm" tone="secondary" style={{ textAlign: 'center', maxWidth: 300 }}>
            {subtitle}
          </Text>
        )}
      </View>

      {/* Dots. `length` of them, filled left to right — a count the user can
          check at a glance without the digits being on screen. */}
      <View
        accessibilityLabel={`${entry.length} of ${length} digits entered`}
        style={{ flexDirection: 'row', gap: space[3], minHeight: 16 }}
      >
        {Array.from({ length }, (_, i) => (
          <View
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: radius.full,
              borderWidth: 1.5,
              borderColor: error ? theme.semanticFill('danger') : theme.color.border,
              backgroundColor:
                i < entry.length
                  ? error
                    ? theme.semanticFill('danger')
                    : theme.color.brand
                  : 'transparent',
            }}
          />
        ))}
      </View>

      <Text
        variant="caption"
        tone={error ? 'danger' : 'secondary'}
        style={{ textAlign: 'center', minHeight: 18, maxWidth: 300 }}
      >
        {error ?? ' '}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          width: 264,
          justifyContent: 'center',
          gap: space[3],
        }}
      >
        {KEYS.map((k) => (
          <Key key={k} label={k} onPress={() => press(k)} disabled={disabled} />
        ))}

        {onBiometric ? (
          <Key
            accessibilityLabel={`Unlock with ${biometricLabel ?? 'biometrics'}`}
            onPress={onBiometric}
            disabled={disabled}
          >
            <Fingerprint size={iconSize.lg} color={theme.color.brand} />
          </Key>
        ) : (
          <View style={{ width: 72, height: 72 }} />
        )}

        <Key label="0" onPress={() => press('0')} disabled={disabled} />

        <Key accessibilityLabel="Delete" onPress={backspace} disabled={disabled}>
          <Delete size={iconSize.lg} color={theme.color.textSecondary} />
        </Key>
      </View>
    </View>
  );
}

function Key({
  label,
  children,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  label?: string;
  children?: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      // 72px, comfortably past A15's 44px floor. A keypad is used at speed and
      // in one hand; the minimum is a floor, not a target.
      style={({ pressed }) => ({
        width: 72,
        height: 72,
        minWidth: a11y.minTouchTarget,
        minHeight: a11y.minTouchTarget,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
        backgroundColor: pressed
          ? theme.isDark
            ? 'rgba(255,255,255,0.10)'
            : 'rgba(0,0,0,0.06)'
          : 'transparent',
      })}
    >
      {children ?? (
        <Text variant="h2" weight="500">
          {label}
        </Text>
      )}
    </Pressable>
  );
}
