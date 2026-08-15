-- ─────────────────────────────────────────────────────────────────────────────
-- ai_tool_grants (P§31, BUILD-PLAN P8) — v0.6
--
-- Per user, per tool. This is the storage half of the permission model; the
-- enforcement half lives INSIDE the Edge Function, which refuses any tool call
-- whose grant is absent regardless of what the model asks for.
--
-- **A client-side check is not a permission system.** The app also hides
-- ungranted tools, but that is courtesy. A stale client, a replayed request, or
-- a model that hallucinates a tool name must all be refused by the server.
--
-- Three properties this table deliberately has:
--
--   1. **Absence means denied.** There is no `granted boolean` defaulting to
--      true, and no seed row. A user who has never opened the grants screen has
--      granted nothing, and the natural failure mode of every query is refusal.
--
--   2. **Only write tools appear here.** Reads were never gated (v0.4 shipped
--      six, then eight, read-only tools with no grants at all), so listing them
--      would imply they could be revoked, which they cannot.
--
--   3. **No money tools exist to grant.** The check constraint below is the
--      schema refusing to store a permission for moving money or deleting a
--      transaction. "Never, at any version" (P§31) is written into the table
--      rather than left to review.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.ai_tool_grants (
  user_id    uuid not null references auth.users(id) on delete cascade,

  tool_name  text not null check (
    -- The complete set of grantable tools. Adding a row for anything else is
    -- rejected by the database, so a tool that moves money cannot be granted
    -- even by a mistake in application code.
    tool_name in ('create_task', 'create_reminder', 'create_calendar_event')
  ),

  granted_at timestamptz not null default now(),

  primary key (user_id, tool_name)
);

alter table public.ai_tool_grants enable row level security;

create policy "tool grants: read own"   on public.ai_tool_grants
  for select using (auth.uid() = user_id);
create policy "tool grants: insert own" on public.ai_tool_grants
  for insert with check (auth.uid() = user_id);
-- Revoking is a DELETE. There is no UPDATE policy: a grant either exists or it
-- does not, and a mutable "granted = false" row is a second way to say the same
-- thing that some query will eventually forget to check.
create policy "tool grants: delete own" on public.ai_tool_grants
  for delete using (auth.uid() = user_id);

grant select, insert, delete on public.ai_tool_grants to authenticated;


-- ─── ai_action_log ──────────────────────────────────────────────────────────
-- What the AI actually did, and when the user confirmed it.
--
-- Not an audit trail for its own sake: P§30 Phase 8 requires every action to be
-- confirmed before execution, and a claim like that needs a record. If a user
-- ever asks "did Savi add this?", this is the answer.
--
-- Append-only by grant: no UPDATE policy, so a log entry cannot be revised.

create table public.ai_action_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,

  tool_name    text not null,
  -- The arguments as executed, for the record. User-authored text may appear
  -- here; it is data, never instructions (AI-BOUNDARY §6).
  arguments    jsonb not null,

  -- Set when the write succeeded. A row with a null result_id is an action the
  -- user confirmed that then failed, which is worth being able to see.
  result_id    uuid,
  succeeded    boolean not null default false,

  confirmed_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index ai_action_log_user_idx on public.ai_action_log (user_id, created_at desc);

alter table public.ai_action_log enable row level security;

create policy "action log: read own"   on public.ai_action_log
  for select using (auth.uid() = user_id);
create policy "action log: insert own" on public.ai_action_log
  for insert with check (auth.uid() = user_id);
create policy "action log: delete own" on public.ai_action_log
  for delete using (auth.uid() = user_id);

grant select, insert, delete on public.ai_action_log to authenticated;
