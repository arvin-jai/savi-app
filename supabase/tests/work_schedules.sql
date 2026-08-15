-- ─────────────────────────────────────────────────────────────────────────────
-- M14: work_schedules + work_shift_exceptions — the v0.2 table v0.2 deferred.
--
-- Stored as a RULE, with exceptions as rows. What the constraints have to
-- guarantee is that no row can describe a shift that makes no sense: a 'moved'
-- exception with no new hours, a 'skipped' one that carries hours, an end time
-- before a start, or two exceptions disagreeing about the same date.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('ccccccc9-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mira@test.local', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now()),
  ('ccccccc9-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'noel@test.local', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"ccccccc9-0000-4000-8000-000000000001"}';

do $$
begin
  perform 1 from public.work_schedules        limit 1;
  perform 1 from public.work_shift_exceptions limit 1;
  raise notice 'PASS  authenticated can reach work_schedules and exceptions (grants present)';
end $$;

insert into public.work_schedules (id, user_id, name, days_of_week, start_time, end_time, effective_from)
values ('eeeeeee9-0000-4000-8000-000000000001', 'ccccccc9-0000-4000-8000-000000000001',
        'Day shift', array[1,3,5]::smallint[], '09:00', '17:00', '2026-08-01');

-- ── Schedule constraints ────────────────────────────────────────────────────

do $$
begin
  begin
    insert into public.work_schedules (user_id, name, days_of_week)
    values ('ccccccc9-0000-4000-8000-000000000001', 'Bad', array[]::smallint[]);
    raise exception 'FAIL: a schedule with no days was accepted';
  exception when check_violation then
    raise notice 'PASS  a schedule must run on at least one day';
  end;

  begin
    insert into public.work_schedules (user_id, name, days_of_week)
    values ('ccccccc9-0000-4000-8000-000000000001', 'Bad', array[7]::smallint[]);
    raise exception 'FAIL: weekday 7 was accepted (valid range is 0-6)';
  exception when check_violation then
    raise notice 'PASS  weekday numbers are bounded to 0-6';
  end;

  begin
    insert into public.work_schedules (user_id, name, days_of_week, start_time, end_time)
    values ('ccccccc9-0000-4000-8000-000000000001', 'Backwards', array[1]::smallint[], '17:00', '09:00');
    raise exception 'FAIL: end before start was accepted';
  exception when check_violation then
    raise notice 'PASS  a shift cannot end before it starts';
  end;

  begin
    insert into public.work_schedules (user_id, name, days_of_week, end_time)
    values ('ccccccc9-0000-4000-8000-000000000001', 'Dangling', array[1]::smallint[], '17:00');
    raise exception 'FAIL: an end time with no start time was accepted';
  exception when check_violation then
    raise notice 'PASS  an end time requires a start time';
  end;

  begin
    insert into public.work_schedules (user_id, name, days_of_week, effective_from, effective_to)
    values ('ccccccc9-0000-4000-8000-000000000001', 'Reversed', array[1]::smallint[], '2026-08-01', '2026-07-01');
    raise exception 'FAIL: effective_to before effective_from was accepted';
  exception when check_violation then
    raise notice 'PASS  the effective range cannot run backwards';
  end;

  begin
    insert into public.work_schedules (user_id, name, days_of_week)
    values ('ccccccc9-0000-4000-8000-000000000001', '   ', array[1]::smallint[]);
    raise exception 'FAIL: a blank schedule name was accepted';
  exception when check_violation then
    raise notice 'PASS  blank schedule names rejected';
  end;
end $$;

-- ── Exception constraints ───────────────────────────────────────────────────

insert into public.work_shift_exceptions (user_id, schedule_id, shift_date, kind)
values ('ccccccc9-0000-4000-8000-000000000001', 'eeeeeee9-0000-4000-8000-000000000001',
        '2026-08-19', 'skipped');

do $$
begin
  -- A 'moved' exception with no new hours says nothing.
  begin
    insert into public.work_shift_exceptions (user_id, schedule_id, shift_date, kind)
    values ('ccccccc9-0000-4000-8000-000000000001', 'eeeeeee9-0000-4000-8000-000000000001',
            '2026-08-21', 'moved');
    raise exception 'FAIL: a moved exception without hours was accepted';
  exception when check_violation then
    raise notice 'PASS  a moved shift must carry its new hours';
  end;

  -- A 'skipped' exception with hours is contradictory.
  begin
    insert into public.work_shift_exceptions (user_id, schedule_id, shift_date, kind, start_time, end_time)
    values ('ccccccc9-0000-4000-8000-000000000001', 'eeeeeee9-0000-4000-8000-000000000001',
            '2026-08-24', 'skipped', '09:00', '17:00');
    raise exception 'FAIL: a skipped exception with hours was accepted';
  exception when check_violation then
    raise notice 'PASS  a skipped shift cannot carry hours';
  end;

  -- Two rows disagreeing about the same date is not a state with a meaning.
  begin
    insert into public.work_shift_exceptions (user_id, schedule_id, shift_date, kind, start_time, end_time)
    values ('ccccccc9-0000-4000-8000-000000000001', 'eeeeeee9-0000-4000-8000-000000000001',
            '2026-08-19', 'moved', '13:00', '21:00');
    raise exception 'FAIL: a second exception for the same date was accepted';
  exception when unique_violation then
    raise notice 'PASS  at most one exception per shift date';
  end;
end $$;

-- ── Archiving preserves history ─────────────────────────────────────────────
-- A job you left should still show the weeks you worked it; deleting the rule
-- would rewrite that.
do $$
declare n int;
begin
  update public.work_schedules set archived_at = now()
   where id = 'eeeeeee9-0000-4000-8000-000000000001';

  select count(*) into n from public.work_shift_exceptions
   where schedule_id = 'eeeeeee9-0000-4000-8000-000000000001';
  if n <> 1 then raise exception 'FAIL: archiving destroyed the exception history'; end if;
  raise notice 'PASS  archiving a schedule keeps its exceptions';

  update public.work_schedules set archived_at = null
   where id = 'eeeeeee9-0000-4000-8000-000000000001';
end $$;

-- ── Deleting a schedule takes its exceptions with it ────────────────────────
do $$
declare n int;
begin
  insert into public.work_schedules (id, user_id, name, days_of_week)
  values ('eeeeeee9-0000-4000-8000-000000000002', 'ccccccc9-0000-4000-8000-000000000001',
          'Temp', array[2]::smallint[]);
  insert into public.work_shift_exceptions (user_id, schedule_id, shift_date, kind)
  values ('ccccccc9-0000-4000-8000-000000000001', 'eeeeeee9-0000-4000-8000-000000000002',
          '2026-08-18', 'skipped');

  delete from public.work_schedules where id = 'eeeeeee9-0000-4000-8000-000000000002';

  select count(*) into n from public.work_shift_exceptions
   where schedule_id = 'eeeeeee9-0000-4000-8000-000000000002';
  if n <> 0 then raise exception 'FAIL: % exceptions orphaned by schedule delete', n; end if;
  raise notice 'PASS  deleting a schedule removes its exceptions';
end $$;

-- ── Isolation ───────────────────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"ccccccc9-0000-4000-8000-000000000002"}';

do $$
declare n int;
begin
  select count(*) into n from public.work_schedules;
  if n <> 0 then raise exception 'FAIL: RLS LEAK — Noel sees % of Mira''s schedules', n; end if;
  raise notice 'PASS  Noel sees none of Mira''s schedules';

  select count(*) into n from public.work_shift_exceptions;
  if n <> 0 then raise exception 'FAIL: RLS LEAK — Noel sees % of Mira''s exceptions', n; end if;
  raise notice 'PASS  Noel sees none of Mira''s shift exceptions';

  -- The parent check earns its place here: without it Noel could file an
  -- exception carrying his OWN user_id against Mira's schedule — invisible to
  -- him, and it would delete a shift from her calendar.
  begin
    insert into public.work_shift_exceptions (user_id, schedule_id, shift_date, kind)
    values ('ccccccc9-0000-4000-8000-000000000002', 'eeeeeee9-0000-4000-8000-000000000001',
            '2026-08-26', 'skipped');
    raise exception 'FAIL: RLS LEAK — Noel cancelled a shift on Mira''s schedule';
  exception when insufficient_privilege or check_violation or foreign_key_violation then
    raise notice 'PASS  Noel cannot file exceptions against another user''s schedule';
  end;
end $$;

rollback;

\echo ''
\echo '  ALL M14 CHECKS PASSED'
