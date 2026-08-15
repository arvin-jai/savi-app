-- ─────────────────────────────────────────────────────────────────────────────
-- M13 (v0.7): P§30 Phase 10 — the hardening pass.
--
-- The product spec's testing phase lists specific scenarios. This file is that
-- list, executed rather than asserted:
--
--   multiple accounts · transfers · recurring bills · partial payments ·
--   refunds · negative balances · currencies · auth · RLS · data isolation
--
-- Prompt injection and AI tool permissions are covered in JS —
-- supabase/functions/ai-assistant/actions.test.ts — because that is where the
-- decision is made. AI key security is a code property (the key is only ever
-- read from Deno.env inside the Edge Function) and is checked by grep in the
-- release checklist, not here.
--
-- Scoped to fixture ids, per the M2 lesson.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('bbbbbbb1-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kit@test.local', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now()),
  ('bbbbbbb1-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lee@test.local', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbb1-0000-4000-8000-000000000001"}';

-- ── Multiple accounts, including a liability ────────────────────────────────

insert into public.accounts (id, user_id, name, type, balance_minor, currency, is_liability)
values
  ('ccccccc1-0000-4000-8000-000000000001', 'bbbbbbb1-0000-4000-8000-000000000001',
   'Cash',    'cash',        500000, 'PHP', false),
  ('ccccccc1-0000-4000-8000-000000000002', 'bbbbbbb1-0000-4000-8000-000000000001',
   'Bank',    'bank',       2000000, 'PHP', false),
  ('ccccccc1-0000-4000-8000-000000000003', 'bbbbbbb1-0000-4000-8000-000000000001',
   'Savings', 'savings',          0, 'PHP', false),
  ('ccccccc1-0000-4000-8000-000000000004', 'bbbbbbb1-0000-4000-8000-000000000001',
   'Visa',    'credit_card', 800000, 'PHP', true);

do $$
declare balance bigint;
begin
  -- ₱5,000 + ₱20,000 + ₱0 = ₱25,000. The ₱8,000 card is money OWED and must
  -- not inflate it (P1).
  select public.current_balance_minor('bbbbbbb1-0000-4000-8000-000000000001') into balance;
  if balance <> 2500000 then
    raise exception 'FAIL: current balance % across 4 accounts, expected 2500000', balance;
  end if;
  raise notice 'PASS  multiple accounts sum correctly; the credit card is excluded';
end $$;

-- ── Transfers across three accounts ─────────────────────────────────────────

select public.create_transfer(
  'ccccccc1-0000-4000-8000-000000000002', 'ccccccc1-0000-4000-8000-000000000003',
  1000000, current_date, 'Bank to savings');
select public.create_transfer(
  'ccccccc1-0000-4000-8000-000000000001', 'ccccccc1-0000-4000-8000-000000000003',
  200000, current_date, 'Cash to savings');

do $$
declare bank bigint; savings bigint; cash bigint; balance bigint;
begin
  select balance_minor into bank    from public.accounts where id = 'ccccccc1-0000-4000-8000-000000000002';
  select balance_minor into savings from public.accounts where id = 'ccccccc1-0000-4000-8000-000000000003';
  select balance_minor into cash    from public.accounts where id = 'ccccccc1-0000-4000-8000-000000000001';

  if bank <> 1000000 then raise exception 'FAIL: bank % after transfer out, expected 1000000', bank; end if;
  if cash <> 300000  then raise exception 'FAIL: cash % after transfer out, expected 300000', cash; end if;
  if savings <> 1200000 then raise exception 'FAIL: savings % after two transfers in, expected 1200000', savings; end if;
  raise notice 'PASS  two transfers across three accounts, every side applied';

  -- The total is unchanged: moving money between your own accounts creates none.
  select public.current_balance_minor('bbbbbbb1-0000-4000-8000-000000000001') into balance;
  if balance <> 2500000 then
    raise exception 'FAIL: transfers changed net worth — balance is %, expected 2500000', balance;
  end if;
  raise notice 'PASS  transfers do not change total balance';
end $$;

-- ── Refunds ─────────────────────────────────────────────────────────────────
-- P§30 lists refunds and the schema has no `refund` type. A refund is income
-- against the account it lands in — the important property is that it does not
-- subtract from Total Expenses, because "expenses net of refunds" would make
-- the two figures disagree with the transaction list a user can see.

insert into public.transactions
  (user_id, account_id, amount_minor, currency, direction, type, classification, transaction_date, description)
values
  ('bbbbbbb1-0000-4000-8000-000000000001', 'ccccccc1-0000-4000-8000-000000000001',
   150000, 'PHP', 'out', 'expense', 'want', date_trunc('month', current_date)::date, 'Headphones');

insert into public.transactions
  (user_id, account_id, amount_minor, currency, direction, type, transaction_date, description)
values
  ('bbbbbbb1-0000-4000-8000-000000000001', 'ccccccc1-0000-4000-8000-000000000001',
   150000, 'PHP', 'in', 'income', date_trunc('month', current_date)::date, 'Headphones refund');

do $$
declare s record; cash bigint;
begin
  select * into s from public.financial_summary(date_trunc('month', current_date)::date);

  if s.total_expenses_minor <> 150000 then
    raise exception 'FAIL: expenses % — a refund must not net off the expense', s.total_expenses_minor;
  end if;
  if s.total_income_minor <> 150000 then
    raise exception 'FAIL: refund did not register as income (got %)', s.total_income_minor;
  end if;
  raise notice 'PASS  a refund lands as income and leaves the original expense visible';

  select balance_minor into cash from public.accounts where id = 'ccccccc1-0000-4000-8000-000000000001';
  if cash <> 300000 then
    raise exception 'FAIL: cash % after expense+refund, expected 300000 (net zero)', cash;
  end if;
  raise notice 'PASS  expense and refund net to zero on the account';
end $$;

-- ── Recurring bills, partial payments, and the period rule ──────────────────

insert into public.bills (id, user_id, name, amount_minor, currency, recurrence, due_day)
values
  ('ddddddd1-0000-4000-8000-000000000001', 'bbbbbbb1-0000-4000-8000-000000000001',
   'Electricity', 240000, 'PHP', 'monthly', 15),
  ('ddddddd1-0000-4000-8000-000000000002', 'bbbbbbb1-0000-4000-8000-000000000001',
   'Internet', 169900, 'PHP', 'monthly', 20);

do $$
declare upcoming bigint;
begin
  select public.upcoming_bills_minor(
    'bbbbbbb1-0000-4000-8000-000000000001', date_trunc('month', current_date)::date
  ) into upcoming;
  if upcoming <> 409900 then
    raise exception 'FAIL: upcoming bills %, expected 409900', upcoming;
  end if;
  raise notice 'PASS  two unpaid recurring bills sum to 409900';
end $$;

-- Pay one. A payment is an EVENT (bill_payments), not a mutable flag — that is
-- what makes undo and payment history possible without a later migration.
insert into public.bill_payments (user_id, bill_id, period, paid_at)
values ('bbbbbbb1-0000-4000-8000-000000000001', 'ddddddd1-0000-4000-8000-000000000001',
        date_trunc('month', current_date)::date, now());

do $$
declare upcoming bigint;
begin
  select public.upcoming_bills_minor(
    'bbbbbbb1-0000-4000-8000-000000000001', date_trunc('month', current_date)::date
  ) into upcoming;
  if upcoming <> 169900 then
    raise exception 'FAIL: upcoming bills % after paying one, expected 169900', upcoming;
  end if;
  raise notice 'PASS  a paid bill leaves Upcoming Bills (partial payment of the month)';

  -- NEXT month it is unpaid again. A payment settles one period, not the bill.
  select public.upcoming_bills_minor(
    'bbbbbbb1-0000-4000-8000-000000000001',
    (date_trunc('month', current_date) + interval '1 month')::date
  ) into upcoming;
  if upcoming <> 409900 then
    raise exception 'FAIL: next month upcoming %, expected 409900 — a payment settled the wrong period', upcoming;
  end if;
  raise notice 'PASS  paying this month does not mark next month paid';
end $$;

-- ── Bills that recur every N months ─────────────────────────────────────────
-- A quarterly bill counted in the two months it is NOT due would overstate
-- Upcoming Bills and understate Available Money — the dashboard's headline
-- figure — every single month.

insert into public.bills (user_id, name, amount_minor, currency, recurrence, due_day, interval_months, anchor_month)
values ('bbbbbbb1-0000-4000-8000-000000000001', 'Insurance', 500000, 'PHP', 'monthly', 15, 3, '2026-02-01');

do $$
declare feb bigint; mar bigint; may bigint; apr bigint;
begin
  select public.upcoming_bills_minor('bbbbbbb1-0000-4000-8000-000000000001', '2026-02-01') into feb;
  select public.upcoming_bills_minor('bbbbbbb1-0000-4000-8000-000000000001', '2026-03-01') into mar;
  select public.upcoming_bills_minor('bbbbbbb1-0000-4000-8000-000000000001', '2026-04-01') into apr;
  select public.upcoming_bills_minor('bbbbbbb1-0000-4000-8000-000000000001', '2026-05-01') into may;

  -- Feb and May are occurrences; Mar and Apr are not. The other bills in this
  -- fixture are monthly, so they contribute to every month equally — what is
  -- asserted is the DIFFERENCE the quarterly bill makes.
  if feb - mar <> 500000 then
    raise exception 'FAIL: quarterly bill contributed % to Feb vs Mar, expected 500000', feb - mar;
  end if;
  if may - apr <> 500000 then
    raise exception 'FAIL: quarterly bill contributed % to May vs Apr, expected 500000', may - apr;
  end if;
  if mar <> apr then
    raise exception 'FAIL: two non-occurrence months disagree (% vs %)', mar, apr;
  end if;
  raise notice 'PASS  a quarterly bill counts only in the months it occurs';
end $$;

do $$
begin
  -- "Every 3 months" without an anchor is not a schedule — it cannot be
  -- evaluated, so it cannot be stored.
  begin
    insert into public.bills (user_id, name, amount_minor, recurrence, due_day, interval_months)
    values ('bbbbbbb1-0000-4000-8000-000000000001', 'No anchor', 100, 'monthly', 15, 3);
    raise exception 'FAIL: a non-monthly bill with no anchor was accepted';
  exception when check_violation then
    raise notice 'PASS  a non-monthly bill requires an anchor month';
  end;

  -- The anchor names a MONTH, so a day other than the 1st is ambiguous data.
  begin
    insert into public.bills (user_id, name, amount_minor, recurrence, due_day, interval_months, anchor_month)
    values ('bbbbbbb1-0000-4000-8000-000000000001', 'Mid anchor', 100, 'monthly', 15, 3, '2026-02-17');
    raise exception 'FAIL: an anchor that is not the 1st was accepted';
  exception when check_violation then
    raise notice 'PASS  the anchor must be the first of a month';
  end;

  begin
    insert into public.bills (user_id, name, amount_minor, recurrence, due_day, interval_months, anchor_month)
    values ('bbbbbbb1-0000-4000-8000-000000000001', 'Odd interval', 100, 'monthly', 15, 5, '2026-02-01');
    raise exception 'FAIL: an unsupported interval was accepted';
  exception when check_violation then
    raise notice 'PASS  only supported intervals are storable';
  end;
end $$;

-- Existing monthly bills must be completely unaffected by the new columns.
do $$
declare n int;
begin
  select count(*) into n from public.bills
   where user_id = 'bbbbbbb1-0000-4000-8000-000000000001'
     and interval_months = 1 and anchor_month is null;
  if n < 2 then
    raise exception 'FAIL: monthly bills did not default to interval 1 with no anchor';
  end if;
  raise notice 'PASS  monthly bills default to interval 1 and need no anchor';
end $$;

-- Archive the quarterly fixture so this block leaves the totals as it found
-- them. August IS a quarter month for a February anchor, so leaving it would
-- silently shift every assertion below by ₱5,000 — and a test file that grows
-- by accretion must not make each new section a trap for the next one.
update public.bills set archived_at = now()
 where user_id = 'bbbbbbb1-0000-4000-8000-000000000001' and name = 'Insurance';

-- ── Negative Available Money ────────────────────────────────────────────────
-- D§26 A1: show it rather than flooring at zero. Hiding it fails the user at
-- the exact moment they need the app.

insert into public.bills (user_id, name, amount_minor, currency, recurrence, due_day)
values ('bbbbbbb1-0000-4000-8000-000000000001', 'Rent', 3000000, 'PHP', 'monthly', 1);

do $$
declare s record;
begin
  select * into s from public.financial_summary(date_trunc('month', current_date)::date);

  -- Balance 2,500,000 − bills (169,900 + 3,000,000) = −669,900
  if s.available_money_minor >= 0 then
    raise exception 'FAIL: available money is % — it must be allowed to go negative', s.available_money_minor;
  end if;
  if s.available_money_minor <> -669900 then
    raise exception 'FAIL: available money %, expected -669900', s.available_money_minor;
  end if;
  raise notice 'PASS  Available Money goes negative rather than flooring at zero';
end $$;

-- ── Negative account balance ────────────────────────────────────────────────
do $$
declare cash bigint;
begin
  insert into public.transactions
    (user_id, account_id, amount_minor, currency, direction, type, classification, transaction_date, description)
  values
    ('bbbbbbb1-0000-4000-8000-000000000001', 'ccccccc1-0000-4000-8000-000000000001',
     500000, 'PHP', 'out', 'expense', 'need', current_date, 'Overdrawn');

  select balance_minor into cash from public.accounts where id = 'ccccccc1-0000-4000-8000-000000000001';
  if cash <> -200000 then
    raise exception 'FAIL: cash %, expected -200000 — an account must be allowed to go negative', cash;
  end if;
  raise notice 'PASS  an account balance may go negative (overdraft is a real state)';
end $$;

-- ── Currency (P7) ───────────────────────────────────────────────────────────
-- The column exists everywhere from day one because adding it later means a
-- migration over live money data. Single currency is enforced in the app, not
-- the database — so what is checked here is that the column is present and
-- constrained, not that a second currency is rejected.
do $$
declare n int;
begin
  select count(*) into n
    from information_schema.columns
   where table_schema = 'public'
     and table_name in ('accounts', 'transactions', 'bills', 'recurring_transactions', 'financial_goals')
     and column_name = 'currency';
  if n <> 5 then
    raise exception 'FAIL: only % of 5 money tables carry a currency column', n;
  end if;
  raise notice 'PASS  every money table carries a currency column';

  begin
    insert into public.accounts (user_id, name, type, balance_minor, currency)
    values ('bbbbbbb1-0000-4000-8000-000000000001', 'Bad', 'cash', 0, 'PESO');
    raise exception 'FAIL: a 4-character currency code was accepted';
  exception when check_violation then
    raise notice 'PASS  currency codes are constrained to 3 characters';
  end;
end $$;

-- ── Money is never a float ──────────────────────────────────────────────────
-- The most expensive thing to get wrong, and the easiest to reintroduce.
do $$
declare bad text;
begin
  select string_agg(table_name || '.' || column_name, ', ') into bad
    from information_schema.columns
   where table_schema = 'public'
     and (column_name like '%_minor' or column_name like '%amount%' or column_name like '%balance%')
     and data_type not in ('bigint', 'integer');

  if bad is not null then
    raise exception 'FAIL: non-integer money columns exist: %', bad;
  end if;
  raise notice 'PASS  every money column is an integer type — no floats in the ledger';
end $$;

-- ── RLS is on, everywhere ───────────────────────────────────────────────────
-- A table without RLS is a data leak. This asserts the property across the
-- whole schema rather than table by table, so a NEW table added later without
-- a policy fails this suite instead of shipping.
do $$
declare unprotected text;
begin
  select string_agg(c.relname, ', ') into unprotected
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and not c.relrowsecurity;

  if unprotected is not null then
    raise exception 'FAIL: tables without RLS: %', unprotected;
  end if;
  raise notice 'PASS  row level security is enabled on every public table';
end $$;

do $$
declare no_policy text;
begin
  select string_agg(c.relname, ', ') into no_policy
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and not exists (select 1 from pg_policies p where p.tablename = c.relname and p.schemaname = 'public');

  if no_policy is not null then
    raise exception 'FAIL: RLS enabled but NO policies on: % (the table is unreachable)', no_policy;
  end if;
  raise notice 'PASS  every table with RLS also has at least one policy';
end $$;

-- ── Full isolation sweep ────────────────────────────────────────────────────
-- Every user-owned table, checked from the other user's session in one pass.

set local request.jwt.claims = '{"sub":"bbbbbbb1-0000-4000-8000-000000000002"}';

do $$
declare t text; n int;
begin
  foreach t in array array[
    'accounts', 'transactions', 'bills', 'bill_payments', 'recurring_transactions',
    'tasks', 'calendar_events', 'budgets', 'financial_goals',
    'ai_conversations', 'ai_messages', 'ai_tool_grants', 'ai_action_log'
  ] loop
    execute format('select count(*) from public.%I', t) into n;
    if n <> 0 then
      raise exception 'FAIL: RLS LEAK — Lee sees % rows of Kit''s %', n, t;
    end if;
  end loop;
  raise notice 'PASS  Lee sees zero rows across all 13 user-owned tables';
end $$;

do $$
declare s record;
begin
  select * into s from public.financial_summary(date_trunc('month', current_date)::date);
  if s.current_balance_minor <> 0 or s.total_expenses_minor <> 0 then
    raise exception 'FAIL: RLS LEAK — financial_summary returned Kit''s figures to Lee';
  end if;
  raise notice 'PASS  the calculation engine is per-user';
end $$;

rollback;

\echo ''
\echo '  ALL M13 HARDENING CHECKS PASSED'
