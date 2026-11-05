/**
 * Should this user see onboarding?
 *
 * Pure, because getting it wrong is expensive in both directions: a false
 * "onboard" drops a returning user into a five-step setup for money they have
 * already entered, and a false "ready" shows a brand-new user a dashboard of
 * zeros. Neither is reachable from a unit test if the rule lives inside a
 * screen effect, which is where it used to live.
 *
 * ── The three answers, and why 'wait' is one of them ─────────────────────────
 *
 * The honest third state is "we do not know yet". The previous version of this
 * rule had only two, and inferred the answer from `accounts.length === 0` —
 * which reads as "brand new user" for at least four reasons that are not that:
 *
 *   - the query has not resolved yet,
 *   - it resolved for a *different* session (the client cache is keyed
 *     `['accounts']`, not per user),
 *   - every account is archived (the query filters `archived_at is null`),
 *   - the user is signed out and RLS is correctly returning nothing.
 *
 * So the primary signal is now `profiles.onboarded_at`, which is a record of
 * something that happened rather than a guess from present state. The account
 * count survives only as the fallback for a profile that has never been
 * onboarded, and only once it has genuinely settled.
 *
 * ── "Settled" is not `!isLoading` ────────────────────────────────────────────
 *
 * TanStack's `isLoading` is false whenever the cache holds *any* data,
 * including data that is stale and mid-refetch. Gating navigation on it fires
 * against the old value — that is the M19 bug, onboarding running twice. Pass
 * `!isLoading && !isFetching` for the settled flags, or use `isSettled` below.
 */

/** What the dashboard should do about onboarding. */
export type OnboardingDecision =
  /** Not enough information yet — render, but do not navigate. */
  | 'wait'
  /** Send them to `/onboarding`. */
  | 'onboard'
  /** They are set up; stay on the dashboard. */
  | 'ready';

/** The shape of a query result this rule cares about. */
export type QueryStatus = { isLoading: boolean; isFetching: boolean };

/**
 * A query has settled when it holds data that is not being replaced. Both
 * flags, for the reason in the header: `isLoading` alone reports stale data as
 * ready.
 */
export function isSettled(q: QueryStatus): boolean {
  return !q.isLoading && !q.isFetching;
}

export type OnboardingInput = {
  /**
   * Null while signed out or before the row loads — never a reason to decide.
   *
   * `onboarded_at` is typed as optionally undefined on purpose, even though the
   * column is `not null`-able rather than absent: `select *` against a database
   * where migration 20260817000100 has not been applied returns rows with no
   * such key at all. See the truthiness check below.
   */
  profile: { onboarded_at?: string | null } | null | undefined;
  profileSettled: boolean;
  /** Non-archived accounts. Undefined until the query has produced something. */
  accounts: readonly unknown[] | undefined;
  accountsSettled: boolean;
};

export function onboardingDecision(input: OnboardingInput): OnboardingDecision {
  const { profile, profileSettled, accounts, accountsSettled } = input;

  // No profile, or one still in flight, tells us nothing. Notably this covers
  // the moment after sign-out and the moment after a cache clear, both of which
  // used to look identical to "new user with no accounts".
  if (!profileSettled || !profile) return 'wait';

  /**
   * The whole point of the column: a completed onboarding is a fact about the
   * user, and no amount of empty local state overrides it.
   *
   * Truthiness rather than `!== null`, because there are two ways to have no
   * value here and only one of them is a null. Against a database still missing
   * the column the field is `undefined`, and `undefined !== null` would mark
   * every user — including a genuinely new one — as onboarded, so nobody would
   * ever see setup. Falling through to the account count instead degrades to
   * exactly the old behaviour, which is the right failure mode for a client
   * that is ahead of its schema.
   */
  if (profile.onboarded_at) return 'ready';

  if (!accountsSettled || accounts === undefined) return 'wait';

  // Never onboarded AND owns nothing — the only case that is actually new.
  if (accounts.length === 0) return 'onboard';

  /**
   * Accounts but no `onboarded_at`. Either they quit onboarding partway (the
   * account step is the first one that writes) or they predate the column and
   * the backfill missed them. Onboarding again would ask for an account they
   * already have, so the dashboard wins and `useMarkOnboarded` closes the gap.
   */
  return 'ready';
}
