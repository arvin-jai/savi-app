-- ─────────────────────────────────────────────────────────────────────────────
-- M10 (v0.4): ai_preferences · ai_conversations · ai_messages, and the one
-- aggregate the model is not allowed to compute for itself.
--
-- These tables hold what a user asked about their own money and what Savi
-- answered. A leak here is a transcript of somebody's financial life, so the
-- isolation checks below assert an actual second user CANNOT read the rows —
-- not that a policy string exists.
--
-- Scoped to fixture ids so this passes against a database that already has real
-- users in it, not only a freshly reset one (the M2 lesson).
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eve@test.local',  '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now()),
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'finn@test.local', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555"}';

-- ── Grants are actually open ────────────────────────────────────────────────
-- M2 shipped policies with no grants and every table was inaccessible. Assert
-- the pairing rather than assuming it.
do $$
begin
  perform 1 from public.ai_preferences   limit 1;
  perform 1 from public.ai_conversations limit 1;
  perform 1 from public.ai_messages      limit 1;
  raise notice 'PASS  authenticated can reach the ai_* tables (grants present)';
end $$;

-- ── The off switch exists for every user, seeded by trigger ─────────────────
-- AI-BOUNDARY §4. The client must never have to branch on "no row yet".
do $$
declare p public.ai_preferences;
begin
  select * into p from public.ai_preferences
   where user_id = '55555555-5555-5555-5555-555555555555';

  if p is null then raise exception 'FAIL: no ai_preferences row seeded for a new user'; end if;
  if not p.enabled then raise exception 'FAIL: Ask Savi should be reachable by default'; end if;
  if p.disclosed_at is not null then
    raise exception 'FAIL: a fresh user must not be marked as already disclosed to';
  end if;
  raise notice 'PASS  ai_preferences seeded by trigger, enabled, not yet disclosed';
end $$;

-- ── Conversations and messages ──────────────────────────────────────────────

insert into public.ai_conversations (id, user_id, title)
values ('aaaaaaaa-0000-4000-8000-000000000001', '55555555-5555-5555-5555-555555555555',
        'Can I afford a laptop?');

insert into public.ai_messages (conversation_id, user_id, role, content)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '55555555-5555-5555-5555-555555555555',
   'user', 'Can I afford a ₱4,000 laptop this month?'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '55555555-5555-5555-5555-555555555555',
   'assistant', 'You can probably afford it.');

-- ── Constraints ─────────────────────────────────────────────────────────────

do $$
begin
  -- Only the two roles the user can see are storable. A 'tool' or 'system' row
  -- would be a persisted copy of a financial snapshot, which is the second
  -- ledger AI-BOUNDARY §3 exists to prevent.
  begin
    insert into public.ai_messages (conversation_id, user_id, role, content)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            '55555555-5555-5555-5555-555555555555', 'tool', '{"balance":123}');
    raise exception 'FAIL: a tool-role message was persisted';
  exception when check_violation then
    raise notice 'PASS  only user and assistant messages are storable';
  end;

  begin
    insert into public.ai_messages (conversation_id, user_id, role, content)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            '55555555-5555-5555-5555-555555555555', 'user', '   ');
    raise exception 'FAIL: blank message content allowed';
  exception when check_violation then
    raise notice 'PASS  blank message content rejected';
  end;

  -- A transcript is a record of what was said. There is no UPDATE policy and no
  -- UPDATE grant, so revising one is refused by the grant gate.
  begin
    update public.ai_messages set content = 'something else'
     where conversation_id = 'aaaaaaaa-0000-4000-8000-000000000001';
    raise exception 'FAIL: a stored message was editable';
  exception when insufficient_privilege then
    raise notice 'PASS  stored messages cannot be edited, only deleted';
  end;
end $$;

-- ── Cascade ─────────────────────────────────────────────────────────────────
-- "Delete this conversation" has to actually remove the transcript, not orphan
-- it. AI-BOUNDARY §3 promises the user can delete their conversations.
do $$
declare n int;
begin
  delete from public.ai_conversations
   where id = 'aaaaaaaa-0000-4000-8000-000000000001';

  select count(*) into n from public.ai_messages
   where conversation_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  if n <> 0 then raise exception 'FAIL: % messages orphaned by conversation delete', n; end if;
  raise notice 'PASS  deleting a conversation removes its messages';
end $$;

-- ── monthly_spending_by_category ────────────────────────────────────────────
-- AI-BOUNDARY §7: the backend calculates, the model interprets. The regression
-- that matters is P3 — a transfer must not read as spending.
insert into public.accounts (id, user_id, name, type, balance_minor, currency, is_liability)
values
  ('bbbbbbbb-0000-4000-8000-000000000001', '55555555-5555-5555-5555-555555555555',
   'Cash',    'cash',    2000000, 'PHP', false),
  ('bbbbbbbb-0000-4000-8000-000000000002', '55555555-5555-5555-5555-555555555555',
   'Savings', 'savings',       0, 'PHP', false);

insert into public.transactions
  (user_id, account_id, amount_minor, currency, direction, type, classification, transaction_date, description)
values
  ('55555555-5555-5555-5555-555555555555', 'bbbbbbbb-0000-4000-8000-000000000001',
   30000, 'PHP', 'out', 'expense', 'need', date_trunc('month', current_date)::date, 'Lunch'),
  ('55555555-5555-5555-5555-555555555555', 'bbbbbbbb-0000-4000-8000-000000000001',
   13000, 'PHP', 'out', 'expense', 'need', date_trunc('month', current_date)::date, 'Jeepney');

-- ₱5,000 moved into savings. Two paired rows, type='transfer' (P3).
select public.create_transfer(
  'bbbbbbbb-0000-4000-8000-000000000001',
  'bbbbbbbb-0000-4000-8000-000000000002',
  500000,
  date_trunc('month', current_date)::date,
  'To savings'
);

do $$
declare total bigint;
begin
  select coalesce(sum(total_minor), 0) into total
    from public.monthly_spending_by_category(date_trunc('month', current_date)::date);

  if total <> 43000 then
    raise exception 'FAIL: spending totalled % minor, expected 43000 — a transfer leaked into it', total;
  end if;
  raise notice 'PASS  monthly spending is 43000 minor; the 500000 transfer is not spending (P3)';
end $$;

-- ── Isolation ───────────────────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666"}';

insert into public.ai_conversations (id, user_id, title)
values ('cccccccc-0000-4000-8000-000000000001', '66666666-6666-6666-6666-666666666666',
        'Finn''s own thread');

do $$
declare n int;
begin
  select count(*) into n from public.ai_conversations
   where user_id = '55555555-5555-5555-5555-555555555555';
  if n <> 0 then raise exception 'FAIL: RLS LEAK — Finn sees % of Eve''s conversations', n; end if;
  raise notice 'PASS  Finn sees none of Eve''s conversations';

  select count(*) into n from public.ai_messages
   where user_id = '55555555-5555-5555-5555-555555555555';
  if n <> 0 then raise exception 'FAIL: RLS LEAK — Finn sees % of Eve''s messages', n; end if;
  raise notice 'PASS  Finn sees none of Eve''s messages';

  select count(*) into n from public.ai_preferences
   where user_id = '55555555-5555-5555-5555-555555555555';
  if n <> 0 then raise exception 'FAIL: RLS LEAK — Finn reads Eve''s AI preferences'; end if;
  raise notice 'PASS  Finn cannot read Eve''s AI preferences';

  -- The aggregate is security invoker, so it summarises the CALLER's rows.
  -- If it ever returned Eve's spending to Finn, every tool built on it would
  -- hand one user's finances to another's model call.
  select coalesce(sum(total_minor), 0) into n
    from public.monthly_spending_by_category(date_trunc('month', current_date)::date);
  if n <> 0 then
    raise exception 'FAIL: RLS LEAK — monthly_spending_by_category returned % of Eve''s spending to Finn', n;
  end if;
  raise notice 'PASS  monthly_spending_by_category is scoped to the caller';
end $$;

-- The parent check in the insert policy is not redundant with user_id: without
-- it, Finn could file a message carrying his OWN user_id into Eve's thread —
-- invisible to him, visible to her.
do $$
begin
  insert into public.ai_messages (conversation_id, user_id, role, content)
  values ('aaaaaaaa-0000-4000-8000-000000000001',
          '66666666-6666-6666-6666-666666666666', 'user', 'Injected into Eve''s thread');
  raise exception 'FAIL: RLS LEAK — Finn wrote into a conversation that is not his';
exception when insufficient_privilege or check_violation or foreign_key_violation then
  raise notice 'PASS  Finn cannot write into another user''s conversation';
end $$;

do $$
begin
  begin
    update public.ai_preferences set enabled = false
     where user_id = '55555555-5555-5555-5555-555555555555';
    if found then
      raise exception 'FAIL: RLS LEAK — Finn switched off Eve''s Ask Savi';
    end if;
    raise notice 'PASS  Finn cannot change Eve''s AI preferences';
  exception when insufficient_privilege then
    raise notice 'PASS  Finn cannot change Eve''s AI preferences';
  end;
end $$;

rollback;

\echo ''
\echo '  ALL M10 CHECKS PASSED'
