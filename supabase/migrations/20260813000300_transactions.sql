-- ─────────────────────────────────────────────────────────────────────────────
-- transactions (corrected P§14)
--
-- Every financial movement is a transaction. There is no separate `income`
-- table — two homes for the same fact means every sum in P§23 has to choose
-- which to read, and anything recorded in one but not the other silently
-- corrupts Total Income, Remaining, and Available Money (BUILD-PLAN P2).
--
-- amount_minor is a POSITIVE magnitude. `direction` carries the sign. That
-- makes per-account balance uniform across all three types:
--     balance = Σ(direction='in') − Σ(direction='out')
--
-- A transfer is TWO paired rows sharing transfer_group_id. Because `transfer`
-- is its own type, the spending aggregates (type='expense') exclude it
-- structurally — there is no filter to forget. That is the whole point: a
-- forgotten filter would report moving ₱5,000 into savings as ₱5,000 spent,
-- and tell a saving user they had overspent (BUILD-PLAN P3).
-- ─────────────────────────────────────────────────────────────────────────────

create type public.txn_type      as enum ('income', 'expense', 'transfer');
create type public.txn_direction as enum ('in', 'out');
create type public.classification as enum ('need', 'want', 'bill');

create table public.transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  account_id        uuid not null references public.accounts(id) on delete cascade,
  amount_minor      bigint not null check (amount_minor > 0),
  currency          text not null default 'PHP' check (char_length(currency) = 3),
  direction         public.txn_direction not null,
  type              public.txn_type not null,
  classification    public.classification,
  category_id       uuid references public.categories(id) on delete set null,
  transfer_group_id uuid,
  description       text,
  transaction_date  date not null default current_date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- The direction a type implies. Only `transfer` may be either.
  constraint txn_direction_matches_type check (
    (type = 'income'   and direction = 'in')  or
    (type = 'expense'  and direction = 'out') or
    (type = 'transfer')
  ),

  -- classification is an EXPENSE axis (BUILD-PLAN P4). Income and transfers
  -- carry null — a transfer is not a "want".
  constraint txn_classification_iff_expense check (
    (type = 'expense' and classification is not null) or
    (type <> 'expense' and classification is null)
  ),

  -- transfer_group_id exists if and only if this is a transfer.
  constraint txn_group_iff_transfer check (
    (type = 'transfer' and transfer_group_id is not null) or
    (type <> 'transfer' and transfer_group_id is null)
  )
);

create index txn_user_date_idx  on public.transactions (user_id, transaction_date desc);
create index txn_account_idx    on public.transactions (account_id);
create index txn_group_idx      on public.transactions (transfer_group_id) where transfer_group_id is not null;

alter table public.transactions enable row level security;

create policy "transactions: read own"   on public.transactions for select using (auth.uid() = user_id);
create policy "transactions: insert own" on public.transactions for insert with check (auth.uid() = user_id);
create policy "transactions: update own" on public.transactions for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions: delete own" on public.transactions for delete using (auth.uid() = user_id);

create trigger transactions_touch_updated_at
  before update on public.transactions
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Transfer pair invariant.
--
-- A row-level CHECK cannot see sibling rows, so this is a DEFERRED constraint
-- trigger: it fires at COMMIT, by which time both halves of a transfer exist.
-- That is what makes "a transfer never exists half-written" enforceable in the
-- database rather than hoped for in the client.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.check_transfer_pair()
returns trigger
language plpgsql
as $$
declare
  gid uuid := coalesce(new.transfer_group_id, old.transfer_group_id);
  n_rows int;
  n_in int;
  n_out int;
  n_accounts int;
  n_amounts int;
  n_currencies int;
begin
  if gid is null then
    return null;
  end if;

  select count(*),
         count(*) filter (where direction = 'in'),
         count(*) filter (where direction = 'out'),
         count(distinct account_id),
         count(distinct amount_minor),
         count(distinct currency)
    into n_rows, n_in, n_out, n_accounts, n_amounts, n_currencies
    from public.transactions
   where transfer_group_id = gid;

  -- The whole group was deleted; nothing to validate.
  if n_rows = 0 then
    return null;
  end if;

  if n_rows <> 2 then
    raise exception 'transfer % must have exactly 2 rows, found %', gid, n_rows;
  end if;

  if n_in <> 1 or n_out <> 1 then
    raise exception 'transfer % must have one in and one out row', gid;
  end if;

  if n_accounts <> 2 then
    raise exception 'transfer % must move between two different accounts', gid;
  end if;

  if n_amounts <> 1 then
    raise exception 'transfer % legs must have equal amounts', gid;
  end if;

  -- v0.1 is single-currency (BUILD-PLAN P7). A cross-currency transfer needs an
  -- exchange rate on the group, which does not exist yet — so reject it rather
  -- than silently treating 100 USD as 100 PHP.
  if n_currencies <> 1 then
    raise exception 'transfer % legs must share a currency until multi-currency is specified', gid;
  end if;

  return null;
end;
$$;

create constraint trigger transactions_transfer_pair
  after insert or update or delete on public.transactions
  deferrable initially deferred
  for each row execute function public.check_transfer_pair();

-- ─────────────────────────────────────────────────────────────────────────────
-- Account balance maintenance.
--
-- Kept in the same database transaction as the movement that caused it, so a
-- balance can never disagree with the ledger that produced it.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.apply_balance_delta(p_account uuid, p_delta bigint)
returns void
language sql
as $$
  update public.accounts
     set balance_minor = balance_minor + p_delta
   where id = p_account;
$$;

create function public.transactions_maintain_balance()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('DELETE', 'UPDATE') then
    perform public.apply_balance_delta(
      old.account_id,
      case when old.direction = 'in' then -old.amount_minor else old.amount_minor end
    );
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform public.apply_balance_delta(
      new.account_id,
      case when new.direction = 'in' then new.amount_minor else -new.amount_minor end
    );
  end if;

  return null;
end;
$$;

create trigger transactions_balance
  after insert or update or delete on public.transactions
  for each row execute function public.transactions_maintain_balance();

-- ─────────────────────────────────────────────────────────────────────────────
-- create_transfer — the only supported way to write a transfer.
--
-- Writing both legs client-side would mean two round trips and a window where
-- half a transfer exists. This is one statement, one transaction.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.create_transfer(
  p_from_account uuid,
  p_to_account   uuid,
  p_amount_minor bigint,
  p_date         date default current_date,
  p_description  text default null
)
returns uuid
language plpgsql
security invoker  -- RLS still applies; a user cannot transfer from someone else's account
as $$
declare
  gid uuid := gen_random_uuid();
  v_currency text;
begin
  if p_from_account = p_to_account then
    raise exception 'cannot transfer to the same account';
  end if;

  if p_amount_minor <= 0 then
    raise exception 'transfer amount must be positive';
  end if;

  select currency into v_currency from public.accounts where id = p_from_account;
  if v_currency is null then
    raise exception 'source account not found';
  end if;

  insert into public.transactions
    (user_id, account_id, amount_minor, currency, direction, type, transfer_group_id, description, transaction_date)
  values
    (auth.uid(), p_from_account, p_amount_minor, v_currency, 'out', 'transfer', gid, p_description, p_date),
    (auth.uid(), p_to_account,   p_amount_minor, v_currency, 'in',  'transfer', gid, p_description, p_date);

  return gid;
end;
$$;
