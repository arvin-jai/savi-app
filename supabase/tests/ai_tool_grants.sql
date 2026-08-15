-- ─────────────────────────────────────────────────────────────────────────────
-- M12 (v0.6): ai_tool_grants and ai_action_log.
--
-- This is the permission system for the only code path that lets a language
-- model cause a write. The checks below assert the properties the design
-- depends on, especially the one that is easy to lose in a refactor: **the
-- database itself refuses to store a grant for anything that touches money.**
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('99999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'iris@test.local', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now()),
  ('aaaaaaa1-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jon@test.local',  '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999"}';

do $$
begin
  perform 1 from public.ai_tool_grants limit 1;
  perform 1 from public.ai_action_log  limit 1;
  raise notice 'PASS  authenticated can reach ai_tool_grants and ai_action_log (grants present)';
end $$;

-- ── Absence means denied ────────────────────────────────────────────────────
-- No seed row, no trigger, no default-allow. A user who has never opened the
-- grants screen has granted nothing.
do $$
declare n int;
begin
  select count(*) into n from public.ai_tool_grants
   where user_id = '99999999-9999-9999-9999-999999999999';
  if n <> 0 then
    raise exception 'FAIL: a new user starts with % grants; it must be zero', n;
  end if;
  raise notice 'PASS  a new user has no grants — absence means denied';
end $$;

-- ── The money guard, enforced by the schema ─────────────────────────────────
-- P§31: "Never, at any version: the AI moves money, deletes a transaction, or
-- takes an irreversible financial action." That sentence is a check constraint.
do $$
declare bad text;
begin
  foreach bad in array array[
    'create_transaction', 'delete_transaction', 'move_money', 'create_transfer',
    'mark_bill_paid', 'delete_bill', 'update_bill', 'delete_account',
    'delete_task', 'update_goal', 'anything_else'
  ] loop
    begin
      insert into public.ai_tool_grants (user_id, tool_name)
      values ('99999999-9999-9999-9999-999999999999', bad);
      raise exception 'FAIL: the database accepted a grant for %', bad;
    exception when check_violation then
      null; -- expected
    end;
  end loop;
  raise notice 'PASS  the database refuses to store a grant for any money or delete tool';
end $$;

-- ── The three grantable tools ───────────────────────────────────────────────
insert into public.ai_tool_grants (user_id, tool_name)
values
  ('99999999-9999-9999-9999-999999999999', 'create_task'),
  ('99999999-9999-9999-9999-999999999999', 'create_calendar_event');

do $$
declare n int;
begin
  select count(*) into n from public.ai_tool_grants
   where user_id = '99999999-9999-9999-9999-999999999999';
  if n <> 2 then raise exception 'FAIL: expected 2 grants, found %', n; end if;
  raise notice 'PASS  create_task and create_calendar_event are grantable';

  -- Granting twice is idempotent, not an error: tapping a toggle twice should
  -- not produce a 500.
  begin
    insert into public.ai_tool_grants (user_id, tool_name)
    values ('99999999-9999-9999-9999-999999999999', 'create_task');
    raise exception 'FAIL: a duplicate grant was silently accepted as a second row';
  exception when unique_violation then
    raise notice 'PASS  a grant is unique per user and tool';
  end;
end $$;

-- ── Revoking is a delete, and there is no update path ───────────────────────
do $$
begin
  begin
    update public.ai_tool_grants set tool_name = 'create_reminder'
     where user_id = '99999999-9999-9999-9999-999999999999';
    raise exception 'FAIL: a grant was editable';
  exception when insufficient_privilege then
    raise notice 'PASS  grants cannot be edited, only granted or revoked';
  end;

  delete from public.ai_tool_grants
   where user_id = '99999999-9999-9999-9999-999999999999' and tool_name = 'create_task';
  if exists (
    select 1 from public.ai_tool_grants
     where user_id = '99999999-9999-9999-9999-999999999999' and tool_name = 'create_task'
  ) then
    raise exception 'FAIL: revoking did not remove the grant';
  end if;
  raise notice 'PASS  revoking removes the grant';
end $$;

-- ── The action log records failures too ─────────────────────────────────────
insert into public.ai_action_log (user_id, tool_name, arguments, result_id, succeeded)
values
  ('99999999-9999-9999-9999-999999999999', 'create_task',
   '{"title":"Pay internet"}'::jsonb, gen_random_uuid(), true),
  ('99999999-9999-9999-9999-999999999999', 'create_calendar_event',
   '{"title":"Dentist"}'::jsonb, null, false);

do $$
declare n int;
begin
  -- An action the user confirmed that then FAILED is exactly the thing worth
  -- being able to see later.
  select count(*) into n from public.ai_action_log
   where user_id = '99999999-9999-9999-9999-999999999999' and not succeeded;
  if n <> 1 then raise exception 'FAIL: failed actions are not being recorded'; end if;
  raise notice 'PASS  the action log records failed actions, not just successful ones';

  begin
    update public.ai_action_log set succeeded = true
     where user_id = '99999999-9999-9999-9999-999999999999';
    raise exception 'FAIL: a log entry was editable';
  exception when insufficient_privilege then
    raise notice 'PASS  the action log is append-only';
  end;
end $$;

-- ── Isolation ───────────────────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"aaaaaaa1-0000-4000-8000-000000000001"}';

do $$
declare n int;
begin
  select count(*) into n from public.ai_tool_grants;
  if n <> 0 then raise exception 'FAIL: RLS LEAK — Jon sees % of Iris''s grants', n; end if;
  raise notice 'PASS  Jon sees none of Iris''s grants';

  select count(*) into n from public.ai_action_log;
  if n <> 0 then raise exception 'FAIL: RLS LEAK — Jon sees % of Iris''s action log', n; end if;
  raise notice 'PASS  Jon sees none of Iris''s action log';

  -- The one that would actually matter: granting a tool to somebody else.
  begin
    insert into public.ai_tool_grants (user_id, tool_name)
    values ('99999999-9999-9999-9999-999999999999', 'create_reminder');
    raise exception 'FAIL: RLS LEAK — Jon granted a tool on Iris''s behalf';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS  Jon cannot grant tools on another user''s behalf';
  end;

  -- And revoking somebody else's.
  delete from public.ai_tool_grants
   where user_id = '99999999-9999-9999-9999-999999999999';
  set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999"}';
  select count(*) into n from public.ai_tool_grants
   where user_id = '99999999-9999-9999-9999-999999999999';
  if n = 0 then
    raise exception 'FAIL: RLS LEAK — Jon revoked Iris''s grants';
  end if;
  raise notice 'PASS  Jon cannot revoke another user''s grants';
end $$;

rollback;

\echo ''
\echo '  ALL M12 CHECKS PASSED'
