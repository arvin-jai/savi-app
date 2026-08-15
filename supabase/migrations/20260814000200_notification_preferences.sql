-- ─────────────────────────────────────────────────────────────────────────────
-- notification_preferences (P§26) — v0.3
--
-- P§26 says "avoid excessive notifications". That is a user control, not just
-- a design intention: whoever is annoyed by a category needs to be able to
-- switch that category off, otherwise their only option is to disable Savi's
-- notifications entirely and lose the bill reminders too.
--
-- Bill reminders default ON because P§3 names "people who frequently forget
-- payment dates" as the core user — for them the reminder IS the product
-- (BUILD-PLAN P6). Everything else defaults OFF: an app that starts noisy gets
-- muted before it earns the right to speak.
--
-- RLS, policies and grants together, per the M2 lesson.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.notification_preferences (
  user_id           uuid primary key references auth.users(id) on delete cascade,

  -- Master switch. Mirrors the OS permission so the app can show the real
  -- state rather than lying about what it will do.
  enabled           boolean not null default true,

  bills_enabled     boolean not null default true,
  tasks_enabled     boolean not null default false,
  events_enabled    boolean not null default false,
  income_enabled    boolean not null default false,

  -- How many days before a due date to warn. 1 = "due tomorrow", which is the
  -- example P§26 itself gives.
  bill_lead_days    int not null default 1 check (bill_lead_days between 0 and 14),

  -- Local clock time to fire at. A reminder at 03:00 is worse than none.
  remind_at         time not null default '09:00',

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "notif prefs: read own"   on public.notification_preferences
  for select using (auth.uid() = user_id);
create policy "notif prefs: insert own" on public.notification_preferences
  for insert with check (auth.uid() = user_id);
create policy "notif prefs: update own" on public.notification_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notif prefs: delete own" on public.notification_preferences
  for delete using (auth.uid() = user_id);

create trigger notification_preferences_touch_updated_at
  before update on public.notification_preferences
  for each row execute function public.touch_updated_at();

grant select, insert, update, delete on public.notification_preferences to authenticated;

-- Seed a row for every existing user, and for each new one, so the client
-- never has to branch on "no preferences yet".
insert into public.notification_preferences (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create function public.handle_new_user_notification_prefs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_notification_prefs
  after insert on auth.users
  for each row execute function public.handle_new_user_notification_prefs();
