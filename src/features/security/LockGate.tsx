/**
 * The gate itself — what covers the app while it is locked.
 *
 * Rendered *over* the router rather than as a route, deliberately. A `/lock`
 * route would be navigable, back-navigable, and deep-linkable, which is three
 * ways past a lock screen. Covering the tree means there is no navigation state
 * in which the app is both locked and reachable.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/AmbientBackground';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { space, z } from '@/theme/tokens';

import { useLock } from './LockProvider';
import { PinPad } from './PinPad';
import {
  attemptsRemaining,
  isLockedOut,
  lockoutSecondsRemaining,
  NO_LOCKOUT,
  registerFailure,
  type LockoutState,
} from './pin';
import { biometricLabel, promptBiometric, verifyPin } from './store';

export function LockGate({ children }: { children: React.ReactNode }) {
  const { locked, enabled, biometric, unlock } = useLock();

  // `enabled === null` is the initial keychain read. Rendering children during
  // it would flash the dashboard before the gate goes up — the same class of
  // bug AuthGate's three-state comment describes.
  if (enabled === null) return <Holding />;

  return (
    <View style={{ flex: 1 }}>
      {children}
      {locked && <LockScreen biometric={biometric} onUnlock={unlock} />}
    </View>
  );
}

function Holding() {
  return (
    <View style={{ flex: 1 }}>
      <AmbientBackground />
    </View>
  );
}

function LockScreen({ biometric, onUnlock }: { biometric: boolean; onUnlock: () => void }) {
  const theme = useTheme();
  const { signOut } = useAuth();

  const [lockout, setLockout] = useState<LockoutState>(NO_LOCKOUT);
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [label, setLabel] = useState('biometrics');
  const [secondsLeft, setSecondsLeft] = useState(0);

  const triedBiometric = useRef(false);

  useEffect(() => {
    let active = true;
    biometricLabel().then((l) => active && setLabel(l));
    return () => {
      active = false;
    };
  }, []);

  const runBiometric = useCallback(async () => {
    if (await promptBiometric()) {
      hapticSuccess();
      onUnlock();
    }
  }, [onUnlock]);

  // Offer the face/finger once, on appearing. Guarded by a ref rather than an
  // effect dep so a re-render never re-opens the system sheet — on a device
  // that shows up as the prompt flickering.
  useEffect(() => {
    if (!biometric || triedBiometric.current) return;
    triedBiometric.current = true;
    void runBiometric();
  }, [biometric, runBiometric]);

  // Ticks only while a lockout is running, so there is no idle interval behind
  // an unlocked app.
  useEffect(() => {
    if (lockout.lockedUntil === null) return;

    function tick() {
      const left = lockoutSecondsRemaining(lockout, Date.now());
      setSecondsLeft(left);
      if (left === 0) {
        setLockout(NO_LOCKOUT);
        setError(null);
      }
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockout]);

  async function submit(pin: string) {
    if (isLockedOut(lockout, Date.now())) return;

    if (await verifyPin(pin)) {
      hapticSuccess();
      setLockout(NO_LOCKOUT);
      setError(null);
      onUnlock();
      return;
    }

    hapticError();
    const next = registerFailure(lockout, Date.now());
    setLockout(next);
    setResetKey((k) => k + 1);

    setError(
      next.lockedUntil !== null
        ? 'Too many attempts.'
        : `Wrong PIN — ${attemptsRemaining(next)} ${attemptsRemaining(next) === 1 ? 'try' : 'tries'} left.`
    );
  }

  const lockedOut = secondsLeft > 0;

  return (
    <View
      // Covers everything including the nav and any open sheet.
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: z.toast + 1,
        backgroundColor: theme.color.background,
      }}
    >
      <AmbientBackground />
      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: space[5],
            gap: space[6],
          }}
        >
          <PinPad
            title="Enter your PIN"
            subtitle={lockedOut ? undefined : 'Savi is locked.'}
            error={lockedOut ? `Locked. Try again in ${secondsLeft}s.` : error}
            onComplete={submit}
            onBiometric={biometric ? runBiometric : undefined}
            biometricLabel={label}
            disabled={lockedOut}
            key={resetKey}
          />

          {/* The only way out of a forgotten PIN. Signing out clears the
              Supabase session, and signing back in clears the lock with it —
              stated here rather than leaving the user to guess, because the
              alternative is reinstalling the app. */}
          <View style={{ alignItems: 'center', gap: space[2] }}>
            <Text variant="caption" tone="secondary" style={{ textAlign: 'center', maxWidth: 300 }}>
              Forgot it? Signing out clears the PIN. Your data is safe — it lives in your
              account, not on this phone.
            </Text>
            <Button label="Sign out" variant="ghost" size="sm" onPress={signOut} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
