-- A deliberately tiny, read-only RPC for external uptime checks.
--
-- Free Supabase projects may be paused after a week of low activity. The
-- scheduled GitHub Actions workflow calls this function through PostgREST a
-- few times per day, producing a real API/database request without reading or
-- changing any user data.

create or replace function public.keep_alive()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select statement_timestamp();
$$;

revoke all on function public.keep_alive() from public;
grant execute on function public.keep_alive() to anon, authenticated;

comment on function public.keep_alive() is
  'Read-only health check used by the external scheduled keep-alive workflow.';
