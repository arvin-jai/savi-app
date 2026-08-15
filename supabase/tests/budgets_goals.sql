-- ─────────────────────────────────────────────────────────────────────────────
-- M11 (v0.5): budgets · financial_goals · the two waterfall aggregates.
--
-- The check that matters most here is the savings one. `saved_to_savings_minor`
-- measures TRANSFERS, and if it ever counted expenses instead the budget screen
-- would tell a saving user they had overspent — P3 in a new place.
--
-- Scoped to fixture ids so this passes against a database that already has real
-- data in it, not only a freshly reset one (the M2 lesson).
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gale@test.local', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now()),
  ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hana@test.local', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"77777777-7777-7777-7777-777777777777"}';

-- ── Grants are actually open ────────────────────────────────────────────────
do $$
begin
  perform 1 from public.budgets         limit 1;
  perform 1 from public.financial_goals limit 1;
  raise notice 'PASS  authenticated can reach budgets and financial_goals (grants present)';
end $$;

-- ── Budgets ─────────────────────────────────────────────────────────────────

insert into public.budgets (user_id, period, income_minor, needs_minor, wants_minor, savings_minor)
values ('77777777-7777-7777-7777-777777777777', date_trunc('month', current_date)::date,
        3000000, 1000000, 700000, 500000);

do $$
begin
  -- One plan per month. Two budgets for August is not a state with a meaning.
  begin
    insert into public.budgets (user_id, period, income_minor)
    values ('77777777-7777-7777-7777-777777777777', date_trunc('month', current_date)::date, 100);
    raise exception 'FAIL: a second budget for the same period was accepted';
  exception when unique_violation then
    raise notice 'PASS  only one budget per user per period';
  end;

  begin
    insert into public.budgets (user_id, period, needs_minor)
    values ('77777777-7777-7777-7777-777777777777', '2027-01-01', -500);
    raise exception 'FAIL: a negative allocation was accepted';
  exception when check_violation then
    raise notice 'PASS  budget allocations cannot be negative';
  end;
end $$;

-- Note what is NOT here: there is no bills column. Bills are derived from the
-- bills table (see the migration) so the plan cannot disagree with the ledger.
do $$
declare n int;
begin
  select count(*) into n
    from information_schema.columns
   where table_schema = 'public' and table_name = 'budgets'
     and column_name like '%bill%';
  if n <> 0 then
    raise exception 'FAIL: budgets grew a bills column — it must stay derived';
  end if;
  raise notice 'PASS  budgets stores no bills figure; it stays derived';
end $$;

-- ── Goals ───────────────────────────────────────────────────────────────────

insert into public.financial_goals (id, user_id, name, target_minor, saved_minor, target_date)
values ('dddddddd-0000-4000-8000-000000000001', '77777777-7777-7777-7777-777777777777',
        'Emergency fund', 5000000, 1800000, '2026-12-20');

do $$
begin
  begin
    insert into public.financial_goals (user_id, name, target_minor)
    values ('77777777-7777-7777-7777-777777777777', 'Zero', 0);
    raise exception 'FAIL: a zero target was accepted';
  exception when check_violation then
    raise notice 'PASS  a goal must have a positive target';
  end;

  begin
    insert into public.financial_goals (user_id, name, target_minor)
    values ('77777777-7777-7777-7777-777777777777', '   ', 1000);
    raise exception 'FAIL: a blank goal name was accepted';
  exception when check_violation then
    raise notice 'PASS  blank goal names rejected';
  end;

  begin
    insert into public.financial_goals (user_id, name, target_minor, saved_minor)
    values ('77777777-7777-7777-7777-777777777777', 'Negative', 1000, -1);
    raise exception 'FAIL: negative progress was accepted';
  exception when check_violation then
    raise notice 'PASS  saved progress cannot be negative';
  end;
end $$;

-- ── The waterfall aggregates ────────────────────────────────────────────────

insert into public.accounts (id, user_id, name, type, balance_minor, currency, is_liability)
values
  ('eeeeeeee-0000-4000-8000-000000000001', '77777777-7777-7777-7777-777777777777',
   'Cash',    'cash',    3000000, 'PHP', false),
  ('eeeeeeee-0000-4000-8000-000000000002', '77777777-7777-7777-7777-777777777777',
   'Savings', 'savings',       0, 'PHP', false);

insert into public.transactions
  (user_id, account_id, amount_minor, currency, direction, type, classification, transaction_date, description)
values
  ('77777777-7777-7777-7777-777777777777', 'eeeeeeee-0000-4000-8000-000000000001',
   300000, 'PHP', 'out', 'expense', 'need', date_trunc('month', current_date)::date, 'Groceries'),
  ('77777777-7777-7777-7777-777777777777', 'eeeeeeee-0000-4000-8000-000000000001',
   120000, 'PHP', 'out', 'expense', 'want', date_trunc('month', current_date)::date, 'Cinema'),
  ('77777777-7777-7777-7777-777777777777', 'eeeeeeee-0000-4000-8000-000000000001',
   169900, 'PHP', 'out', 'expense', 'bill', date_trunc('month', current_date)::date, 'Internet');

-- ₱5,000 into savings, then ₱2,000 back out.
select public.create_transfer(
  'eeeeeeee-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000002',
  500000, date_trunc('month', current_date)::date, 'To savings');
select public.create_transfer(
  'eeeeeeee-0000-4000-8000-000000000002', 'eeeeeeee-0000-4000-8000-000000000001',
  200000, date_trunc('month', current_date)::date, 'Back out');

do $$
declare need_total bigint; want_total bigint; bill_total bigint; saved bigint;
begin
  select total_minor into need_total from public.spending_by_classification() where classification = 'need';
  select total_minor into want_total from public.spending_by_classification() where classification = 'want';
  select total_minor into bill_total from public.spending_by_classification() where classification = 'bill';

  if need_total <> 300000 then raise exception 'FAIL: needs totalled %, expected 300000', need_total; end if;
  if want_total <> 120000 then raise exception 'FAIL: wants totalled %, expected 120000', want_total; end if;
  if bill_total <> 169900 then raise exception 'FAIL: bills totalled %, expected 169900', bill_total; end if;
  raise notice 'PASS  spending splits by classification (need/want/bill) correctly';

  -- The transfers must not appear in ANY classification bucket: they carry a
  -- null classification because they are not expenses (P4 + P3 together).
  if exists (select 1 from public.spending_by_classification() where classification is null) then
    raise exception 'FAIL: transfers leaked into the classification split';
  end if;
  raise notice 'PASS  transfers do not appear in the spending split';

  -- ₱5,000 in − ₱2,000 out = ₱3,000 actually saved, not ₱5,000.
  select public.saved_to_savings_minor() into saved;
  if saved <> 300000 then
    raise exception 'FAIL: saved read as %, expected 300000 (net of the withdrawal)', saved;
  end if;
  raise notice 'PASS  savings is net of money taken back out (300000, not 500000)';
end $$;

-- ── Isolation ───────────────────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"88888888-8888-8888-8888-888888888888"}';

do $$
declare n int;
begin
  select count(*) into n from public.budgets;
  if n <> 0 then raise exception 'FAIL: RLS LEAK — Hana sees % of Gale''s budgets', n; end if;
  raise notice 'PASS  Hana sees none of Gale''s budgets';

  select count(*) into n from public.financial_goals;
  if n <> 0 then raise exception 'FAIL: RLS LEAK — Hana sees % of Gale''s goals', n; end if;
  raise notice 'PASS  Hana sees none of Gale''s goals';

  -- Both aggregates are security invoker, so they summarise the CALLER's rows.
  select coalesce(sum(total_minor), 0) into n from public.spending_by_classification();
  if n <> 0 then
    raise exception 'FAIL: RLS LEAK — spending_by_classification returned % to Hana', n;
  end if;

  select public.saved_to_savings_minor() into n;
  if n <> 0 then
    raise exception 'FAIL: RLS LEAK — saved_to_savings_minor returned % to Hana', n;
  end if;
  raise notice 'PASS  both waterfall aggregates are scoped to the caller';

  begin
    insert into public.financial_goals (user_id, name, target_minor)
    values ('77777777-7777-7777-7777-777777777777', 'Injected', 1000);
    raise exception 'FAIL: RLS LEAK — Hana wrote a goal owned by Gale';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS  Hana cannot write goals owned by Gale';
  end;
end $$;

rollback;

\echo ''
\echo '  ALL M11 CHECKS PASSED'
