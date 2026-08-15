-- ─────────────────────────────────────────────────────────────────────────────
-- Table privileges.
--
-- RLS and GRANT are two INDEPENDENT gates, and both must allow:
--
--   GRANT  → may this role touch this table at all?
--   POLICY → which rows may it see or change?
--
-- Enabling RLS with policies but no grants makes a table completely
-- inaccessible ("permission denied for table accounts"). Granting without RLS
-- makes it world-readable. The first failure is loud and gets fixed in minutes;
-- the second is silent and is a data breach. This file is deliberately explicit
-- so the pairing is auditable in one place.
--
-- Each grant below is the exact set of verbs that table has policies for — no
-- verb is granted that RLS would not then constrain.
-- ─────────────────────────────────────────────────────────────────────────────

grant usage on schema public to anon, authenticated;

-- profiles: created by trigger, deleted by cascade. No INSERT/DELETE policy
-- exists, so no INSERT/DELETE grant is given.
grant select, update on public.profiles to authenticated;

grant select, insert, update, delete on public.accounts               to authenticated;
grant select, insert, update, delete on public.categories             to authenticated;
grant select, insert, update, delete on public.transactions           to authenticated;
grant select, insert, update, delete on public.bills                  to authenticated;
grant select, insert, update, delete on public.bill_payments          to authenticated;
grant select, insert, update, delete on public.recurring_transactions to authenticated;

-- The calculation engine (P§23). All are `security invoker`, so RLS still
-- applies inside them — a user can only ever summarise their own rows.
grant execute on function public.financial_summary(date)              to authenticated;
grant execute on function public.create_transfer(uuid, uuid, bigint, date, text) to authenticated;
grant execute on function public.available_money_minor(uuid, date)    to authenticated;
grant execute on function public.current_balance_minor(uuid)          to authenticated;
grant execute on function public.upcoming_bills_minor(uuid, date)     to authenticated;

-- `anon` gets nothing. An unauthenticated client has no reason to read
-- financial data, and a missing grant is a better backstop than a policy that
-- happens to evaluate false.
