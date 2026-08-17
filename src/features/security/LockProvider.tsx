/**
 * The screen lock's state machine and the gate that enforces it.
 *
 * ── When the app locks ──────────────────────────────────────────────────────
 *
 * On cold start, and on returning to the foreground after `GRACE_MS`. The grace
 * period is the part that decides whether this feature is used or switched off
 * within a day: locking on *every* background means the PIN pad appears when
 * you tab out to your bank app to check a balance and tab straight back, which
 * is the single most common thing a person does while using Savi. Thirty
 * seconds covers that and still locks a phone put down on a table.
 *
 * Time is read from `Date.now()`, not from a timer, because a JS interval does
 * not run reliably while the app is backgrounded — the elapsed time has to be
 * measured across the gap rather than counted during it.
 *
 * ── What the lock is not ────────────────────────────────────────────────────
 *
 * See `pin.ts`: this is a screen lock. It hides the UI behind a gate; it does
 * not encrypt anything and the Supabase session stays live behind it.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { hasPin, isBiometricEnabled, isLockSupported } from './store';

/** How long the app may sit in the background before it re-locks. */
export const GRACE_MS = 30_000;

type LockContext = {
  /** True while the gate should be covering the app. */
  locked: boolean;
  /** Null until the initial keychain read finishes — hold the splash. */
  enabled: boolean | null;
  biometric: boolean;
  /** Call after a correct PIN or a successful biometric prompt. */
  unlock: () => void;
  /** Re-read the keychain after settings change the PIN or biometric flag. */
  refresh: () => Promise<void>;
  /** Lock immediately — used by "Lock now" in settings. */
  lockNow: () => void;
};

const Ctx = createContext<LockContext | null>(null);

export function useLock(): LockContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLock must be used inside <LockProvider>');
  return ctx;
}

export function LockProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [biometric, setBiometric] = useState(false);
  const [locked, setLocked] = useState(false);

  // Refs, not state: the AppState listener is registered once and would
  // otherwise capture the first render's values forever.
  const enabledRef = useRef(false);
  const backgroundedAt = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!isLockSupported()) {
      enabledRef.current = false;
      setEnabled(false);
      setBiometric(false);
      setLocked(false);
      return;
    }

    const [on, bio] = await Promise.all([hasPin(), isBiometricEnabled()]);
    enabledRef.current = on;
    setEnabled(on);
    setBiometric(bio);
    // Turning the lock off must not leave a gate on screen with no way past it.
    if (!on) setLocked(false);
  }, []);

  // Cold start: read the keychain, and lock immediately if a PIN exists. The
  // gate goes up before any screen renders rather than after a flash of it.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!isLockSupported()) {
        if (active) setEnabled(false);
        return;
      }
      const [on, bio] = await Promise.all([hasPin(), isBiometricEnabled()]);
      if (!active) return;
      enabledRef.current = on;
      setEnabled(on);
      setBiometric(bio);
      setLocked(on);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function onChange(next: AppStateStatus) {
      if (next === 'active') {
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (enabledRef.current && since !== null && Date.now() - since >= GRACE_MS) {
          setLocked(true);
        }
        return;
      }
      // 'inactive' fires for a notification shade pull or an incoming call, so
      // only the first transition away is recorded — overwriting it on every
      // event would restart the grace period mid-background.
      if (backgroundedAt.current === null) backgroundedAt.current = Date.now();
    }

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  const unlock = useCallback(() => {
    backgroundedAt.current = null;
    setLocked(false);
  }, []);

  const lockNow = useCallback(() => {
    if (enabledRef.current) setLocked(true);
  }, []);

  return (
    <Ctx.Provider value={{ locked, enabled, biometric, unlock, refresh, lockNow }}>
      {children}
    </Ctx.Provider>
  );
}
