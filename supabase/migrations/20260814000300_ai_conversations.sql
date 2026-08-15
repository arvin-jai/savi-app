-- ─────────────────────────────────────────────────────────────────────────────
-- Ask Savi (v0.4) — conversation storage, the off switch, and the one aggregate
-- the model is not allowed to compute for itself.
--
-- Table + RLS + policies + GRANTS in one file, per the M2 lesson: RLS and GRANT
-- are two independent gates and splitting them shipped seven inaccessible
-- tables once already.
--
-- See docs/AI-BOUNDARY.md — this migration implements §3 (retention), §4 (the
-- off switch) and §7 (the model never does arithmetic).
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── ai_preferences ─────────────────────────────────────────────────────────
-- AI-BOUNDARY §4. The switch is checked SERVER-SIDE by the Edge Function before
-- anything reaches OpenAI. The client also reads it, but that check is a
-- courtesy — a stale client must not be able to send a user's data after they
-- have said no, so the enforcement lives where the data actually leaves.

create table public.ai_preferences (
  user_id     uuid primary key references auth.users(id) on delete cascade,

  -- Default ON so the tab is reachable. The honesty is carried by the
  -- disclosure shown before the first message (§3), not by shipping the
  -- feature switched off and hoping nobody notices it exists.
  enabled     boolean not null default true,

  -- Set the first time the user is shown what leaves the device, so the
  -- disclosure appears once rather than every session.
  disclosed_at timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.ai_preferences enable row level security;

create policy "ai prefs: read own"   on public.ai_preferences
  for select using (auth.uid() = user_id);
create policy "ai prefs: insert own" on public.ai_preferences
  for insert with check (auth.uid() = user_id);
create policy "ai prefs: update own" on public.ai_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger ai_preferences_touch_updated_at
  before update on public.ai_preferences
  for each row execute function public.touch_updated_at();

-- No DELETE policy and no DELETE grant: the row is 1:1 with the user and goes
-- with them on cascade. Deleting it by hand would only produce a user with no
-- preferences, which every reader would then have to branch on.
grant select, insert, update on public.ai_preferences to authenticated;

-- Seed existing users, and every new one, so the client never branches on
-- "no preferences row yet".
insert into public.ai_preferences (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create function public.handle_new_user_ai_prefs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ai_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_ai_prefs
  after insert on auth.users
  for each row execute function public.handle_new_user_ai_prefs();


-- ─── ai_conversations ───────────────────────────────────────────────────────

create table public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,

  -- Derived from the first user message client-side. Nullable because a
  -- conversation exists the moment it is opened, before anything is said.
  title       text check (title is null or length(btrim(title)) > 0),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index ai_conversations_user_recent_idx
  on public.ai_conversations (user_id, updated_at desc);

alter table public.ai_conversations enable row level security;

create policy "ai conversations: read own"   on public.ai_conversations
  for select using (auth.uid() = user_id);
create policy "ai conversations: insert own" on public.ai_conversations
  for insert with check (auth.uid() = user_id);
create policy "ai conversations: update own" on public.ai_conversations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ai conversations: delete own" on public.ai_conversations
  for delete using (auth.uid() = user_id);

create trigger ai_conversations_touch_updated_at
  before update on public.ai_conversations
  for each row execute function public.touch_updated_at();

grant select, insert, update, delete on public.ai_conversations to authenticated;


-- ─── ai_messages ────────────────────────────────────────────────────────────
-- Only the two roles the USER can see are stored: what they asked, and what
-- Savi answered. Tool calls and tool results are ephemeral — they exist for the
-- duration of one request and are never persisted.
--
-- That is a boundary decision, not a storage saving: a tool result is a
-- snapshot of the user's finances at one instant, and keeping copies of it
-- would quietly create a second ledger that can disagree with the first. The
-- transactions table is the thing that has to be right (the same reason
-- calendar money is derived and never stored — see M8).

create table public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,

  -- Denormalised so RLS is a direct comparison rather than a subquery join to
  -- the parent on every row read.
  user_id         uuid not null references auth.users(id) on delete cascade,

  role            text not null check (role in ('user', 'assistant')),
  content         text not null check (length(btrim(content)) > 0),

  created_at      timestamptz not null default now()
);

create index ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at);

alter table public.ai_messages enable row level security;

-- The parent check is not redundant with user_id: without it, a user could
-- insert a message carrying their own user_id into somebody else's
-- conversation. It would be invisible to them and visible to the other user.
create policy "ai messages: read own"   on public.ai_messages
  for select using (auth.uid() = user_id);
create policy "ai messages: insert own" on public.ai_messages
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.ai_conversations c
       where c.id = conversation_id
         and c.user_id = auth.uid()
    )
  );
create policy "ai messages: delete own" on public.ai_messages
  for delete using (auth.uid() = user_id);

-- No UPDATE policy or grant. A transcript is a record of what was said; an
-- editable one is not a record. Users delete conversations, they do not revise
-- them.
grant select, insert, delete on public.ai_messages to authenticated;


-- ─── monthly_spending_by_category ───────────────────────────────────────────
-- AI-BOUNDARY §7 / P§23: the backend calculates, the model interprets.
--
-- This exists so `get_monthly_spending` can hand the model ONE row per
-- category instead of every transaction in the month. Asking a model to total
-- twenty numbers is asking it to be wrong occasionally, in a finance app, about
-- money — and it would also push far more of the user's ledger across the
-- boundary than the question needs (§1.2).
--
-- Expenses only. Transfers do not match `type = 'expense'`, so moving ₱5,000
-- into savings cannot surface here as ₱5,000 of spending — structurally, not by
-- a filter someone has to remember (P3).

create function public.monthly_spending_by_category(
  p_month date default date_trunc('month', current_date)::date
)
returns table (
  category_name text,
  total_minor   bigint
)
language sql
stable
security invoker  -- RLS applies: a user can only ever summarise their own rows
as $$
  select
    coalesce(c.name, 'Other') as category_name,
    sum(t.amount_minor)::bigint as total_minor
    from public.transactions t
    left join public.categories c on c.id = t.category_id
   where t.user_id = auth.uid()
     and t.type = 'expense'
     and t.transaction_date >= p_month
     and t.transaction_date <  (p_month + interval '1 month')::date
   group by coalesce(c.name, 'Other')
   order by sum(t.amount_minor) desc;
$$;

grant execute on function public.monthly_spending_by_category(date) to authenticated;
