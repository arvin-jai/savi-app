-- ─────────────────────────────────────────────────────────────────────────────
-- bills, bill_payments, recurring_transactions
--
-- bill_payments exists so "Mark as paid" (D§34) is an EVENT, not a mutable flag
-- on the bill. That is what makes undo, payment history, and "how much of my
-- bills have I actually paid this month" answerable without a later migration.
-- D§59 removes the confirmation dialog from marking a bill paid, which is only
-- safe because the action is a row that can be deleted.
-- ─────────────────────────────────────────────────────────────────────────────

create type public.recurrence as enum ('monthly', 'weekly', 'yearly', 'none');

create table public.bills (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null check (char_length(trim(name)) > 0),
  amount_minor bigint not null check (amount_minor > 0),
  currency     text not null default 'PHP' check (char_length(currency) = 3),
  recurrence   public.recurrence not null default 'monthly',
  -- Day of month for monthly bills ("Internet ₱1,699 every 15th" — P§15).
  due_day      int check (due_day between 1 and 31),
  category_id  uuid references public.categories(id) on delete set null,
  account_id   uuid references public.accounts(id) on delete set null,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint bills_due_day_required_for_monthly check (
    recurrence <> 'monthly' or due_day is not null
  )
);

create index bills_user_idx on public.bills (user_id) where archived_at is null;

alter table public.bills enable row level security;

create policy "bills: read own"   on public.bills for select using (auth.uid() = user_id);
create policy "bills: insert own" on public.bills for insert with check (auth.uid() = user_id);
create policy "bills: update own" on public.bills for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "bills: delete own" on public.bills for delete using (auth.uid() = user_id);

create trigger bills_touch_updated_at
  before update on public.bills
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- bill_payments
-- ─────────────────────────────────────────────────────────────────────────────

create table public.bill_payments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  bill_id        uuid not null references public.bills(id) on delete cascade,
  -- The period this payment settles, normalised to the first of the month for
  -- monthly bills. Paying twice for one period is the bug this prevents.
  period         date not null,
  paid_at        timestamptz not null default now(),
  -- The money movement, if one was recorded. Nullable: a user may mark a bill
  -- paid without logging the transaction, and forcing them to would make the
  -- one-tap action a form.
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at     timestamptz not null default now(),

  unique (bill_id, period)
);

create index bill_payments_user_idx on public.bill_payments (user_id);
create index bill_payments_bill_idx on public.bill_payments (bill_id);

alter table public.bill_payments enable row level security;

create policy "bill_payments: read own"   on public.bill_payments for select using (auth.uid() = user_id);
create policy "bill_payments: insert own" on public.bill_payments for insert with check (auth.uid() = user_id);
create policy "bill_payments: update own" on public.bill_payments for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- DELETE is the undo path for D§59's no-confirmation "Mark as paid".
create policy "bill_payments: delete own" on public.bill_payments for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- recurring_transactions
--
-- Replaces the `income` table from P§28 (BUILD-PLAN P2). Recurring salary is a
-- schedule that GENERATES transactions; it is not a parallel ledger.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.recurring_transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  account_id     uuid not null references public.accounts(id) on delete cascade,
  amount_minor   bigint not null check (amount_minor > 0),
  currency       text not null default 'PHP' check (char_length(currency) = 3),
  direction      public.txn_direction not null,
  type           public.txn_type not null,
  classification public.classification,
  category_id    uuid references public.categories(id) on delete set null,
  description    text,
  recurrence     public.recurrence not null default 'monthly',
  day_of_month   int check (day_of_month between 1 and 31),
  next_run       date not null,
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Same axis rules as transactions: a schedule cannot generate a row the
  -- transactions table would reject.
  constraint rec_direction_matches_type check (
    (type = 'income'  and direction = 'in')  or
    (type = 'expense' and direction = 'out') or
    (type = 'transfer')
  ),
  constraint rec_classification_iff_expense check (
    (type = 'expense' and classification is not null) or
    (type <> 'expense' and classification is null)
  )
);

create index recurring_user_idx on public.recurring_transactions (user_id) where archived_at is null;

alter table public.recurring_transactions enable row level security;

create policy "recurring: read own"   on public.recurring_transactions for select using (auth.uid() = user_id);
create policy "recurring: insert own" on public.recurring_transactions for insert with check (auth.uid() = user_id);
create policy "recurring: update own" on public.recurring_transactions for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recurring: delete own" on public.recurring_transactions for delete using (auth.uid() = user_id);

create trigger recurring_touch_updated_at
  before update on public.recurring_transactions
  for each row execute function public.touch_updated_at();
