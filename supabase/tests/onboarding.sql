-- ─────────────────────────────────────────────────────────────────────────────
-- profiles.onboarded_at — the record that stops onboarding running twice.
--
--   1. A fresh signup starts null (the trigger must not mark anyone onboarded)
--   2. A user can mark THEMSELVES onboarded
--   3. A user CANNOT mark, or unmark, anyone else  (verified by query, not by
--      reading the policy)
--   4. Archiving every account does not undo it — the case the old
--      account-count rule got wrong
--
-- Run:  npm run db:test:onboarding
--
-- ── FIXTURE IDS ARE RESERVED ─────────────────────────────────────────────────
-- Rolled back at the end, so nothing is left behind, but the ids are literal
-- and collide on the primary key if anything else uses them. Every other id in
-- 1111…–9999… is taken by another suite; this one owns:
--
--   users     a0a0a0a0-…  b0b0b0b0-…
--   accounts  a0ac0000-…
--
-- Assertions are scoped to those ids rather than global counts, so this passes
-- against a database that already holds real data.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on
\timing off

begin;

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- The password hash is irrelevant: this script never authenticates, it sets
-- request.jwt.claims directly to exercise RLS.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('a0a0a0a0-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'onboard-alice@test.local', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now()),
  ('b0b0b0b0-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'onboard-bob@test.local',   '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now());

-- ── 1. A new signup has NOT been onboarded ──────────────────────────────────
-- A default on the column would break this, which is why it is nullable: the
-- trigger creates the profile at signup, long before anyone finishes setup.
do $$
begin
  if exists (
    select 1 from public.profiles
    where id in ('a0a0a0a0-0000-0000-0000-000000000001',
                 'b0b0b0b0-0000-0000-0000-000000000002')
      and onboarded_at is not null
  ) then
    raise exception 'FAIL: a brand-new profile arrived already marked as onboarded';
  end if;
  raise notice 'PASS  new signups start with onboarded_at null';
end $$;

-- ── 2. A user can mark themselves onboarded ─────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0a0a0a0-0000-0000-0000-000000000001","role":"authenticated"}';

update public.profiles
set onboarded_at = now()
where id = 'a0a0a0a0-0000-0000-0000-000000000001'
  and onboarded_at is null;

do $$
begin
  if (select onboarded_at from public.profiles
      where id = 'a0a0a0a0-0000-0000-0000-000000000001') is null then
    raise exception 'FAIL: a user could not mark their own profile onboarded';
  end if;
  raise notice 'PASS  a user can mark themselves onboarded';
end $$;

-- ── 3. …and nobody else ─────────────────────────────────────────────────────
-- The update below matches no rows rather than raising: RLS filters the row out
-- of the UPDATE's view entirely. Silence is exactly why this is asserted by
-- reading the value back rather than by expecting an error.
update public.profiles
set onboarded_at = now()
where id = 'b0b0b0b0-0000-0000-0000-000000000002';

reset role;

do $$
begin
  if (select onboarded_at from public.profiles
      where id = 'b0b0b0b0-0000-0000-0000-000000000002') is not null then
    raise exception 'FAIL: alice marked BOB onboarded — profiles UPDATE policy is not scoping to auth.uid()';
  end if;
  raise notice 'PASS  a user cannot mark another user onboarded';
end $$;

-- Bob cannot un-mark Alice either. Unsetting the flag is the one write that
-- would push a returning user back through setup.
set local role authenticated;
set local request.jwt.claims = '{"sub":"b0b0b0b0-0000-0000-0000-000000000002","role":"authenticated"}';

update public.profiles set onboarded_at = null
where id = 'a0a0a0a0-0000-0000-0000-000000000001';

reset role;

do $$
begin
  if (select onboarded_at from public.profiles
      where id = 'a0a0a0a0-0000-0000-0000-000000000001') is null then
    raise exception 'FAIL: bob cleared alice''s onboarded_at';
  end if;
  raise notice 'PASS  a user cannot clear another user''s onboarded_at';
end $$;

-- ── 4. Archiving every account leaves it set ────────────────────────────────
-- This is the bug in one assertion. The dashboard used to infer onboarding from
-- accounts where archived_at is null, so emptying that list re-ran setup for
-- someone who had already done it.
insert into public.accounts (id, user_id, name, type, is_default) values
  ('a0ac0000-0000-0000-0000-000000000001', 'a0a0a0a0-0000-0000-0000-000000000001', 'Cash', 'cash', true);

update public.accounts set archived_at = now()
where id = 'a0ac0000-0000-0000-0000-000000000001';

do $$
begin
  if (select count(*) from public.accounts
      where user_id = 'a0a0a0a0-0000-0000-0000-000000000001'
        and archived_at is null) <> 0 then
    raise exception 'FAIL: fixture did not archive the account';
  end if;

  if (select onboarded_at from public.profiles
      where id = 'a0a0a0a0-0000-0000-0000-000000000001') is null then
    raise exception 'FAIL: archiving every account cleared onboarded_at';
  end if;
  raise notice 'PASS  onboarding survives archiving every account';
end $$;

rollback;
