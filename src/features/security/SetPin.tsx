/**
 * Choosing a PIN — enter, confirm, then optionally turn on biometrics.
 *
 * The confirm step is not ceremony. A PIN is entered as dots and stored as a
 * digest, so a typo at this moment is unrecoverable by any means except signing
 * out; there is nothing to compare against later and no "show me what I typed".
 * That makes this the one flow in Savi where asking twice is cheaper than the
 * mistake.
 *
 * Used by onboarding and by Settings. It owns the whole sequence rather than
 * exposing three steps, so neither caller can implement half of it.
 */

import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { space } from '@/theme/tokens';

import { PinPad } from './PinPad';
import { pinProblem, pinProblemMessage } from './pin';
import {
  biometricLabel,
  isBiometricAvailable,
  promptBiometric,
  setBiometricEnabled,
  setPin,
} from './store';

type Phase = 'choose' | 'confirm' | 'biometric';

export function SetPin({
  onDone,
  onCancel,
}: {
  /** Fires once the PIN is stored and the biometric question is settled. */
  onDone: () => void;
  /** Omit to hide the escape hatch — onboarding has its own skip. */
  onCancel?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('choose');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState('biometrics');

  useEffect(() => {
    let active = true;
    Promise.all([isBiometricAvailable(), biometricLabel()]).then(([available, label]) => {
      if (!active) return;
      setBioAvailable(available);
      setBioLabel(label);
    });
    return () => {
      active = false;
    };
  }, []);

  function choose(pin: string) {
    const problem = pinProblem(pin);
    if (problem) {
      hapticError();
      setError(pinProblemMessage(problem));
      setResetKey((k) => k + 1);
      return;
    }
    setFirst(pin);
    setError(null);
    setPhase('confirm');
    setResetKey((k) => k + 1);
  }

  async function confirm(pin: string) {
    if (pin !== first) {
      hapticError();
      setError("Those didn't match. Start again.");
      setFirst('');
      setPhase('choose');
      setResetKey((k) => k + 1);
      return;
    }

    setSaving(true);
    await setPin(pin);
    setSaving(false);
    hapticSuccess();
    setError(null);

    // Nothing to offer on a device with no enrolled face or finger — asking
    // anyway is the M9 bug: a prompt for a capability that then fails and sends
    // the user to system settings.
    if (bioAvailable) setPhase('biometric');
    else onDone();
  }

  async function enableBiometric() {
    // Prove it works *before* recording the preference. Storing it first and
    // discovering at the next unlock that the sensor refuses is how a user ends
    // up locked out by a feature that was supposed to be convenience.
    if (await promptBiometric(`Use ${bioLabel} to unlock Savi`)) {
      await setBiometricEnabled(true);
      hapticSuccess();
      onDone();
      return;
    }
    setError(`Couldn't confirm ${bioLabel}. Your PIN still works.`);
  }

  if (phase === 'biometric') {
    return (
      <View style={{ gap: space[5], alignItems: 'center' }}>
        <View style={{ gap: space[2] }}>
          <Text variant="h2" style={{ textAlign: 'center' }}>
            Use {bioLabel} instead?
          </Text>
          <Text variant="body" tone="secondary" style={{ textAlign: 'center', maxWidth: 320 }}>
            Faster than the PIN, and the PIN stays as your backup for when it doesn&apos;t
            recognise you.
          </Text>
        </View>

        {error && (
          <Text variant="caption" tone="danger" style={{ textAlign: 'center' }}>
            {error}
          </Text>
        )}

        <View style={{ gap: space[3], width: '100%', maxWidth: 340 }}>
          <Button label={`Turn on ${bioLabel}`} block onPress={enableBiometric} />
          <Button label="PIN only" variant="ghost" block onPress={onDone} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: space[5], alignItems: 'center' }}>
      <PinPad
        title={phase === 'choose' ? 'Choose a PIN' : 'Enter it again'}
        subtitle={
          phase === 'choose'
            ? 'Four digits. You’ll enter this when you open Savi.'
            : 'Just to be sure — there’s no way to look it up later.'
        }
        error={error}
        onComplete={phase === 'choose' ? choose : confirm}
        disabled={saving}
        key={resetKey}
      />

      {onCancel && <Button label="Cancel" variant="ghost" onPress={onCancel} />}
    </View>
  );
}
