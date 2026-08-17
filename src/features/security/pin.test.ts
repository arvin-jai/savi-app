import {
  attemptsRemaining,
  isLockedOut,
  lockoutSecondsRemaining,
  LOCKOUT_MS,
  MAX_ATTEMPTS,
  NO_LOCKOUT,
  pinProblem,
  pinProblemMessage,
  registerFailure,
} from './pin';

describe('pinProblem', () => {
  it('accepts an ordinary 4-digit PIN', () => {
    expect(pinProblem('1937')).toBeNull();
  });

  it('rejects any length other than four', () => {
    expect(pinProblem('193')).toBe('wrong-length');
    expect(pinProblem('')).toBe('wrong-length');
    expect(pinProblem('19371')).toBe('wrong-length');
  });

  it('rejects non-digits before length, so "abc" is not reported as wrong-length', () => {
    expect(pinProblem('abc')).toBe('not-digits');
    expect(pinProblem('12 4')).toBe('not-digits');
  });

  it('rejects a single repeated digit', () => {
    expect(pinProblem('0000')).toBe('repeated');
    expect(pinProblem('7777')).toBe('repeated');
  });

  it('rejects ascending and descending runs', () => {
    expect(pinProblem('1234')).toBe('sequential');
    expect(pinProblem('4321')).toBe('sequential');
    expect(pinProblem('6789')).toBe('sequential');
  });

  it('allows a partial run that does not continue', () => {
    // The first three ascend, the fourth breaks it — guessable-ish, but not the
    // pattern the rule is about, and over-rejecting trains users to fight it.
    expect(pinProblem('1237')).toBeNull();
  });

  it('does not treat a wrapping run as sequential', () => {
    expect(pinProblem('8901')).toBeNull();
  });

  it('has a message for every problem it can report', () => {
    const problems = ['wrong-length', 'not-digits', 'sequential', 'repeated'] as const;
    for (const p of problems) {
      expect(pinProblemMessage(p).length).toBeGreaterThan(0);
    }
  });
});

describe('lockout', () => {
  const NOW = 1_760_000_000_000;

  it('counts failures without locking until the threshold', () => {
    let state = NO_LOCKOUT;
    for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
      state = registerFailure(state, NOW);
      expect(state.lockedUntil).toBeNull();
      expect(attemptsRemaining(state)).toBe(MAX_ATTEMPTS - i);
    }
  });

  it('locks out on the threshold failure and resets the counter', () => {
    let state = NO_LOCKOUT;
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) state = registerFailure(state, NOW);

    expect(state.lockedUntil).toBe(NOW + LOCKOUT_MS);
    // Reset, so the next lockout needs another full run rather than one more tap.
    expect(state.attempts).toBe(0);
    expect(isLockedOut(state, NOW)).toBe(true);
  });

  it('reports whole seconds remaining, rounded up', () => {
    const state = { attempts: 0, lockedUntil: NOW + 2_400 };
    expect(lockoutSecondsRemaining(state, NOW)).toBe(3);
  });

  it('expires rather than persisting', () => {
    const state = { attempts: 0, lockedUntil: NOW + LOCKOUT_MS };
    expect(isLockedOut(state, NOW + LOCKOUT_MS)).toBe(false);
    expect(lockoutSecondsRemaining(state, NOW + LOCKOUT_MS + 5_000)).toBe(0);
  });

  it('is not locked out when no lockout was ever set', () => {
    expect(isLockedOut(NO_LOCKOUT, NOW)).toBe(false);
    expect(lockoutSecondsRemaining(NO_LOCKOUT, NOW)).toBe(0);
  });
});
