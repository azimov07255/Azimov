-- Azimov cloud sync: one JSON snapshot per user, optimistic-locked by `rev`.
create table if not exists public.azimov_user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null,
  rev        bigint      not null default 1,
  device     text,
  updated_at timestamptz not null default now()
);

comment on table public.azimov_user_data is 'Azimov personal-finance app: one JSON snapshot per user, optimistic-locked by rev.';

alter table public.azimov_user_data enable row level security;

create policy "azimov select own" on public.azimov_user_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "azimov insert own" on public.azimov_user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "azimov update own" on public.azimov_user_data
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "azimov delete own" on public.azimov_user_data
  for delete to authenticated using ((select auth.uid()) = user_id);

-- bump rev / updated_at on every update so clients can detect concurrent edits
create or replace function public.azimov_bump_rev()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.rev := old.rev + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger azimov_user_data_bump
  before update on public.azimov_user_data
  for each row execute function public.azimov_bump_rev();

revoke all on public.azimov_user_data from anon;
grant select, insert, update, delete on public.azimov_user_data to authenticated;
