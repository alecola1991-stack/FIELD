-- FIELD account progress: each authenticated user can access only their own row.
create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.player_profiles enable row level security;
revoke all on table public.player_profiles from anon, authenticated;
grant select, insert, update on table public.player_profiles to authenticated;

drop policy if exists "Players can read their own profile" on public.player_profiles;
create policy "Players can read their own profile"
  on public.player_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Players can create their own profile" on public.player_profiles;
create policy "Players can create their own profile"
  on public.player_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Players can update their own profile" on public.player_profiles;
create policy "Players can update their own profile"
  on public.player_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.save_player_profile(profile_data jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Sign in before saving your progress.' using errcode = '42501';
  end if;
  if profile_data is null or jsonb_typeof(profile_data) <> 'object' then
    raise exception 'Profile must be a JSON object.' using errcode = '22023';
  end if;
  if pg_column_size(profile_data) > 220000 then
    raise exception 'Profile is too large.' using errcode = '22023';
  end if;

  insert into public.player_profiles (user_id, profile, updated_at)
  values (current_user_id, profile_data, now())
  on conflict (user_id) do update
    set profile = excluded.profile,
        updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.save_player_profile(jsonb) from public, anon;
grant execute on function public.save_player_profile(jsonb) to authenticated;
