
create table public.match_events (
  event_id uuid primary key,
  schema_version text not null default '1.0',
  game_id text not null,
  match_id text not null,
  category text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  format jsonb,
  participants jsonb not null,
  finish_reason text not null,
  validation_authority text not null,
  validation_reference text not null,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),

  constraint match_events_event_submitter_key unique (event_id, submitted_by),
  constraint match_events_game_match_key unique (game_id, match_id),
  constraint match_events_schema_version_check check (schema_version = '1.0'),
  constraint match_events_game_id_check check (
    game_id in ('bingo-reversible', 'elite-pixel-art', 'lucky-21', 'exit-strategy-3', 'otrio')
  ),
  constraint match_events_match_id_check check (
    length(btrim(match_id)) between 1 and 128
  ),
  constraint match_events_category_check check (
    category in ('ranked', 'friendly_online', 'friendly_local')
  ),
  constraint match_events_dates_check check (ended_at >= started_at),
  constraint match_events_format_check check (
    format is null or jsonb_typeof(format) = 'object'
  ),
  constraint match_events_participants_check check (
    jsonb_typeof(participants) = 'array'
    and jsonb_array_length(participants) between 2 and 16
  ),
  constraint match_events_finish_reason_check check (
    finish_reason in ('normal', 'forfeit', 'disconnect', 'timeout')
  ),
  constraint match_events_validation_authority_check check (
    validation_authority in ('server', 'client')
  ),
  constraint match_events_validation_reference_check check (
    length(btrim(validation_reference)) between 1 and 256
  ),
  constraint match_events_ranked_server_check check (
    category <> 'ranked' or validation_authority = 'server'
  ),
  constraint match_events_local_client_check check (
    category <> 'friendly_local' or validation_authority = 'client'
  )
);

comment on table public.match_events is
  'Historique central et idempotent des parties Brainy Games Hub.';
comment on column public.match_events.participants is
  'Instantané complet déclaré par le jeu. Les associations de profils vérifiées sont normalisées séparément.';

create table public.match_profile_results (
  event_id uuid not null,
  submitted_by uuid not null,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  player_id uuid not null,
  seat smallint not null,
  team_id text,
  outcome text not null,
  score integer not null,
  created_at timestamptz not null default now(),

  constraint match_profile_results_pkey primary key (event_id, profile_id),
  constraint match_profile_results_event_submitter_fkey
    foreign key (event_id, submitted_by)
    references public.match_events(event_id, submitted_by)
    on delete cascade,
  constraint match_profile_results_event_seat_key unique (event_id, seat),
  constraint match_profile_results_event_player_key unique (event_id, player_id),
  constraint match_profile_results_seat_check check (seat >= 1),
  constraint match_profile_results_team_id_check check (
    team_id is null or length(team_id) between 1 and 64
  ),
  constraint match_profile_results_outcome_check check (
    outcome in ('win', 'draw', 'loss')
  ),
  constraint match_profile_results_score_check check (score >= 0)
);

comment on table public.match_profile_results is
  'Lien vérifié entre une partie et un profil Brainy Games Hub.';

create index match_events_submitter_ended_idx
  on public.match_events (submitted_by, ended_at desc);
create index match_events_game_category_ended_idx
  on public.match_events (game_id, category, ended_at desc);
create index match_profile_results_profile_event_idx
  on public.match_profile_results (profile_id, event_id);
create index match_profile_results_profile_outcome_idx
  on public.match_profile_results (profile_id, outcome);

alter table public.match_events enable row level security;
alter table public.match_profile_results enable row level security;

revoke all on table public.match_events from anon, authenticated;
revoke all on table public.match_profile_results from anon, authenticated;
grant select, insert on table public.match_events to authenticated;
grant select, insert on table public.match_profile_results to authenticated;

create policy match_events_select_linked
on public.match_events
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (
    submitted_by = (select auth.uid())
    or exists (
      select 1
      from public.match_profile_results r
      where r.event_id = match_events.event_id
        and r.profile_id = (select auth.uid())
    )
  )
);

create policy match_events_insert_own_friendly_local
on public.match_events
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and submitted_by = (select auth.uid())
  and category = 'friendly_local'
  and validation_authority = 'client'
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
  )
);

create policy match_profile_results_select_own
on public.match_profile_results
for select
to authenticated
using (
  (select auth.uid()) is not null
  and profile_id = (select auth.uid())
);

create policy match_profile_results_insert_own_local
on public.match_profile_results
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and submitted_by = (select auth.uid())
  and profile_id = (select auth.uid())
  and player_id = (select auth.uid())
);


create or replace function public.submit_friendly_local_match(p_event jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_event_id uuid;
  v_started_at timestamptz;
  v_ended_at timestamptz;
  v_participant jsonb;
  v_caller_participant jsonb;
  v_participant_count integer;
  v_caller_count integer := 0;
  v_distinct_seats integer;
  v_distinct_players integer;
  v_draw_count integer;
  v_win_count integer;
  v_loss_count integer;
  v_inserted integer := 0;
  v_existing public.match_events%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'brainy_profile_required' using errcode = '42501';
  end if;

  if jsonb_typeof(p_event) <> 'object'
     or (p_event - array[
       'schema_version', 'event_id', 'game_id', 'match_id', 'category',
       'started_at', 'ended_at', 'format', 'participants', 'finish_reason',
       'validation'
     ]) <> '{}'::jsonb then
    raise exception 'invalid_event_shape';
  end if;

  if p_event->>'schema_version' <> '1.0' then
    raise exception 'unsupported_schema_version';
  end if;

  if coalesce(p_event->>'event_id', '') !~
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then
    raise exception 'invalid_event_id';
  end if;
  v_event_id := (p_event->>'event_id')::uuid;

  if p_event->>'game_id' not in (
    'bingo-reversible', 'elite-pixel-art', 'lucky-21',
    'exit-strategy-3', 'otrio'
  ) then
    raise exception 'unknown_game_id';
  end if;

  if length(btrim(coalesce(p_event->>'match_id', ''))) not between 1 and 128 then
    raise exception 'invalid_match_id';
  end if;

  if p_event->>'category' <> 'friendly_local' then
    raise exception 'client_can_only_submit_friendly_local';
  end if;

  begin
    v_started_at := (p_event->>'started_at')::timestamptz;
    v_ended_at := (p_event->>'ended_at')::timestamptz;
  exception when others then
    raise exception 'invalid_match_dates';
  end;

  if v_ended_at < v_started_at then
    raise exception 'match_ended_before_it_started';
  end if;

  if p_event ? 'format' and p_event->'format' <> 'null'::jsonb then
    if jsonb_typeof(p_event->'format') <> 'object'
       or ((p_event -> 'format') - array['type', 'target_score']) <> '{}'::jsonb
       or p_event#>>'{format,type}' <> 'first_to'
       or coalesce(p_event#>>'{format,target_score}', '') not in ('1', '2', '3') then
      raise exception 'invalid_match_format';
    end if;
  end if;

  if jsonb_typeof(p_event->'participants') <> 'array' then
    raise exception 'participants_must_be_an_array';
  end if;

  v_participant_count := jsonb_array_length(p_event->'participants');
  if v_participant_count not between 2 and 16 then
    raise exception 'invalid_participant_count';
  end if;

  for v_participant in
    select value from jsonb_array_elements(p_event->'participants')
  loop
    if jsonb_typeof(v_participant) <> 'object'
       or (v_participant - array['player_id', 'seat', 'team_id', 'outcome', 'score']) <> '{}'::jsonb
       or not (v_participant ?& array['player_id', 'seat', 'team_id', 'outcome', 'score']) then
      raise exception 'invalid_participant_shape';
    end if;

    if coalesce(v_participant->>'player_id', '') !~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
       or jsonb_typeof(v_participant->'seat') <> 'number'
       or (v_participant->>'seat') !~ '^[1-9][0-9]*$'
       or jsonb_typeof(v_participant->'score') <> 'number'
       or (v_participant->>'score') !~ '^[0-9]+$'
       or v_participant->>'outcome' not in ('win', 'draw', 'loss')
       or (
         v_participant->'team_id' <> 'null'::jsonb
         and (
           jsonb_typeof(v_participant->'team_id') <> 'string'
           or length(v_participant->>'team_id') not between 1 and 64
         )
       ) then
      raise exception 'invalid_participant';
    end if;

    if v_participant->>'player_id' = v_uid::text then
      v_caller_count := v_caller_count + 1;
      v_caller_participant := v_participant;
    end if;
  end loop;

  select count(distinct value->>'seat'),
         count(distinct value->>'player_id'),
         count(*) filter (where value->>'outcome' = 'draw'),
         count(*) filter (where value->>'outcome' = 'win'),
         count(*) filter (where value->>'outcome' = 'loss')
  into v_distinct_seats, v_distinct_players, v_draw_count, v_win_count, v_loss_count
  from jsonb_array_elements(p_event->'participants');

  if v_distinct_seats <> v_participant_count
     or v_distinct_players <> v_participant_count then
    raise exception 'duplicate_participant_or_seat';
  end if;

  if v_caller_count <> 1 then
    raise exception 'current_profile_must_be_a_participant';
  end if;

  if not (
    (v_draw_count = v_participant_count)
    or (v_draw_count = 0 and v_win_count > 0 and v_loss_count > 0)
  ) then
    raise exception 'incoherent_outcomes';
  end if;

  if p_event->>'finish_reason' not in (
    'normal', 'forfeit', 'disconnect', 'timeout'
  ) then
    raise exception 'invalid_finish_reason';
  end if;

  if jsonb_typeof(p_event->'validation') <> 'object'
     or ((p_event -> 'validation') - array['authority', 'reference']) <> '{}'::jsonb
     or p_event#>>'{validation,authority}' <> 'client'
     or length(btrim(coalesce(p_event#>>'{validation,reference}', ''))) not between 1 and 256 then
    raise exception 'invalid_client_validation';
  end if;

  insert into public.match_events (
    event_id, schema_version, game_id, match_id, category,
    started_at, ended_at, format, participants, finish_reason,
    validation_authority, validation_reference, submitted_by
  )
  values (
    v_event_id, '1.0', p_event->>'game_id', p_event->>'match_id',
    'friendly_local', v_started_at, v_ended_at,
    case
      when p_event ? 'format' and p_event->'format' <> 'null'::jsonb
        then p_event->'format'
      else null
    end,
    p_event->'participants', p_event->>'finish_reason', 'client',
    p_event#>>'{validation,reference}', v_uid
  )
  on conflict (event_id) do nothing;

  get diagnostics v_inserted = row_count;

  select *
  into v_existing
  from public.match_events e
  where e.event_id = v_event_id;

  if not found
     or v_existing.submitted_by <> v_uid
     or v_existing.game_id <> p_event->>'game_id'
     or v_existing.match_id <> p_event->>'match_id'
     or v_existing.category <> 'friendly_local'
     or v_existing.started_at <> v_started_at
     or v_existing.ended_at <> v_ended_at
     or v_existing.participants <> p_event->'participants' then
    raise exception 'event_id_already_used';
  end if;

  insert into public.match_profile_results (
    event_id, submitted_by, profile_id, player_id, seat,
    team_id, outcome, score
  )
  values (
    v_event_id, v_uid, v_uid,
    (v_caller_participant->>'player_id')::uuid,
    (v_caller_participant->>'seat')::smallint,
    case
      when v_caller_participant->'team_id' = 'null'::jsonb then null
      else v_caller_participant->>'team_id'
    end,
    v_caller_participant->>'outcome',
    (v_caller_participant->>'score')::integer
  )
  on conflict (event_id, profile_id) do nothing;

  return jsonb_build_object(
    'event_id', v_event_id,
    'synced', true,
    'already_present', v_inserted = 0
  );
end;
$$;

revoke all on function public.submit_friendly_local_match(jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_friendly_local_match(jsonb)
  to authenticated;

create index match_profile_results_event_submitter_idx
  on public.match_profile_results (event_id, submitted_by);
