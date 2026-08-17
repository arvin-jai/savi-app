/**
 * PIN rules — pure, no I/O, so every decision here is testable without a device
 * or a keychain (the layering rule in CLAUDE.md).
 *
 * ── What a Savi PIN is and, more importantly, is not ────────────────────────
 *
 * **It is a screen lock, not an encryption key.** It stops the person holding
 * an unlocked phone from reading your money. It does not protect the data at
 * rest — that lives in Supabase behind RLS and a Supabase session, and the
 * session token is what an attacker with the device and real skill would go
 * after, not this. Saying so plainly here matters because the alternative is
 * someone later assuming this is doing more than it is and skipping something
 * that actually protects data.
 *
 * Given that, the PIN is stored as a salted SHA-256 digest inside the platform
 * keychain (`expo-secure-store`) rather than in plaintext. The digest is not
 * meaningfully expensive to brute-force over a 4–6 digit space — that is what
 * the attempt lockout below is for, and the lockout is the real control.
 */

/**
 * Exactly four digits, not a range.
 *
 * A variable length forces a submit key onto the unlock pad — the pad cannot
 * know when a 4-to-6 digit PIN is finished, so the user has to confirm every
 * single unlock. Fixing the length lets the pad submit on the fourth tap, which
 * is the whole ergonomic point of a PIN over a password. The extra two digits
 * would buy very little anyway: the real control against guessing is the
 * lockout below, not the search space.
 */
export const PIN_LENGTH = 4;

/** Wrong tries before the PIN screen locks. */
export const MAX_ATTEMPTS = 5;

/**
 * How long a lockout lasts. Long enough to make a brute-force over 10,000
 * combinations pointless, short enough that a genuine mis-remember does not
 * cost the user their evening.
 */
export const LOCKOUT_MS = 60_000;

export type PinProblem = 'wrong-length' | 'not-digits' | 'sequential' | 'repeated';

/**
 * Why a candidate PIN is unacceptable, or null if it is fine.
 *
 * `sequential` and `repeated` are rejected because a lockout after five tries
 * is only a real control if the first five guesses are not likely to work, and
 * `1234` / `0000` are close to a majority of real-world PINs. This is the one
 * place where being slightly annoying buys actual security.
 */
export function pinProblem(pin: string): PinProblem | null {
  if (!/^\d*$/.test(pin)) return 'not-digits';
  if (pin.length !== PIN_LENGTH) return 'wrong-length';

  if (new Set(pin).size === 1) return 'repeated';
  if (isSequential(pin)) return 'sequential';

  return null;
}

/** Runs of ±1 in either direction — 1234 and 4321 are equally guessable. */
function isSequential(pin: string): boolean {
  if (pin.length < 2) return false;

  const step = Number(pin[1]) - Number(pin[0]);
  if (step !== 1 && step !== -1) return false;

  for (let i = 2; i < pin.length; i += 1) {
    if (Number(pin[i]) - Number(pin[i - 1]) !== step) return false;
  }
  return true;
}

/** The message shown under the keypad. Copy lives with the rule it explains. */
export function pinProblemMessage(problem: PinProblem): string {
  switch (problem) {
    case 'wrong-length':
      return `Use ${PIN_LENGTH} digits.`;
    case 'not-digits':
      return 'Digits only.';
    case 'sequential':
      return 'Avoid runs like 1234 — they are the first thing anyone tries.';
    case 'repeated':
      return 'Avoid repeating the same digit.';
  }
}

export type LockoutState = {
  /** Consecutive failures since the last success. */
  attempts: number;
  /** Epoch ms the lockout expires, or null when not locked out. */
  lockedUntil: number | null;
};

export const NO_LOCKOUT: LockoutState = { attempts: 0, lockedUntil: null };

/**
 * Fold a failed attempt into the lockout state.
 *
 * The lockout is time-based rather than a counter that survives forever,
 * because the threat is a stranger with five minutes, not a determined
 * attacker with the device for a week — and a permanent lockout on a screen
 * lock strands the legitimate user with no recovery except signing out.
 */
export function registerFailure(state: LockoutState, now: number): LockoutState {
  const attempts = state.attempts + 1;
  if (attempts < MAX_ATTEMPTS) return { attempts, lockedUntil: null };
  return { attempts: 0, lockedUntil: now + LOCKOUT_MS };
}

/** Seconds left on a lockout; 0 when it has expired or was never set. */
export function lockoutSecondsRemaining(state: LockoutState, now: number): number {
  if (state.lockedUntil === null) return 0;
  return Math.max(0, Math.ceil((state.lockedUntil - now) / 1000));
}

export function isLockedOut(state: LockoutState, now: number): boolean {
  return lockoutSecondsRemaining(state, now) > 0;
}

/** Tries left before the next lockout, for the "2 attempts left" hint. */
export function attemptsRemaining(state: LockoutState): number {
  return Math.max(0, MAX_ATTEMPTS - state.attempts);
}
