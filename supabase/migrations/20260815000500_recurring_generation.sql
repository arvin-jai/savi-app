-- ─────────────────────────────────────────────────────────────────────────────
-- Recurring transactions actually generate now.
--
-- Since v0.1 a `recurring_transactions` row has been inert: onboarding writes
-- the user's salary and payday, `next_run` is set once, and nothing ever reads
-- it. The row is a fact Savi knows, not money in the ledger — so someone with a
-- ₱30,000 monthly salary saw ₱0 income every month. The v0.1 comment said the
-- generation cron "arrives with notifications (v0.3)"; v0.3 shipped without it.
--
-- Reported from use: "income should be entered monthly like money tracker".
--
-- ── Why a SQL function rather than a client loop ────────────────────────────
--
-- Generation must be idempotent. Two devices opening the app on payday, or one
-- device double-mounting a screen, must not produce two salaries. A client-side
-- "read next_run, insert, write next_run" is a read-modify-write race with real
-- money at the end of it.
--
-- Here the insert and the advance happen in one statement per period, and the
-- unique index below makes a duplicate physically impossible rather than
-- merely unlikely.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.transactions
  add column recurring_transaction_id uuid
    references public.recurring_transactions(id) on delete set null;

-- The idempotency guarantee. One generated transaction per schedule per date,
-- enforced by the database — not by hoping the client only asks once.
--
-- ON DELETE SET NULL above means deleting a schedule keeps the money it already
-- generated: those pesos really did arrive, and a ledger that forgets them
-- because you tidied up a schedule is wrong.
create unique index transactions_one_per_recurrence
  on public.transactions (recurring_transaction_id, transaction_date)
  where recurring_transaction_id is not null;


-- ─── generate_due_recurring ─────────────────────────────────────────────────
-- Materialises every occurrence due on or before today, advances next_run, and
-- returns how many transactions it created.
--
-- `security invoker`, so RLS applies and a user can only ever generate their
-- own. It is safe to call on every app open.

create function public.generate_due_recurring(p_today date default current_date)
returns integer
language plpgsql
security invoker
as $$
declare
  r            public.recurring_transactions;
  v_created    integer := 0;
  v_run        date;
  v_guard      integer;
  v_next_month date;
begin
  for r in
    select * from public.recurring_transactions
     where user_id = auth.uid()
       and archived_at is null
       and recurrence = 'monthly'
       and next_run <= p_today
  loop
    v_run := r.next_run;

    -- Bounded at 12 periods per call. A schedule left dormant for years must
    -- not silently manufacture a decade of salary the first time the app is
    -- opened; 12 covers any realistic gap and caps the damage of a bad
    -- next_run.
    v_guard := 0;

    while v_run <= p_today and v_guard < 12 loop
      -- ON CONFLICT DO NOTHING is the second half of idempotency: if this
      -- period was already generated (another device, a retry), skip it
      -- silently rather than failing the whole run.
      insert into public.transactions (
        user_id, account_id, amount_minor, currency, direction, type,
        classification, category_id, description, transaction_date,
        recurring_transaction_id
      )
      values (
        r.user_id, r.account_id, r.amount_minor, r.currency, r.direction, r.type,
        r.classification, r.category_id, r.description, v_run,
        r.id
      )
      -- The WHERE clause is required, not decorative: the unique index above is
      -- PARTIAL, and Postgres will not infer a partial index unless the
      -- predicate is repeated here. Without it: "there is no unique or
      -- exclusion constraint matching the ON CONFLICT specification".
      on conflict (recurring_transaction_id, transaction_date)
        where recurring_transaction_id is not null
        do nothing;

      if found then
        v_created := v_created + 1;
      end if;

      -- Advance one month, re-clamping the day: a payday on the 31st lands on
      -- Feb 28, exactly as a bill due on the 31st does (M4). Without the
      -- re-clamp, January's 31st would drift to the 28th permanently.
      v_next_month := (date_trunc('month', v_run) + interval '1 month')::date;
      v_run := v_next_month
             + (least(
                 coalesce(r.day_of_month, extract(day from v_run)::int),
                 extract(day from (date_trunc('month', v_next_month) + interval '1 month - 1 day'))::int
               ) - 1);

      v_guard := v_guard + 1;
    end loop;

    update public.recurring_transactions
       set next_run = v_run
     where id = r.id;
  end loop;

  return v_created;
end;
$$;

grant execute on function public.generate_due_recurring(date) to authenticated;
