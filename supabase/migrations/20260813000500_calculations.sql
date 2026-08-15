-- ─────────────────────────────────────────────────────────────────────────────
-- Financial calculation engine (corrected P§23)
--
-- The backend calculates; the AI interprets. The model is never responsible for
-- arithmetic. These five numbers ARE the product — if they are wrong, nothing
-- built on top of them matters.
--
--   Total Income    = Σ transactions WHERE type = 'income'
--   Total Expenses  = Σ transactions WHERE type = 'expense'
--   Remaining       = Total Income − Total Expenses
--   Upcoming Bills  = Σ unpaid bills due in the current period
--   Current Balance = Σ asset accounts (excludes liabilities)
--   Available Money = Current Balance − Upcoming Bills
--
-- Transfers need no exclusion clause: type='transfer' simply does not match the
-- income or expense filters (BUILD-PLAN P3). The safety is structural.
--
-- `Remaining` and `Available Money` are DIFFERENT numbers answering different
-- questions, and conflating them was the v1.0 defect (BUILD-PLAN P1):
--   Remaining       → "what's left of this month's income?"
--   Available Money → "what can I spend without missing a payment?"
-- ─────────────────────────────────────────────────────────────────────────────

-- Unpaid bills due within the given period.
create function public.upcoming_bills_minor(p_user uuid, p_period date default date_trunc('month', current_date)::date)
returns bigint
language sql
stable
as $$
  select coalesce(sum(b.amount_minor), 0)::bigint
    from public.bills b
   where b.user_id = p_user
     and b.archived_at is null
     and not exists (
       select 1
         from public.bill_payments p
        where p.bill_id = b.id
          and p.period = p_period
     );
$$;

-- Σ asset accounts. Credit cards and other liabilities are excluded: a card
-- balance is money owed, not money available (BUILD-PLAN P1).
create function public.current_balance_minor(p_user uuid)
returns bigint
language sql
stable
as $$
  select coalesce(sum(a.balance_minor), 0)::bigint
    from public.accounts a
   where a.user_id = p_user
     and a.archived_at is null
     and not a.is_liability;
$$;

-- The dashboard's Level 1 figure (D§26).
create function public.available_money_minor(p_user uuid, p_period date default date_trunc('month', current_date)::date)
returns bigint
language sql
stable
as $$
  select public.current_balance_minor(p_user) - public.upcoming_bills_minor(p_user, p_period);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- The whole summary in one round trip, so the dashboard is a single request and
-- every figure comes from the same snapshot.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.financial_summary(p_period date default date_trunc('month', current_date)::date)
returns table (
  total_income_minor   bigint,
  total_expenses_minor bigint,
  remaining_minor      bigint,
  upcoming_bills_minor bigint,
  current_balance_minor bigint,
  available_money_minor bigint
)
language sql
stable
security invoker  -- RLS applies: a user can only ever summarise their own rows
as $$
  with period as (
    select p_period as start_date,
           (p_period + interval '1 month')::date as end_date
  ),
  totals as (
    select
      coalesce(sum(t.amount_minor) filter (where t.type = 'income'),  0)::bigint as income,
      coalesce(sum(t.amount_minor) filter (where t.type = 'expense'), 0)::bigint as expenses
      from public.transactions t, period
     where t.user_id = auth.uid()
       and t.transaction_date >= period.start_date
       and t.transaction_date <  period.end_date
  )
  select
    totals.income,
    totals.expenses,
    totals.income - totals.expenses,
    public.upcoming_bills_minor(auth.uid(), p_period),
    public.current_balance_minor(auth.uid()),
    public.available_money_minor(auth.uid(), p_period)
  from totals;
$$;
