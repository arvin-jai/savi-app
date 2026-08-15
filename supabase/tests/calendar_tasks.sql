-- ─────────────────────────────────────────────────────────────────────────────
-- M8: calendar_events + tasks — isolation and constraints.
--
-- Scoped to fixture ids so this passes against a database that already has
-- real users in it, not only a freshly reset one (the M2 lesson).
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cara@test.local', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dan@test.local',  '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';

-- ── Grants are actually open ────────────────────────────────────────────────
-- M2 shipped policies with no grants and every table was inaccessible. This
-- asserts the pairing rather than assuming it.
do $$
begin
  perform 1 from public.tasks limit 1;
  perform 1 from public.calendar_events limit 1;
  raise notice 'PASS  authenticated can reach tasks and calendar_events (grants present)';
end $$;

insert into public.tasks (user_id, title, due_date, priority)
values ('33333333-3333-3333-3333-333333333333', 'Pay internet', current_date, 'high');

insert into public.calendar_events (user_id, title, event_date, kind, all_day)
values ('33333333-3333-3333-3333-333333333333', 'Project deadline', current_date, 'deadline', true);

-- ── Constraints ─────────────────────────────────────────────────────────────

do $$
begin
  begin
    insert into public.tasks (user_id, title, status)
    values ('33333333-3333-3333-3333-333333333333', 'Bad', 'done');
    raise exception 'FAIL: done task allowed with null completed_at';
  exception when check_violation then
    raise notice 'PASS  a done task must carry completed_at';
  end;

  begin
    insert into public.tasks (user_id, title) values ('33333333-3333-3333-3333-333333333333', '   ');
    raise exception 'FAIL: blank title allowed';
  exception when check_violation then
    raise notice 'PASS  blank task titles rejected';
  end;

  begin
    insert into public.calendar_events (user_id, title, event_date, all_day, start_time, end_time)
    values ('33333333-3333-3333-3333-333333333333', 'Backwards', current_date, false, '15:00', '09:00');
    raise exception 'FAIL: end before start allowed';
  exception when check_violation then
    raise notice 'PASS  event end time cannot precede start';
  end;

  begin
    insert into public.calendar_events (user_id, title, event_date, all_day)
    values ('33333333-3333-3333-3333-333333333333', 'Timed but no time', current_date, false);
    raise exception 'FAIL: timed event allowed with no start_time';
  exception when check_violation then
    raise notice 'PASS  a timed event must have a start time';
  end;
end $$;

-- ── Notification preferences (M9) ───────────────────────────────────────────

do $$
declare p record;
begin
  select * into p from public.notification_preferences
   where user_id = '33333333-3333-3333-3333-333333333333';

  if p is null then
    raise exception 'FAIL: signup trigger did not create notification preferences';
  end if;
  raise notice 'PASS  notification preferences seeded on signup';

  -- P§3's core user is someone who forgets payment dates: bills must be on out
  -- of the box, and everything else off so the app does not start noisy.
  if not p.bills_enabled then raise exception 'FAIL: bills should default ON'; end if;
  if p.tasks_enabled or p.events_enabled or p.income_enabled then
    raise exception 'FAIL: non-bill categories should default OFF';
  end if;
  raise notice 'PASS  bills default on, everything else off';
end $$;

do $$
begin
  begin
    update public.notification_preferences set bill_lead_days = 30
     where user_id = '33333333-3333-3333-3333-333333333333';
    raise exception 'FAIL: an out-of-range lead time was accepted';
  exception when check_violation then
    raise notice 'PASS  bill lead time is bounded';
  end;
end $$;

-- ── Isolation ───────────────────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444"}';

do $$
declare n int;
begin
  select count(*) into n from public.tasks;
  if n <> 0 then raise exception 'FAIL: RLS LEAK — Dan sees % of Cara''s tasks', n; end if;
  raise notice 'PASS  Dan sees none of Cara''s tasks';

  select count(*) into n from public.calendar_events;
  if n <> 0 then raise exception 'FAIL: RLS LEAK — Dan sees % of Cara''s events', n; end if;
  raise notice 'PASS  Dan sees none of Cara''s events';

  begin
    insert into public.tasks (user_id, title)
    values ('33333333-3333-3333-3333-333333333333', 'Injected');
    raise exception 'FAIL: RLS LEAK — Dan wrote a task as Cara';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS  Dan cannot write tasks owned by Cara';
  end;
end $$;

rollback;

\echo ''
\echo '  ALL M8 CHECKS PASSED'
