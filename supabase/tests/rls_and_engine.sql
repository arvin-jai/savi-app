-- ─────────────────────────────────────────────────────────────────────────────
-- M2 definition of done, as executable proof.
--
--   1. A second account CANNOT read the first's rows  (verified by query)
--   2. Transfer pairing constraints actually hold
--   3. Transfers do NOT count as spending
--   4. Available Money = Current Balance − Upcoming Bills, excluding liabilities
--
-- Run:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_and_engine.sql
--
-- ── FIXTURE IDS ARE RESERVED ─────────────────────────────────────────────────
-- Everything runs inside a transaction that is rolled back, so the suite leaves
-- no trace. But the ids below are hard-coded, so any seed or scratch data using
-- them collides on the primary key and the suite fails with a duplicate-key
-- error instead of a real one. Do not reuse:
--
--   users     1111…  2222…  (3333…, 4444… in calendar_tasks.sql)
--   accounts  aaaa1111-…
--
-- Assertions are scoped to these ids rather than global counts, so the suite
-- passes against a database that already holds real data.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on
\timing off

begin;

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Insert directly into auth.users; the handle_new_user trigger creates profiles.

-- The password hash is irrelevant: this script never authenticates, it sets
-- request.jwt.claims directly to exercise RLS. A literal avoids depending on
-- where pgcrypto's crypt() happens to live.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@test.local', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@test.local',   '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now());

-- Scoped to the fixture ids, not a global count: this suite has to pass against
-- a database that already has real users in it, not only a freshly reset one.
do $$
begin
  if (select count(*) from public.profiles
       where id in ('11111111-1111-1111-1111-111111111111',
                    '22222222-2222-2222-2222-222222222222')) <> 2 then
    raise exception 'FAIL: handle_new_user trigger did not create both profiles';
  end if;
  raise notice 'PASS  profile trigger created a row per user';
end $$;

-- Alice: a cash account, a savings account, and a credit card (liability).
insert into public.accounts (id, user_id, name, type, is_default, is_liability) values
  ('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cash',    'cash',        true,  false),
  ('aaaa1111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Savings', 'savings',     false, false),
  ('aaaa1111-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Visa',    'credit_card', false, true);

insert into public.accounts (id, user_id, name, type, is_default) values
  ('bbbb2222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Bob Cash', 'cash', true);

-- ── 1. Row Level Security ───────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

do $$
declare n int;
begin
  select count(*) into n from public.accounts;
  if n <> 3 then raise exception 'FAIL: Alice should see exactly her 3 accounts, saw %', n; end if;
  raise notice 'PASS  Alice sees her own 3 accounts';

  select count(*) into n from public.accounts where user_id = '22222222-2222-2222-2222-222222222222';
  if n <> 0 then raise exception 'FAIL: RLS LEAK — Alice can read % of Bob''s accounts', n; end if;
  raise notice 'PASS  Alice cannot read Bob''s accounts';

  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'FAIL: RLS LEAK — Alice sees % profiles, expected 1', n; end if;
  raise notice 'PASS  Alice sees only her own profile';
end $$;

-- Alice must not be able to write into Bob's account either.
do $$
begin
  begin
    insert into public.transactions (user_id, account_id, amount_minor, direction, type, classification)
    values ('22222222-2222-2222-2222-222222222222', 'bbbb2222-0000-0000-0000-000000000001', 10000, 'out', 'expense', 'want');
    raise exception 'FAIL: RLS LEAK — Alice wrote a transaction as Bob';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS  Alice cannot write rows owned by Bob';
  end;
end $$;

-- System categories are shared; user categories are not.
do $$
declare n int;
begin
  select count(*) into n from public.categories where user_id is null;
  if n <> 9 then raise exception 'FAIL: expected 9 system categories, saw %', n; end if;
  raise notice 'PASS  system categories readable (9, Bills correctly absent)';
end $$;

-- ── 2. Money movements and balance maintenance ──────────────────────────────

insert into public.transactions (user_id, account_id, amount_minor, direction, type, transaction_date)
values ('11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000001', 3000000, 'in', 'income', current_date);

insert into public.transactions (user_id, account_id, amount_minor, direction, type, classification, transaction_date)
values ('11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000001', 25000, 'out', 'expense', 'need', current_date);

do $$
declare bal bigint;
begin
  select balance_minor into bal from public.accounts where id = 'aaaa1111-0000-0000-0000-000000000001';
  if bal <> 2975000 then raise exception 'FAIL: cash balance should be 2,975,000 got %', bal; end if;
  raise notice 'PASS  balance maintained by trigger (₱30,000 in − ₱250 out = ₱29,750)';
end $$;

-- ── 3. Transfers ────────────────────────────────────────────────────────────

do $$
declare gid uuid; n int;
begin
  gid := public.create_transfer(
    'aaaa1111-0000-0000-0000-000000000001',
    'aaaa1111-0000-0000-0000-000000000002',
    500000
  );

  select count(*) into n from public.transactions where transfer_group_id = gid;
  if n <> 2 then raise exception 'FAIL: transfer wrote % rows, expected 2', n; end if;
  raise notice 'PASS  create_transfer wrote exactly 2 paired rows';
end $$;

do $$
declare cash bigint; savings bigint;
begin
  select balance_minor into cash    from public.accounts where id = 'aaaa1111-0000-0000-0000-000000000001';
  select balance_minor into savings from public.accounts where id = 'aaaa1111-0000-0000-0000-000000000002';
  if cash <> 2475000 then raise exception 'FAIL: cash after transfer should be 2,475,000 got %', cash; end if;
  if savings <> 500000 then raise exception 'FAIL: savings after transfer should be 500,000 got %', savings; end if;
  raise notice 'PASS  transfer moved money between accounts, both sides applied';
end $$;

-- A half-written transfer must not be able to commit.
do $$
begin
  begin
    insert into public.transactions (user_id, account_id, amount_minor, direction, type, transfer_group_id)
    values ('11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000001', 100, 'out', 'transfer', gen_random_uuid());
    -- The constraint is DEFERRABLE INITIALLY DEFERRED, so it would normally
    -- fire at COMMIT. Force it here so the failure is attributable.
    set constraints transactions_transfer_pair immediate;
    raise exception 'FAIL: a one-legged transfer was allowed';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'PASS  one-legged transfer rejected: %', left(sqlerrm, 60);
  end;
end $$;

-- Same-account transfer must be rejected.
do $$
begin
  begin
    perform public.create_transfer(
      'aaaa1111-0000-0000-0000-000000000001',
      'aaaa1111-0000-0000-0000-000000000001',
      100
    );
    raise exception 'FAIL: same-account transfer was allowed';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'PASS  same-account transfer rejected';
  end;
end $$;

-- Axis rules: classification is an expense-only concept.
do $$
begin
  begin
    insert into public.transactions (user_id, account_id, amount_minor, direction, type, classification)
    values ('11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000001', 100, 'in', 'income', 'want');
    raise exception 'FAIL: income was allowed to carry a classification';
  exception when check_violation then
    raise notice 'PASS  classification rejected on non-expense rows';
  end;

  begin
    insert into public.transactions (user_id, account_id, amount_minor, direction, type)
    values ('11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000001', 100, 'out', 'expense');
    raise exception 'FAIL: expense was allowed without a classification';
  exception when check_violation then
    raise notice 'PASS  classification required on expense rows';
  end;

  begin
    insert into public.transactions (user_id, account_id, amount_minor, direction, type, classification)
    values ('11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000001', -5, 'out', 'expense', 'need');
    raise exception 'FAIL: negative amount_minor was allowed';
  exception when check_violation then
    raise notice 'PASS  amount_minor must be a positive magnitude';
  end;
end $$;

-- ── 4. The calculation engine ───────────────────────────────────────────────

-- THE regression test for BUILD-PLAN P3: the ₱5,000 moved to savings must NOT
-- appear in Total Expenses. If it does, Savi tells a saving user they overspent.
do $$
declare s record;
begin
  select * into s from public.financial_summary();

  if s.total_income_minor <> 3000000 then
    raise exception 'FAIL: income should be 3,000,000 got %', s.total_income_minor;
  end if;

  if s.total_expenses_minor <> 25000 then
    raise exception 'FAIL: expenses should be 25,000 (the transfer must NOT count) got %',
      s.total_expenses_minor;
  end if;
  raise notice 'PASS  transfers excluded from spending — ₱5,000 to savings is not ₱5,000 spent';

  if s.remaining_minor <> 2975000 then
    raise exception 'FAIL: remaining should be 2,975,000 got %', s.remaining_minor;
  end if;
  raise notice 'PASS  Remaining = Income − Expenses';
end $$;

-- Liabilities excluded, bills deducted.
insert into public.transactions (user_id, account_id, amount_minor, direction, type, classification)
values ('11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000003', 800000, 'out', 'expense', 'want');

insert into public.bills (user_id, name, amount_minor, recurrence, due_day)
values ('11111111-1111-1111-1111-111111111111', 'Internet', 169900, 'monthly', 15);

do $$
declare s record; expected bigint;
begin
  select * into s from public.financial_summary();

  -- Cash 2,475,000 + Savings 500,000 = 2,975,000. The Visa (-800,000) is a
  -- liability and must be excluded.
  if s.current_balance_minor <> 2975000 then
    raise exception 'FAIL: current balance should exclude the credit card, got %', s.current_balance_minor;
  end if;
  raise notice 'PASS  Current Balance excludes liability accounts';

  if s.upcoming_bills_minor <> 169900 then
    raise exception 'FAIL: upcoming bills should be 169,900 got %', s.upcoming_bills_minor;
  end if;

  expected := 2975000 - 169900;
  if s.available_money_minor <> expected then
    raise exception 'FAIL: Available Money should be % got %', expected, s.available_money_minor;
  end if;
  raise notice 'PASS  Available Money = Current Balance − Upcoming Bills (₱28,051)';

  if s.available_money_minor = s.remaining_minor then
    raise exception 'FAIL: Available Money and Remaining must be different figures';
  end if;
  raise notice 'PASS  Available Money and Remaining are distinct (BUILD-PLAN P1)';
end $$;

-- Paying the bill removes it from upcoming.
insert into public.bill_payments (user_id, bill_id, period)
select '11111111-1111-1111-1111-111111111111', id, date_trunc('month', current_date)::date
  from public.bills limit 1;

do $$
declare s record;
begin
  select * into s from public.financial_summary();
  if s.upcoming_bills_minor <> 0 then
    raise exception 'FAIL: paid bill still counted as upcoming, got %', s.upcoming_bills_minor;
  end if;
  raise notice 'PASS  marking a bill paid removes it from Upcoming Bills';
end $$;

-- ── Bob's isolation, from Bob's side ────────────────────────────────────────

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';

do $$
declare n int; s record;
begin
  select count(*) into n from public.transactions;
  if n <> 0 then raise exception 'FAIL: RLS LEAK — Bob can see % of Alice''s transactions', n; end if;
  raise notice 'PASS  Bob sees none of Alice''s transactions';

  select * into s from public.financial_summary();
  if s.available_money_minor <> 0 then
    raise exception 'FAIL: RLS LEAK — Bob''s summary shows %', s.available_money_minor;
  end if;
  raise notice 'PASS  financial_summary is per-user (Bob sees zero)';
end $$;

rollback;

\echo ''
\echo '════════════════════════════════════════════════════════'
\echo ' ALL M2 CHECKS PASSED'
\echo '════════════════════════════════════════════════════════'
