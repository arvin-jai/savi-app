-- ─────────────────────────────────────────────────────────────────────────────
-- Bills that recur every N months — quarterly, half-yearly, yearly.
--
-- Requested from real use: "if it is for 3, 6, 12 months". Until now the Add
-- Bill form hardcoded `recurrence = 'monthly'` and there was no way to say a
-- bill arrives every quarter.
--
-- Two columns rather than more enum values:
--
--   interval_months  how often, in months
--   anchor_month     WHICH months it lands in
--
-- The anchor is the part that is easy to forget. "Every 3 months" is not a
-- schedule — a quarterly bill anchored in February falls Feb/May/Aug/Nov, and
-- one anchored in January falls Jan/Apr/Jul/Oct. Without an anchor the engine
-- would have to guess, and it would guess differently in SQL than in the app.
--
-- Backward compatible by construction: every existing bill gets
-- interval_months = 1, for which the anchor is irrelevant because every month
-- is an occurrence. No backfill of anchors is needed and no existing bill
-- changes behaviour.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.bills
  add column interval_months smallint not null default 1
    check (interval_months in (1, 2, 3, 4, 6, 12)),
  -- First of the month of the FIRST occurrence. Null is only valid for monthly
  -- bills, where it carries no information.
  add column anchor_month date;

-- A non-monthly bill without an anchor is unschedulable, so the database
-- refuses to store one.
alter table public.bills
  add constraint bills_interval_needs_anchor check (
    interval_months = 1 or anchor_month is not null
  );

-- The anchor names a month, so the day is noise. Storing 2026-08-17 and
-- 2026-08-01 as different anchors for the same schedule would be a bug waiting
-- to be compared.
alter table public.bills
  add constraint bills_anchor_is_first_of_month check (
    anchor_month is null or extract(day from anchor_month) = 1
  );


-- ─── Does this bill occur in the given month? ───────────────────────────────
-- The single source of truth for the interval rule, used by
-- upcoming_bills_minor below. `features/bills/schedule.ts` mirrors it for the
-- client, held by a contract test.

create function public.bill_occurs_in_month(
  p_interval_months smallint,
  p_anchor_month date,
  p_period date
)
returns boolean
language sql
immutable
as $$
  select case
    -- Monthly: every month, and the anchor is ignored entirely.
    when p_interval_months = 1 then true
    -- Before the first occurrence, it does not occur.
    when p_anchor_month is null or p_period < p_anchor_month then false
    else (
      (extract(year from p_period)::int * 12 + extract(month from p_period)::int)
      -
      (extract(year from p_anchor_month)::int * 12 + extract(month from p_anchor_month)::int)
    ) % p_interval_months = 0
  end;
$$;

grant execute on function public.bill_occurs_in_month(smallint, date, date) to authenticated;


-- ─── upcoming_bills_minor, interval-aware ───────────────────────────────────
-- Replaces the M2 version. A quarterly bill must NOT be counted in the two
-- months it is not due — counting it would overstate Upcoming Bills and
-- therefore understate Available Money every month, which is the headline
-- figure on the dashboard.

create or replace function public.upcoming_bills_minor(
  p_user uuid,
  p_period date default date_trunc('month', current_date)::date
)
returns bigint
language sql
stable
as $$
  select coalesce(sum(b.amount_minor), 0)::bigint
    from public.bills b
   where b.user_id = p_user
     and b.archived_at is null
     and public.bill_occurs_in_month(b.interval_months, b.anchor_month, p_period)
     and not exists (
       select 1
         from public.bill_payments p
        where p.bill_id = b.id
          and p.period = p_period
     );
$$;
