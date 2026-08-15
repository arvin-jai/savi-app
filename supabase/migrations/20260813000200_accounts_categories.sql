-- ─────────────────────────────────────────────────────────────────────────────
-- accounts (P§13) and categories (D§7)
-- ─────────────────────────────────────────────────────────────────────────────

create type public.account_type as enum (
  'cash', 'bank', 'ewallet', 'savings', 'credit_card'
);

create table public.accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null check (char_length(trim(name)) > 0),
  type          public.account_type not null,
  -- Integer MINOR units (centavos). Never numeric, never float — see lib/money.ts.
  -- bigint because a peso balance in centavos outgrows int4 at ~21M.
  balance_minor bigint not null default 0,
  currency      text not null default 'PHP' check (char_length(currency) = 3),
  -- BUILD-PLAN P1: a credit card balance is money OWED. Summing it into
  -- "Available Money" would be wrong in either direction, so Current Balance
  -- sums asset accounts only.
  is_liability  boolean not null default false,
  is_default    boolean not null default false,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- At most one default account per user. Partial unique index rather than a
-- constraint so archived accounts don't occupy the slot.
create unique index accounts_one_default_per_user
  on public.accounts (user_id)
  where is_default and archived_at is null;

create index accounts_user_idx on public.accounts (user_id) where archived_at is null;

alter table public.accounts enable row level security;

create policy "accounts: read own"   on public.accounts for select using (auth.uid() = user_id);
create policy "accounts: insert own" on public.accounts for insert with check (auth.uid() = user_id);
create policy "accounts: update own" on public.accounts for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "accounts: delete own" on public.accounts for delete using (auth.uid() = user_id);

create trigger accounts_touch_updated_at
  before update on public.accounts
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- categories
--
-- user_id NULL = system category, readable by everyone, writable by no one.
-- "Bills" is deliberately absent: it is a CLASSIFICATION (need/want/bill), not
-- a category. Keeping it in both axes was the source of the ambiguity in
-- BUILD-PLAN P4.
--
-- Colors match DESIGN-SYSTEM A12 and carry no semantic collision.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  name       text not null check (char_length(trim(name)) > 0),
  -- Stable key for the A12 palette lookup; null for user-created categories,
  -- which fall back to `other`.
  slug       text,
  icon       text,
  created_at timestamptz not null default now()
);

create index categories_user_idx on public.categories (user_id);
create unique index categories_system_slug on public.categories (slug) where user_id is null;

alter table public.categories enable row level security;

-- System categories (user_id is null) are readable by any authenticated user.
create policy "categories: read own or system"
  on public.categories for select
  using (user_id is null or auth.uid() = user_id);

-- Writes require ownership, and `user_id is null` fails auth.uid() = user_id,
-- so a client cannot create or edit a system category.
create policy "categories: insert own" on public.categories for insert with check (auth.uid() = user_id);
create policy "categories: update own" on public.categories for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories: delete own" on public.categories for delete using (auth.uid() = user_id);

insert into public.categories (user_id, name, slug) values
  (null, 'Food',          'food'),
  (null, 'Shopping',      'shopping'),
  (null, 'Entertainment', 'entertainment'),
  (null, 'Work',          'work'),
  (null, 'Transport',     'transport'),
  (null, 'Health',        'health'),
  (null, 'Education',     'education'),
  (null, 'Personal',      'personal'),
  (null, 'Other',         'other');
