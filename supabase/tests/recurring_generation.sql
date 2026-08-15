-- ─────────────────────────────────────────────────────────────────────────────
-- M16: recurring transactions actually generate.
--
-- The property that matters most is IDEMPOTENCY. This function runs on every
-- app open, so "called twice" is the normal case, not the edge case — and the
-- thing it creates is income. Two salaries because a screen mounted twice would
-- be a corrupted ledger, and the user would have no way to know which of the
-- two was real.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('fffffff9-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pia@test.local', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now()),
  ('fffffff9-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'raj@test.local', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"fffffff9-0000-4000-8000-000000000001"}';

insert into public.accounts (id, user_id, name, type, balance_minor, currency)
values ('aaaaaaa9-0000-4000-8000-000000000001', 'fffffff9-0000-4000-8000-000000000001',
        'Bank', 'bank', 0, 'PHP');

insert into public.recurring_transactions
  (id, user_id, account_id, amount_minor, currency, direction, type, description,
   recurrence, day_of_month, next_run)
values ('bbbbbbb9-0000-4000-8000-000000000001', 'fffffff9-0000-4000-8000-000000000001',
        'aaaaaaa9-0000-4000-8000-000000000001', 3000000, 'PHP', 'in', 'income', 'Salary',
        'monthly', 15, '2026-06-15');

-- ── Generation ──────────────────────────────────────────────────────────────

do $$
declare made int; n int; bal bigint;
begin
  -- From Jun 15 up to Aug 20 → Jun, Jul, Aug = 3 salaries.
  select public.generate_due_recurring('2026-08-20') into made;
  if made <> 3 then raise exception 'FAIL: generated %, expected 3', made; end if;

  select count(*) into n from public.transactions
   where recurring_transaction_id = 'bbbbbbb9-0000-4000-8000-000000000001';
  if n <> 3 then raise exception 'FAIL: % transactions exist, expected 3', n; end if;
  raise notice 'PASS  three missed paydays generated (Jun, Jul, Aug)';

  -- The balance trigger applied to every one of them.
  select balance_minor into bal from public.accounts
   where id = 'aaaaaaa9-0000-4000-8000-000000000001';
  if bal <> 9000000 then raise exception 'FAIL: balance %, expected 9000000', bal; end if;
  raise notice 'PASS  generated income moved the account balance';
end $$;

-- ── Idempotency — the property that matters ─────────────────────────────────

do $$
declare made int; n int;
begin
  select public.generate_due_recurring('2026-08-20') into made;
  if made <> 0 then raise exception 'FAIL: a second run generated % more', made; end if;

  select count(*) into n from public.transactions
   where recurring_transaction_id = 'bbbbbbb9-0000-4000-8000-000000000001';
  if n <> 3 then raise exception 'FAIL: % transactions after re-run, expected 3', n; end if;
  raise notice 'PASS  running it again generates nothing (idempotent)';
end $$;

-- Even with next_run forced backwards — a stale client, a restored backup —
-- the unique index refuses a duplicate rather than trusting the caller.
do $$
declare made int; n int;
begin
  update public.recurring_transactions set next_run = '2026-06-15'
   where id = 'bbbbbbb9-0000-4000-8000-000000000001';

  select public.generate_due_recurring('2026-08-20') into made;

  select count(*) into n from public.transactions
   where recurring_transaction_id = 'bbbbbbb9-0000-4000-8000-000000000001';
  if n <> 3 then
    raise exception 'FAIL: rewinding next_run produced duplicates — % rows', n;
  end if;
  raise notice 'PASS  a rewound next_run cannot double-pay (unique index holds)';
end $$;

-- ── The day-of-month clamp ──────────────────────────────────────────────────
-- A payday on the 31st must land on Feb 28 and then RETURN to the 31st, not
-- drift permanently to the 28th.

insert into public.recurring_transactions
  (id, user_id, account_id, amount_minor, currency, direction, type, description,
   recurrence, day_of_month, next_run)
values ('bbbbbbb9-0000-4000-8000-000000000002', 'fffffff9-0000-4000-8000-000000000001',
        'aaaaaaa9-0000-4000-8000-000000000001', 100000, 'PHP', 'in', 'income', 'Rent from tenant',
        'monthly', 31, '2026-01-31');

do $$
declare dates date[];
begin
  perform public.generate_due_recurring('2026-04-30');

  select array_agg(transaction_date order by transaction_date) into dates
    from public.transactions
   where recurring_transaction_id = 'bbbbbbb9-0000-4000-8000-000000000002';

  if dates <> array['2026-01-31','2026-02-28','2026-03-31','2026-04-30']::date[] then
    raise exception 'FAIL: clamped dates were %, expected Jan31/Feb28/Mar31/Apr30', dates;
  end if;
  raise notice 'PASS  a 31st payday clamps to Feb 28 and returns to the 31st';
end $$;

-- ── Nothing is generated ahead of time ──────────────────────────────────────
do $$
declare n_before int; n_after int;
begin
  select count(*) into n_before from public.transactions
   where user_id = 'fffffff9-0000-4000-8000-000000000001';

  perform public.generate_due_recurring('2026-04-30');

  select count(*) into n_after from public.transactions
   where user_id = 'fffffff9-0000-4000-8000-000000000001';

  if n_after <> n_before then
    raise exception 'FAIL: generating for a past date created % future rows', n_after - n_before;
  end if;
  raise notice 'PASS  nothing is generated beyond the given date';
end $$;

-- ── An ARCHIVED ACCOUNT stops the schedule paying into it ───────────────────
--
-- Distinct from an archived schedule below. Archiving an account is the answer
-- Savi offers instead of deleting, so it must not keep manufacturing money into
-- something the user can no longer see. Uses its own account and schedule so it
-- does not disturb the fixtures the later checks count.
insert into public.accounts (id, user_id, name, type, balance_minor, currency)
values ('aaaaaaa9-0000-4000-8000-000000000009', 'fffffff9-0000-4000-8000-000000000001',
        'Old payroll', 'bank', 0, 'PHP');

insert into public.recurring_transactions
  (id, user_id, account_id, amount_minor, currency, direction, type, description,
   recurrence, day_of_month, next_run)
values ('bbbbbbb9-0000-4000-8000-000000000009', 'fffffff9-0000-4000-8000-000000000001',
        'aaaaaaa9-0000-4000-8000-000000000009', 500000, 'PHP', 'in', 'income', 'Old salary',
        'monthly', 15, '2026-06-15');

do $$
declare n int;
begin
  update public.accounts set archived_at = now()
   where id = 'aaaaaaa9-0000-4000-8000-000000000009';

  perform public.generate_due_recurring('2026-08-31');

  select count(*) into n from public.transactions
   where recurring_transaction_id = 'bbbbbbb9-0000-4000-8000-000000000009';
  if n <> 0 then
    raise exception 'FAIL: an archived ACCOUNT still generated % transactions', n;
  end if;
  raise notice 'PASS  a schedule paying into an archived account generates nothing';
end $$;

-- And the schedule resumes if the account comes back — archiving is reversible,
-- so stopping generation must be too.
do $$
declare n int;
begin
  update public.accounts set archived_at = null
   where id = 'aaaaaaa9-0000-4000-8000-000000000009';

  perform public.generate_due_recurring('2026-08-31');

  select count(*) into n from public.transactions
   where recurring_transaction_id = 'bbbbbbb9-0000-4000-8000-000000000009';
  if n = 0 then
    raise exception 'FAIL: un-archiving the account did not resume generation';
  end if;
  raise notice 'PASS  un-archiving the account resumes generation (% rows)', n;
end $$;

-- ── Archived schedules stop generating ──────────────────────────────────────
do $$
declare made int;
begin
  update public.recurring_transactions set archived_at = now(), next_run = '2026-05-15'
   where id = 'bbbbbbb9-0000-4000-8000-000000000001';

  select public.generate_due_recurring('2026-12-31') into made;

  if exists (
    select 1 from public.transactions
     where recurring_transaction_id = 'bbbbbbb9-0000-4000-8000-000000000001'
       and transaction_date > '2026-08-20'
  ) then
    raise exception 'FAIL: an archived schedule kept generating';
  end if;
  raise notice 'PASS  an archived schedule generates nothing';
end $$;

-- ── Deleting a schedule keeps the money it already generated ────────────────
do $$
declare n int;
begin
  delete from public.recurring_transactions
   where id = 'bbbbbbb9-0000-4000-8000-000000000001';

  select count(*) into n from public.transactions
   where user_id = 'fffffff9-0000-4000-8000-000000000001'
     and description = 'Salary';
  if n <> 3 then
    raise exception 'FAIL: deleting the schedule destroyed % of 3 salary rows', 3 - n;
  end if;
  raise notice 'PASS  deleting a schedule keeps the income it already produced';
end $$;

-- ── Isolation ───────────────────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"fffffff9-0000-4000-8000-000000000002"}';

do $$
declare made int;
begin
  -- security invoker: Raj generating produces nothing from Pia's schedules.
  select public.generate_due_recurring('2026-12-31') into made;
  if made <> 0 then
    raise exception 'FAIL: RLS LEAK — Raj generated % transactions from Pia''s schedule', made;
  end if;
  raise notice 'PASS  generation is scoped to the caller';
end $$;

rollback;

\echo ''
\echo '  ALL M16 CHECKS PASSED'
