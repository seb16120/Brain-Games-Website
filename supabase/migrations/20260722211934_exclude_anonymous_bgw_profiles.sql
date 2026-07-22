drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
for select to authenticated
using (
  coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false'
  and (select auth.uid()) = id
);

create policy "profiles_insert_own" on public.profiles
for insert to authenticated
with check (
  coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false'
  and (select auth.uid()) = id
);

create policy "profiles_update_own" on public.profiles
for update to authenticated
using (
  coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false'
  and (select auth.uid()) = id
)
with check (
  coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false'
  and (select auth.uid()) = id
);

create or replace function private.handle_bgw_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare candidate_name text;
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;
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
