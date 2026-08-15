-- ─────────────────────────────────────────────────────────────────────────────
-- profiles — 1:1 with auth.users
--
-- RLS is enabled and policied IN THIS FILE, not a later one. A table that ships
-- without a policy is a data leak, and "we'll add policies later" does not
-- survive contact with a deadline. Every migration in this project follows that
-- rule: create table, enable RLS, write policies, all in one transaction.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  -- BUILD-PLAN P7: the column exists from day one because adding it later means
  -- a migration over live money data. v0.1 enforces a single currency per user
  -- at the application layer and hides the selector.
  currency     text not null default 'PHP' check (char_length(currency) = 3),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No INSERT policy: rows are created by the trigger below, which runs as
-- security definer. A client should never be able to invent a profile row.
-- No DELETE policy: profiles die with the auth.users row via ON DELETE CASCADE.

-- ─────────────────────────────────────────────────────────────────────────────
-- Profile creation on signup.
--
-- security definer so it can write to public.profiles regardless of the calling
-- role, with an empty search_path so a malicious schema on the caller's path
-- cannot shadow the tables this function touches.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at maintenance, reused by every table that has the column.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
