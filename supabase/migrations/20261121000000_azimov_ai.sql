-- Azimov AI advisor: per-user daily request counter (cost control). Written only by the azimov-advisor edge function.
create table if not exists public.azimov_ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default ((now() at time zone 'utc')::date),
  n       int  not null default 0,
  primary key (user_id, day)
);
alter table public.azimov_ai_usage enable row level security; -- no policies: only the edge function (service role) touches it
revoke all on public.azimov_ai_usage from anon, authenticated;

-- atomic "count one request unless today's limit is reached": returns the new count, or -1 when the limit is hit
create or replace function public.azimov_ai_hit(p_user uuid, p_limit int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare c int;
begin
  insert into public.azimov_ai_usage as u (user_id, day, n)
  values (p_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set n = u.n + 1 where u.n < p_limit
  returning u.n into c;
  return coalesce(c, -1);
end;
$$;

create or replace function public.azimov_ai_refund(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.azimov_ai_usage set n = greatest(n - 1, 0) where user_id = p_user and day = (now() at time zone 'utc')::date;
$$;

revoke all on function public.azimov_ai_hit(uuid, int) from public, anon, authenticated;
revoke all on function public.azimov_ai_refund(uuid) from public, anon, authenticated;
grant execute on function public.azimov_ai_hit(uuid, int) to service_role;
grant execute on function public.azimov_ai_refund(uuid) to service_role;
