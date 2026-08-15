-- ─────────────────────────────────────────────────────────────────────────────
-- Budgets (P§24) and savings goals (P§25) — v0.5
--
-- Table + RLS + policies + GRANTS in one file, per the M2 lesson.
--
-- The waterfall is Income → Bills → Needs → Wants → Savings, and the shape of
-- these tables follows one rule from it:
--
--   **Bills are DERIVED, never stored here.**
--
-- A budget row carries what the user PLANS for needs, wants and savings. It
-- carries no bills figure at all, because the bills table already owns that and
-- `upcoming_bills_minor()` already computes it. Copying the total into the
-- budget would let the plan disagree with the ledger the first time a bill
-- changed — the same reasoning that keeps money off calendar_events (M8).
--
-- Bills also come first in the waterfall and are not an allocation the user
-- chooses. You do not "budget" ₱1,699 for internet; the internet bill is
-- ₱1,699. Treating it as a plan line would invite a user to under-allocate it
-- and believe the shortfall away.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── budgets ────────────────────────────────────────────────────────────────

create table public.budgets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,

  -- First of the month, matching bill_payments.period so the two join cleanly.
  period        date not null,

  -- What the user expects to come in. Distinct from actual income: the plan is
  -- made before the money arrives, which is the whole point of a plan.
  income_minor  bigint not null default 0 check (income_minor >= 0),

  -- The three the user actually allocates (P§24). Classification drives these,
  -- which is why P4 had to make classification clean before v0.5 could exist.
  needs_minor   bigint not null default 0 check (needs_minor   >= 0),
  wants_minor   bigint not null default 0 check (wants_minor   >= 0),
  savings_minor bigint not null default 0 check (savings_minor >= 0),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- One plan per month. Two budgets for August is not a state with a meaning.
  constraint budgets_one_per_period unique (user_id, period)
);

create index budgets_user_period_idx on public.budgets (user_id, period desc);

alter table public.budgets enable row level security;

create policy "budgets: read own"   on public.budgets
  for select using (auth.uid() = user_id);
create policy "budgets: insert own" on public.budgets
  for insert with check (auth.uid() = user_id);
create policy "budgets: update own" on public.budgets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "budgets: delete own" on public.budgets
  for delete using (auth.uid() = user_id);

create trigger budgets_touch_updated_at
  before update on public.budgets
  for each row execute function public.touch_updated_at();

grant select, insert, update, delete on public.budgets to authenticated;


-- ─── financial_goals ────────────────────────────────────────────────────────

create table public.financial_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,

  name          text not null check (char_length(btrim(name)) > 0),
  target_minor  bigint not null check (target_minor > 0),

  -- Progress is stored, not derived. A goal is a statement of intent about
  -- money the user has set aside, and Savi cannot infer which pesos in a
  -- savings account are "the emergency fund" versus "next month's rent".
  -- Deriving it would require tagging transactions to goals, which is a bigger
  -- feature than v0.5 and would guess wrong until it existed.
  saved_minor   bigint not null default 0 check (saved_minor >= 0),

  currency      text not null default 'PHP' check (char_length(currency) = 3),

  -- Optional. Without one there is no recommended monthly contribution, and
  -- the UI says so rather than inventing a deadline.
  target_date   date,

  achieved_at   timestamptz,
  archived_at   timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index financial_goals_user_idx
  on public.financial_goals (user_id) where archived_at is null;

alter table public.financial_goals enable row level security;

create policy "goals: read own"   on public.financial_goals
  for select using (auth.uid() = user_id);
create policy "goals: insert own" on public.financial_goals
  for insert with check (auth.uid() = user_id);
create policy "goals: update own" on public.financial_goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals: delete own" on public.financial_goals
  for delete using (auth.uid() = user_id);

create trigger financial_goals_touch_updated_at
  before update on public.financial_goals
  for each row execute function public.touch_updated_at();

grant select, insert, update, delete on public.financial_goals to authenticated;


-- ─── spending_by_classification ─────────────────────────────────────────────
-- The actual side of the waterfall, summed in SQL.
--
-- P§23 and AI-BOUNDARY §7: the backend calculates. This exists so neither the
-- budget screen nor the model adds up transactions itself.
--
-- Expenses only, so transfers cannot appear as spending (P3). Note what that
-- means for the savings row: money moved to savings is a TRANSFER, so actual
-- savings is measured separately below rather than pulled from this function.

create function public.spending_by_classification(
  p_month date default date_trunc('month', current_date)::date
)
returns table (
  classification public.classification,
  total_minor    bigint
)
language sql
stable
security invoker
as $$
  select t.classification, sum(t.amount_minor)::bigint
    from public.transactions t
   where t.user_id = auth.uid()
     and t.type = 'expense'
     and t.classification is not null
     and t.transaction_date >= p_month
     and t.transaction_date <  (p_month + interval '1 month')::date
   group by t.classification;
$$;

grant execute on function public.spending_by_classification(date) to authenticated;


-- ─── saved_to_savings_minor ─────────────────────────────────────────────────
-- Actual savings for a month: net money moved INTO liability-free savings
-- accounts by transfer.
--
-- This is the one waterfall row that cannot come from expenses, because saving
-- is not spending — that is the entire point of P3. It is measured as transfers
-- landing in accounts of type 'savings', net of transfers back out, so moving
-- ₱5,000 in and ₱2,000 back out reads as ₱3,000 saved rather than ₱5,000.

create function public.saved_to_savings_minor(
  p_month date default date_trunc('month', current_date)::date
)
returns bigint
language sql
stable
security invoker
as $$
  select coalesce(sum(
           case when t.direction = 'in' then t.amount_minor else -t.amount_minor end
         ), 0)::bigint
    from public.transactions t
    join public.accounts a on a.id = t.account_id
   where t.user_id = auth.uid()
     and t.type = 'transfer'
     and a.type = 'savings'
     and not a.is_liability
     and t.transaction_date >= p_month
     and t.transaction_date <  (p_month + interval '1 month')::date;
$$;

grant execute on function public.saved_to_savings_minor(date) to authenticated;
