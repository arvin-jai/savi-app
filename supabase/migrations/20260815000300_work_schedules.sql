-- ─────────────────────────────────────────────────────────────────────────────
-- work_schedules (P§28) — the v0.2 table that v0.2 deferred.
--
-- The plan left one decision open: **recurrence rule, or generated events?**
-- It is answered here as a RULE, with exceptions stored as rows.
--
-- Why the rule wins:
--
--   Generated events need a horizon ("how far ahead do we materialise?") and a
--   job to extend it. Get the horizon wrong and someone's calendar is simply
--   empty next March, with nothing to indicate why. A rule has no horizon; it
--   is evaluated for whatever range the calendar is showing.
--
--   It also matches how the rest of Savi already works. A bill's due date is
--   computed from `due_day`, never stored as a row; calendar money is derived,
--   never copied (M8). A generated shift would be the first thing in this app
--   that is a stored copy of a rule, and copies drift.
--
-- Why exceptions are rows rather than edits:
--
--   "I swapped Tuesday" is the case that breaks every recurring-event model. A
--   mutable field cannot express it — you would have to either edit the rule
--   (changing every Tuesday, forever) or fork the series. An exception ROW says
--   exactly what happened to exactly one date, and leaves the rule intact.
--
--   This is the same shape as `bill_payments`: an event, not a flag, which is
--   what makes undo and history possible without a later migration.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.work_schedules (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,

  name           text not null check (char_length(btrim(name)) > 0),

  -- ISO weekday numbers, 0 = Sunday … 6 = Saturday, matching JS getDay() so the
  -- client never has to convert. An array rather than a bitmask: a bitmask is
  -- smaller and completely unreadable in a psql session.
  -- `coalesce(..., 0)` is load-bearing: array_length() on an EMPTY array returns
  -- NULL, not 0, and a CHECK constraint passes when its expression is NULL —
  -- only FALSE fails. Written the obvious way, this accepted `array[]` and a
  -- schedule that runs on no days at all.
  days_of_week   smallint[] not null check (
    coalesce(array_length(days_of_week, 1), 0) between 1 and 7
    and days_of_week <@ array[0,1,2,3,4,5,6]::smallint[]
  ),

  -- Null start means an all-day commitment (a shift you know about but whose
  -- hours vary). The calendar shows it without a time rather than inventing one.
  start_time     time,
  end_time       time,

  -- The rule applies from this date, optionally until that one. `effective_to`
  -- null means ongoing — which is the normal case and must not require the user
  -- to invent an end date for a job they have not left.
  effective_from date not null default current_date,
  effective_to   date,

  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint work_schedule_times_ordered check (
    start_time is null or end_time is null or end_time > start_time
  ),
  constraint work_schedule_end_needs_start check (
    end_time is null or start_time is not null
  ),
  constraint work_schedule_range_ordered check (
    effective_to is null or effective_to >= effective_from
  )
);

create index work_schedules_user_idx
  on public.work_schedules (user_id) where archived_at is null;

alter table public.work_schedules enable row level security;

create policy "work schedules: read own"   on public.work_schedules
  for select using (auth.uid() = user_id);
create policy "work schedules: insert own" on public.work_schedules
  for insert with check (auth.uid() = user_id);
create policy "work schedules: update own" on public.work_schedules
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "work schedules: delete own" on public.work_schedules
  for delete using (auth.uid() = user_id);

create trigger work_schedules_touch_updated_at
  before update on public.work_schedules
  for each row execute function public.touch_updated_at();

grant select, insert, update, delete on public.work_schedules to authenticated;


-- ─── work_shift_exceptions ──────────────────────────────────────────────────
-- One row = one date on which the rule did not apply as written.

create table public.work_shift_exceptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  schedule_id  uuid not null references public.work_schedules(id) on delete cascade,

  shift_date   date not null,

  -- 'skipped'  — the shift did not happen (day off, swapped away)
  -- 'moved'    — it happened at different hours; the override columns carry them
  kind         text not null check (kind in ('skipped', 'moved')),

  start_time   time,
  end_time     time,

  created_at   timestamptz not null default now(),

  -- One exception per shift. Two rows saying different things about the same
  -- date is not a state with a meaning.
  constraint work_shift_exception_unique unique (schedule_id, shift_date),

  -- A 'moved' exception without new hours says nothing; a 'skipped' one with
  -- hours is contradictory. The constraint refuses both.
  constraint work_shift_exception_times check (
    (kind = 'moved'   and start_time is not null and end_time is not null and end_time > start_time)
    or
    (kind = 'skipped' and start_time is null and end_time is null)
  )
);

create index work_shift_exceptions_lookup
  on public.work_shift_exceptions (schedule_id, shift_date);

alter table public.work_shift_exceptions enable row level security;

create policy "shift exceptions: read own"   on public.work_shift_exceptions
  for select using (auth.uid() = user_id);
-- The parent check is not redundant with user_id: without it a user could file
-- an exception carrying their own user_id against somebody else's schedule.
create policy "shift exceptions: insert own" on public.work_shift_exceptions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.work_schedules s
       where s.id = schedule_id and s.user_id = auth.uid()
    )
  );
create policy "shift exceptions: update own" on public.work_shift_exceptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "shift exceptions: delete own" on public.work_shift_exceptions
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.work_shift_exceptions to authenticated;
