-- ─────────────────────────────────────────────────────────────────────────────
-- calendar_events and tasks (P§16, P§17) — v0.2
--
-- RLS, policies, AND grants all live in this file. M2 shipped policies without
-- grants and every table came back "permission denied": they are two
-- independent gates and both have to be opened together, so they are written
-- together.
-- ─────────────────────────────────────────────────────────────────────────────

create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.task_status   as enum ('todo', 'done');

-- What kind of thing an event is, for the D§35 colour indicator. Money events
-- are NOT stored here — bills and paydays are derived from the tables that
-- already own them, so the calendar cannot drift from the ledger.
create type public.event_kind as enum ('work', 'personal', 'appointment', 'deadline');

-- ─────────────────────────────────────────────────────────────────────────────
-- tasks (P§17)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null check (char_length(trim(title)) > 0),
  description  text,
  -- Nullable: a task without a deadline is a normal thing to want, and forcing
  -- a date would make people invent one.
  due_date     date,
  priority     public.task_priority not null default 'medium',
  status       public.task_status not null default 'todo',
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- completed_at and status cannot disagree.
  constraint tasks_completed_at_matches_status check (
    (status = 'done' and completed_at is not null) or
    (status = 'todo' and completed_at is null)
  )
);

create index tasks_user_due_idx on public.tasks (user_id, due_date);
create index tasks_user_status_idx on public.tasks (user_id, status);

alter table public.tasks enable row level security;

create policy "tasks: read own"   on public.tasks for select using (auth.uid() = user_id);
create policy "tasks: insert own" on public.tasks for insert with check (auth.uid() = user_id);
create policy "tasks: update own" on public.tasks for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks: delete own" on public.tasks for delete using (auth.uid() = user_id);

create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- calendar_events (P§16)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.calendar_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null check (char_length(trim(title)) > 0),
  notes      text,
  kind       public.event_kind not null default 'personal',
  -- `date` + optional time rather than a timestamptz range: an event happens on
  -- a day in the user's own timezone, and storing an instant makes "Aug 15"
  -- render as Aug 14 for anyone west of UTC. Same reasoning as
  -- transactions.transaction_date — see lib/dates.ts.
  event_date date not null,
  start_time time,
  end_time   time,
  all_day    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint events_times_ordered check (
    start_time is null or end_time is null or end_time >= start_time
  ),
  -- A timed event must actually carry a time.
  constraint events_timed_has_start check (all_day or start_time is not null)
);

create index events_user_date_idx on public.calendar_events (user_id, event_date);

alter table public.calendar_events enable row level security;

create policy "events: read own"   on public.calendar_events for select using (auth.uid() = user_id);
create policy "events: insert own" on public.calendar_events for insert with check (auth.uid() = user_id);
create policy "events: update own" on public.calendar_events for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "events: delete own" on public.calendar_events for delete using (auth.uid() = user_id);

create trigger events_touch_updated_at
  before update on public.calendar_events
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants. Both gates, same migration.
-- ─────────────────────────────────────────────────────────────────────────────

grant select, insert, update, delete on public.tasks           to authenticated;
grant select, insert, update, delete on public.calendar_events to authenticated;
