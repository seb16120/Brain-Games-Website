create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to postgres;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
grant select, insert, update on table public.profiles to authenticated;
revoke all on table public.profiles from anon;

create policy "profiles_select_own" on public.profiles
for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles
for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create or replace function private.set_bgw_profile_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.set_bgw_profile_updated_at() from public;
grant execute on function private.set_bgw_profile_updated_at() to postgres;

create trigger set_bgw_profile_updated_at
before update on public.profiles
for each row execute function private.set_bgw_profile_updated_at();

create or replace function private.handle_bgw_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare candidate_name text;
begin
  candidate_name := left(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Joueur'
  ), 24);
  if char_length(candidate_name) < 2 then
    candidate_name := 'Joueur ' || left(new.id::text, 6);
  end if;
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, candidate_name, nullif(new.raw_user_meta_data ->> 'avatar_url', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.handle_bgw_new_user() from public;
grant execute on function private.handle_bgw_new_user() to postgres;

create trigger create_bgw_profile_after_signup
after insert on auth.users
for each row execute function private.handle_bgw_new_user();
