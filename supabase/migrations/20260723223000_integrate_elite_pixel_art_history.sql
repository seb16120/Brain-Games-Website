-- BGW-P4 · Elite Pixel Art -> historique commun Brainy Games Hub.
-- Les résultats online sont produits par le serveur et restent amicaux.

alter table public.elite_pixel_rooms
  add column if not exists match_series_id uuid not null default gen_random_uuid(),
  add column if not exists match_started_at timestamptz;

update public.elite_pixel_rooms
set match_started_at = coalesce(match_started_at, created_at)
where match_started_at is null;

alter table public.elite_pixel_rooms
  alter column match_started_at set not null,
  alter column match_started_at set default now();

create or replace function public.elite_pixel_prepare_match_series()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'waiting' and new.status = 'active' then
    new.match_started_at := clock_timestamp();
  elsif old.phase = 'match_finished'
        and new.phase = 'shared'
        and new.status = 'active' then
    new.match_series_id := gen_random_uuid();
    new.match_started_at := clock_timestamp();
  end if;
  return new;
end;
$$;

revoke all on function public.elite_pixel_prepare_match_series()
  from public, anon, authenticated;

drop trigger if exists elite_pixel_prepare_match_series_trigger
  on public.elite_pixel_rooms;
create trigger elite_pixel_prepare_match_series_trigger
before update of status, phase on public.elite_pixel_rooms
for each row
execute function public.elite_pixel_prepare_match_series();

create or replace function public.elite_pixel_publish_bgw_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submitter uuid;
  v_participants jsonb;
  v_finish_reason text;
  v_match_id text := 'epa-online:' || new.match_series_id::text;
begin
  if new.phase <> 'match_finished'
     or old.phase = 'match_finished'
     or new.round_winner is null then
    return new;
  end if;

  select player.user_id
  into v_submitter
  from public.elite_pixel_room_players player
  join public.profiles profile on profile.id = player.user_id
  where player.room_id = new.id
  order by (player.user_id = new.host_id) desc, player.seat
  limit 1;

  -- Sans profil BGW vérifié, il n'existe aucun historique personnel à alimenter.
  if v_submitter is null then
    return new;
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'player_id', player.user_id,
      'seat', player.seat,
      'team_id', null,
      'outcome', case
        when player.seat = new.round_winner then 'win'
        else 'loss'
      end,
      'score', new.scores[player.seat]
    )
    order by player.seat
  )
  into v_participants
  from public.elite_pixel_room_players player
  where player.room_id = new.id;

  if jsonb_array_length(coalesce(v_participants, '[]'::jsonb)) <> 2 then
    return new;
  end if;

  v_finish_reason := case
    when coalesce(new.last_reason, '') ilike '%quitté%' then 'forfeit'
    when coalesce(new.last_reason, '') ilike '%reconnecté%' then 'disconnect'
    when coalesce(new.last_reason, '') ilike '%temps écoulé%' then 'timeout'
    else 'normal'
  end;

  insert into public.match_events (
    event_id,
    schema_version,
    game_id,
    match_id,
    category,
    started_at,
    ended_at,
    format,
    participants,
    finish_reason,
    validation_authority,
    validation_reference,
    submitted_by
  )
  values (
    new.match_series_id,
    '1.0',
    'elite-pixel-art',
    v_match_id,
    'friendly_online',
    new.match_started_at,
    coalesce(new.finished_at, clock_timestamp()),
    jsonb_build_object('type', 'first_to', 'target_score', new.score_limit),
    v_participants,
    v_finish_reason,
    'server',
    'elite-pixel-art:supabase:room:' || new.id::text
      || ':series:' || new.match_series_id::text,
    v_submitter
  )
  on conflict (event_id) do nothing;

  insert into public.match_profile_results (
    event_id,
    submitted_by,
    profile_id,
    player_id,
    seat,
    team_id,
    outcome,
    score
  )
  select
    new.match_series_id,
    v_submitter,
    profile.id,
    player.user_id,
    player.seat,
    null,
    case when player.seat = new.round_winner then 'win' else 'loss' end,
    new.scores[player.seat]
  from public.elite_pixel_room_players player
  join public.profiles profile on profile.id = player.user_id
  where player.room_id = new.id
  on conflict (event_id, profile_id) do nothing;

  return new;
end;
$$;

revoke all on function public.elite_pixel_publish_bgw_match()
  from public, anon, authenticated;

drop trigger if exists elite_pixel_publish_bgw_match_trigger
  on public.elite_pixel_rooms;
create trigger elite_pixel_publish_bgw_match_trigger
after update of status, phase on public.elite_pixel_rooms
for each row
when (new.phase = 'match_finished')
execute function public.elite_pixel_publish_bgw_match();

comment on column public.elite_pixel_rooms.match_series_id is
  'Identifiant idempotent d’un FT1/FT2/FT3, renouvelé lors d’une revanche.';
comment on column public.elite_pixel_rooms.match_started_at is
  'Début du FT courant utilisé par l’historique Brainy Games Hub.';

