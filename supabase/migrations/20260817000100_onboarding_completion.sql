-- ─────────────────────────────────────────────────────────────────────────────
-- profiles.onboarded_at — a record that onboarding HAPPENED
--
-- Until now "has this user been onboarded?" was inferred from
-- `accounts.length === 0` on the dashboard. That inference is wrong in every
-- case where the account list is empty for a reason other than being new:
--
--   - signing in on a second device before the accounts query resolves,
--   - archiving every account (the query filters `archived_at is null`),
--   - any stale-cache read of `[]` — the client cache is not per-user, so an
--     empty array can outlive the session that produced it.
--
-- Each of those drops a returning user into a five-step setup flow for an
-- account they already have. The fact is now stored where it belongs: on the
-- user, server-side, so it survives reinstalls and follows them to any device.
--
-- Nullable rather than `not null default now()`: the column has to be able to
-- say "not yet", and a default would mark every future signup as onboarded at
-- the moment the trigger creates their profile row.
--
-- No new policy or grant. `profiles: update own` (20260813000100) and the
-- table-level `grant select, update` (20260813000600) already cover it —
-- grants are per-table here, not per-column, so a new column inherits them.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column onboarded_at timestamptz;

comment on column public.profiles.onboarded_at is
  'When the user completed the onboarding flow. Null means never; the dashboard sends them to /onboarding.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: anyone who already owns an account has been through this.
--
-- Without this every existing user gets onboarding once more on their next
-- launch — the exact bug this migration exists to fix, delivered by the fix.
--
-- `accounts` is not filtered on `archived_at`: someone who set up their money
-- and then archived it all has still been onboarded, and re-running setup is
-- not what they want. Dated from their first account rather than `now()` so the
-- column reads as history rather than as "the day we shipped the migration".
-- ─────────────────────────────────────────────────────────────────────────────

update public.profiles p
set onboarded_at = first_account.created_at
from (
  select user_id, min(created_at) as created_at
  from public.accounts
  group by user_id
) as first_account
where first_account.user_id = p.id
  and p.onboarded_at is null;
