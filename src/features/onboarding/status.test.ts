import { isSettled, onboardingDecision, type OnboardingInput } from './status';

const account = { id: 'a1' };

function input(over: Partial<OnboardingInput> = {}): OnboardingInput {
  return {
    profile: { onboarded_at: null },
    profileSettled: true,
    accounts: [],
    accountsSettled: true,
    ...over,
  };
}

describe('isSettled', () => {
  it('is false while a first load is running', () => {
    expect(isSettled({ isLoading: true, isFetching: true })).toBe(false);
  });

  // The M19 bug in one assertion: isLoading goes false the moment the cache
  // holds anything, including the stale value a refetch is about to replace.
  it('is false while stale data is being refetched, even though isLoading is false', () => {
    expect(isSettled({ isLoading: false, isFetching: true })).toBe(false);
  });

  it('is true only when nothing is in flight', () => {
    expect(isSettled({ isLoading: false, isFetching: false })).toBe(true);
  });
});

describe('onboardingDecision', () => {
  it('onboards a genuinely new user: never onboarded, owns nothing', () => {
    expect(onboardingDecision(input())).toBe('onboard');
  });

  it('does NOT onboard a returning user whose account list is empty', () => {
    // The reported bug: signing in on a device where the cache has not caught
    // up, or where every account is archived, used to re-run setup.
    expect(
      onboardingDecision(input({ profile: { onboarded_at: '2026-08-01T00:00:00Z' }, accounts: [] }))
    ).toBe('ready');
  });

  it('trusts onboarded_at even before the accounts query has settled', () => {
    expect(
      onboardingDecision(
        input({
          profile: { onboarded_at: '2026-08-01T00:00:00Z' },
          accounts: undefined,
          accountsSettled: false,
        })
      )
    ).toBe('ready');
  });

  it('waits while the profile is still loading', () => {
    expect(onboardingDecision(input({ profile: undefined, profileSettled: false }))).toBe('wait');
  });

  it('waits when there is no profile at all — signed out is not new', () => {
    expect(onboardingDecision(input({ profile: null }))).toBe('wait');
  });

  it('waits while the accounts query is refetching a stale empty array', () => {
    expect(onboardingDecision(input({ accountsSettled: false }))).toBe('wait');
  });

  it('waits when accounts have never produced a value', () => {
    expect(onboardingDecision(input({ accounts: undefined }))).toBe('wait');
  });

  it('falls back to the account count when the column is missing entirely', () => {
    // A client running ahead of its schema gets `undefined`, not null. Reading
    // that as "onboarded" would hide setup from every new user, so the rule has
    // to degrade to the old behaviour instead.
    expect(onboardingDecision(input({ profile: {}, accounts: [] }))).toBe('onboard');
    expect(onboardingDecision(input({ profile: {}, accounts: [account] }))).toBe('ready');
  });

  it('leaves a user who has accounts but no onboarded_at on the dashboard', () => {
    // Quit partway through, or predates the column and the backfill missed
    // them. Either way, do not ask for an account they already have.
    expect(onboardingDecision(input({ accounts: [account] }))).toBe('ready');
  });
});
