/**
 * The "has this install been opened before?" flag.
 *
 * The I/O half of `landing.ts`, kept separate for the reason `security/store.ts`
 * is separate from `security/pin.ts`: the decision runs in CI, only the disk
 * access needs a device.
 *
 * AsyncStorage rather than SecureStore — this is a UX flag, not a secret, and
 * the worst an attacker gains by flipping it is seeing a welcome screen.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'savi.has-launched';

/**
 * Reads the flag, and sets it if it was missing.
 *
 * Returns null until the read resolves. Callers must treat that as "unknown"
 * rather than "false" — see `landingRoute`.
 *
 * A failed read reports `true` (returning), not `false`. Both answers are
 * wrong in that case, but showing a returning user Welcome again is a visible
 * regression while sending a first-time user to Login costs them one tap on a
 * link that is already on the screen.
 */
export function useHasLaunchedBefore(): boolean | null {
  const [hasLaunched, setHasLaunched] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!active) return;
        const seen = saved !== null;
        setHasLaunched(seen);

        // Mark on first launch, not first sign-in: the introduction has been
        // delivered whether or not they went on to make an account.
        if (!seen) void AsyncStorage.setItem(STORAGE_KEY, '1').catch(() => {});
      })
      .catch(() => {
        if (active) setHasLaunched(true);
      });

    return () => {
      active = false;
    };
  }, []);

  return hasLaunched;
}
