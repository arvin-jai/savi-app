-- ─────────────────────────────────────────────────────────────────────────────
-- Generation stops when the account it pays into is archived.
--
-- Found while fixing a report that deleting an account left its Salary still
-- drawn on the calendar. The delete path was a stale client cache; the archive
-- path was worse and nobody had looked at it.
--
-- `generate_due_recurring()` filtered on `recurring_transactions.archived_at`
-- and never looked at the account. Archiving an account therefore hid it from
-- every list while its salary kept landing in it every month: the balance grew
-- where the user could not see it, Total Income climbed, and Available Money
-- moved for a reason that had disappeared from the UI.
--
-- Archiving already means "I have stopped using this" — the whole reason it is
-- offered instead of deleting is that it keeps history true without keeping the
-- account live. Continuing to manufacture money into it is the opposite of
-- that. Note this is *only* about future generation: everything already
-- generated stays, exactly as archiving promises.
--
-- Deleting needs no equivalent, because `recurring_transactions.account_id` is
-- ON DELETE CASCADE — the schedule goes with the account. What that lacked was
-- a confirmation that said so, which is now in the delete sheet.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.generate_due_recurring(p_today date default current_date)
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
    select rt.*
      from public.recurring_transactions rt
      join public.accounts a on a.id = rt.account_id
     where rt.user_id = auth.uid()
       and rt.archived_at is null
       -- The new condition. A join rather than a subquery so a schedule whose
       -- account has somehow gone is skipped too, rather than failing the run.
       and a.archived_at is null
       and rt.recurrence = 'monthly'
       and rt.next_run <= p_today
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
      -- The WHERE clause is required, not decorative: the unique index is
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
