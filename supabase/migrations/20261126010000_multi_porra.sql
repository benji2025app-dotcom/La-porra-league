-- LA PORRA LEAGUE · Varias porras (Amigos, Familia, Hotel) y escudos de equipos
-- · Cada porra tiene dos clubes, sus jugadores, jornadas, códigos y bote.
-- · Un usuario puede estar en varias porras; solo ve las suyas. El admin global ve todas.
-- · El precio del boleto sigue siendo el de la temporada (igual en todas).
-- · La porra existente pasa a ser "Amigos" (jornadas, pronósticos y códigos incluidos).

select set_config('porra.internal', 'on', true);

-- 1. Equipos ----------------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  short_name text check (short_name is null or char_length(short_name) between 2 and 14),
  crest_url text check (crest_url is null or crest_url ~ '^https://[^\s]+$'),
  created_at timestamptz not null default now()
);
create unique index teams_name_lower_key on public.teams (lower(btrim(name)));

insert into public.teams (name, short_name, crest_url) values
  ('FC Barcelona', 'Barça', null),
  ('Real Madrid', 'Madrid', 'https://r2.thesportsdb.com/images/media/team/badge/vwvwrw1473502969.png'),
  ('Sevilla FC', 'Sevilla', null),
  ('Real Betis', 'Betis', 'https://r2.thesportsdb.com/images/media/team/badge/2oqulv1663245386.png');

-- 2. Porras -----------------------------------------------------------------------------
create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  club_a_id uuid not null references public.teams (id) on delete restrict,
  club_b_id uuid not null references public.teams (id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (club_a_id <> club_b_id)
);
create unique index leagues_name_lower_key on public.leagues (lower(btrim(name)));
create index leagues_club_a_idx on public.leagues (club_a_id);
create index leagues_club_b_idx on public.leagues (club_b_id);

insert into public.leagues (name, club_a_id, club_b_id)
select v.name, a.id, b.id
from (values ('Amigos', 'FC Barcelona', 'Real Madrid'),
             ('Familia', 'FC Barcelona', 'Real Madrid'),
             ('Hotel', 'Sevilla FC', 'Real Betis')) as v(name, a_name, b_name)
join public.teams a on a.name = v.a_name
join public.teams b on b.name = v.b_name;

-- 3. Membresías ---------------------------------------------------------------------------
create table public.league_members (
  league_id uuid not null references public.leagues (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.member_status not null default 'pending',
  invite_code text,
  joined_at timestamptz not null default now(),
  approved_at timestamptz,
  primary key (league_id, user_id)
);
create index league_members_user_idx on public.league_members (user_id);

-- Quien ya estaba en la porra (con código, activo o admin) pasa a Amigos con su mismo estado.
insert into public.league_members (league_id, user_id, status, invite_code, joined_at, approved_at)
select l.id, p.id, p.status, p.invite_code, p.created_at, p.approved_at
from public.profiles p cross join public.leagues l
where l.name = 'Amigos' and (p.invite_code is not null or p.status = 'active' or p.role = 'admin');

-- El admin juega también en Familia y Hotel (puede salirse desde el panel).
insert into public.league_members (league_id, user_id, status, joined_at, approved_at)
select l.id, p.id, 'active', now(), now()
from public.profiles p cross join public.leagues l
where p.role = 'admin' and l.name in ('Familia', 'Hotel')
on conflict do nothing;

-- profiles.status pasa a ser el estado global de la cuenta (activa o bloqueada).
update public.profiles set status = 'active' where status = 'pending';
alter table public.profiles alter column status set default 'active';

-- 4. Códigos por porra ----------------------------------------------------------------------
alter table public.invite_codes add column league_id uuid references public.leagues (id) on delete restrict;
update public.invite_codes set league_id = (select id from public.leagues where name = 'Amigos');
update public.invite_codes set is_active = false where note = 'Código fundador (admin)';
alter table public.invite_codes alter column league_id set not null;
create index invite_codes_league_idx on public.invite_codes (league_id);

-- 5. Jornadas por porra ----------------------------------------------------------------------
alter table public.rounds add column league_id uuid references public.leagues (id) on delete restrict;
update public.rounds set league_id = (select id from public.leagues where name = 'Amigos');
alter table public.rounds alter column league_id set not null;
alter table public.rounds drop constraint rounds_season_id_number_key;
alter table public.rounds add constraint rounds_league_season_number_key unique (league_id, season_id, number);
create index rounds_season_idx on public.rounds (season_id);

-- 6. Partidos con equipos y escudos ------------------------------------------------------------
alter table public.fixtures
  add column club_team_id uuid references public.teams (id) on delete restrict,
  add column home_team_id uuid references public.teams (id) on delete restrict,
  add column away_team_id uuid references public.teams (id) on delete restrict;

update public.fixtures f
   set club_team_id = (select t.id from public.teams t
                        where t.name = case f.club when 'barcelona' then 'FC Barcelona' else 'Real Madrid' end);

insert into public.teams (name)
select distinct btrim(n) from (select home_team as n from public.fixtures union select away_team from public.fixtures) s
where not exists (select 1 from public.teams t where lower(btrim(t.name)) = lower(btrim(s.n)));

update public.fixtures f set home_team_id = t.id from public.teams t where lower(btrim(t.name)) = lower(btrim(f.home_team));
update public.fixtures f set away_team_id = t.id from public.teams t where lower(btrim(t.name)) = lower(btrim(f.away_team));

alter table public.fixtures alter column club_team_id set not null;
alter table public.fixtures drop constraint fixtures_round_id_club_key;
alter table public.fixtures drop column club;
drop type public.club_key;
alter table public.fixtures add constraint fixtures_round_club_key unique (round_id, club_team_id);
create index fixtures_club_team_idx on public.fixtures (club_team_id);
create index fixtures_home_team_idx on public.fixtures (home_team_id);
create index fixtures_away_team_idx on public.fixtures (away_team_id);

-- 7. Bote por porra ------------------------------------------------------------------------------
alter table public.pot_movements add column league_id uuid references public.leagues (id) on delete restrict;
update public.pot_movements m
   set league_id = coalesce((select r.league_id from public.rounds r where r.id = m.round_id),
                            (select id from public.leagues where name = 'Amigos'));
alter table public.pot_movements alter column league_id set not null;
create index pot_movements_league_idx on public.pot_movements (league_id);

-- 8. Funciones auxiliares de acceso por porra ----------------------------------------------------
create or replace function private.is_league_player(p_league uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.league_members m join public.profiles p on p.id = m.user_id
    where m.league_id = p_league and m.user_id = (select auth.uid())
      and m.status = 'active' and p.status = 'active'
  );
$$;

create or replace function private.can_view_league(p_league uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin() or private.is_league_player(p_league);
$$;

create or replace function private.my_league_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select l.id from public.leagues l where private.is_admin()
  union
  select m.league_id from public.league_members m join public.profiles p on p.id = m.user_id
  where m.user_id = (select auth.uid()) and m.status = 'active' and p.status = 'active';
$$;

create or replace function private.has_membership(p_league uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.league_members m where m.league_id = p_league and m.user_id = (select auth.uid()));
$$;

create or replace function private.shares_league(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.league_members a join public.league_members b on b.league_id = a.league_id
    where a.user_id = (select auth.uid()) and a.status = 'active' and b.user_id = p_user
  );
$$;

create or replace function private.fixture_league(p_fixture uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select r.league_id from public.fixtures f join public.rounds r on r.id = f.round_id where f.id = p_fixture;
$$;

-- Pronósticos ajenos: partido empezado y quien mira es de esa porra (o admin).
create or replace function private.can_see_fixture_predictions(p_fixture uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.fixture_locked(p_fixture) and private.can_view_league(private.fixture_league(p_fixture));
$$;

-- Compatibilidad: miembro activo de alguna porra.
create or replace function private.is_active_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin() or exists (
    select 1 from public.league_members m join public.profiles p on p.id = m.user_id
    where m.user_id = (select auth.uid()) and m.status = 'active' and p.status = 'active'
  );
$$;

create or replace function private.pot_balance(p_league uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum(amount_cents), 0)::bigint from public.pot_movements where league_id = p_league;
$$;

-- 9. Integridad de partidos con clubes de la porra --------------------------------------------------
create or replace function private.fixtures_club_check()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.rounds r join public.leagues l on l.id = r.league_id
    where r.id = new.round_id and new.club_team_id in (l.club_a_id, l.club_b_id)
  ) then
    raise exception 'CLUB_NOT_IN_LEAGUE: ese club no pertenece a esta porra';
  end if;
  if new.home_team_id is not null and new.away_team_id is not null
     and new.club_team_id not in (new.home_team_id, new.away_team_id) then
    raise exception 'CLUB_NOT_PLAYING: el club de la porra debe jugar el partido';
  end if;
  return new;
end;
$$;

create trigger fixtures_club_check before insert or update on public.fixtures
for each row execute function private.fixtures_club_check();

create or replace function private.fixtures_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_round_status public.round_status;
  v_was_locked boolean;
  v_has_predictions boolean;
begin
  if tg_op = 'DELETE' then
    select status into v_round_status from public.rounds where id = old.round_id;
    if v_round_status <> 'draft' and not private.is_internal() then
      raise exception 'ROUND_NOT_DRAFT: solo se borran partidos de jornadas en borrador';
    end if;
    return old;
  end if;

  select status into v_round_status from public.rounds where id = new.round_id;
  if v_round_status in ('settled', 'void') and not private.is_internal() then
    raise exception 'ROUND_CLOSED: la jornada ya está cerrada';
  end if;

  if tg_op = 'INSERT' then
    if new.kickoff_at <= now() then
      raise exception 'KICKOFF_IN_PAST: la hora de inicio debe ser futura';
    end if;
    new.status := 'scheduled';
    new.home_goals := null;
    new.away_goals := null;
    new.locked_at := null;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  new.id := old.id;
  new.created_at := old.created_at;
  new.updated_at := now();
  v_was_locked := old.locked_at is not null or old.kickoff_at <= now() or old.status in ('live', 'finished');
  select exists (select 1 from public.predictions where fixture_id = old.id) into v_has_predictions;

  if (new.round_id <> old.round_id or new.club_team_id <> old.club_team_id) and (v_has_predictions or v_was_locked) then
    raise exception 'FIXTURE_HAS_PREDICTIONS: no se puede mover un partido con pronósticos';
  end if;

  if v_was_locked then
    new.locked_at := coalesce(old.locked_at, least(old.kickoff_at, now()));
    if new.home_team <> old.home_team or new.away_team <> old.away_team or new.competition <> old.competition then
      raise exception 'FIXTURE_LOCKED: el partido ya ha empezado';
    end if;
  else
    if (new.home_team <> old.home_team or new.away_team <> old.away_team)
       and v_has_predictions and not private.is_internal() then
      raise exception 'USE_REPLACE_FIXTURE: para cambiar el partido usa "sustituir partido"';
    end if;
    if new.status in ('live', 'finished') or new.kickoff_at <= now() then
      new.locked_at := now();
    else
      new.locked_at := null;
    end if;
  end if;

  if new.home_goals is not null and new.locked_at is null then
    raise exception 'RESULT_BEFORE_KICKOFF: el partido aún no ha empezado';
  end if;

  return new;
end;
$$;

-- 10. Alta de usuarios y códigos por porra --------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(btrim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
  v_name text := btrim(coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    ''));
  v_provider text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  v_league uuid;
begin
  if char_length(v_name) < 2 then
    v_name := split_part(coalesce(new.email, ''), '@', 1);
  end if;
  v_name := left(v_name, 30);
  if char_length(v_name) < 2 then
    v_name := 'Jugador';
  end if;

  perform pg_advisory_xact_lock(hashtext('porra_bootstrap'));
  if not exists (select 1 from public.profiles) then
    insert into public.profiles (id, display_name, role, status, approved_at)
    values (new.id, v_name, 'admin', 'active', now());
    return new;
  end if;

  if v_provider <> 'email' and v_code = '' then
    insert into public.profiles (id, display_name) values (new.id, v_name);
    return new;
  end if;

  update public.invite_codes
     set used_count = used_count + 1
   where code = v_code and is_active
     and (expires_at is null or expires_at > now())
     and (max_uses is null or used_count < max_uses)
  returning league_id into v_league;

  if v_league is null then
    raise exception 'INVALID_INVITE_CODE' using hint = 'Código de invitación no válido o caducado';
  end if;

  insert into public.profiles (id, display_name, invite_code) values (new.id, v_name, v_code);
  insert into public.league_members (league_id, user_id, invite_code) values (v_league, new.id, v_code);
  return new;
end;
$$;

drop function public.redeem_invite_code(text);
create function public.redeem_invite_code(p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_league public.leagues;
  v_ok boolean;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  select l.* into v_league from public.invite_codes c join public.leagues l on l.id = c.league_id
   where c.code = v_code and c.is_active and l.is_active
     and (c.expires_at is null or c.expires_at > now())
     and (c.max_uses is null or c.used_count < c.max_uses);
  if not found then
    raise exception 'INVALID_INVITE_CODE';
  end if;
  if exists (select 1 from public.league_members where league_id = v_league.id and user_id = v_uid) then
    return v_league.name;
  end if;

  update public.invite_codes set used_count = used_count + 1
   where code = v_code and (max_uses is null or used_count < max_uses)
  returning true into v_ok;
  if not coalesce(v_ok, false) then
    raise exception 'INVALID_INVITE_CODE';
  end if;

  insert into public.league_members (league_id, user_id, invite_code) values (v_league.id, v_uid, v_code);
  update public.profiles set invite_code = coalesce(invite_code, v_code) where id = v_uid;
  return v_league.name;
end;
$$;

drop function public.admin_create_invite_code(text, integer, timestamptz);
create function public.admin_create_invite_code(
  p_league_id uuid, p_note text default null, p_max_uses integer default null, p_expires_at timestamptz default null
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_code text := 'PORRA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
begin
  perform private.assert_admin();
  insert into public.invite_codes (code, note, max_uses, expires_at, created_by, league_id)
  values (v_code, nullif(btrim(p_note), ''), p_max_uses, p_expires_at, auth.uid(), p_league_id);
  return v_code;
end;
$$;

-- 11. Jugadores ------------------------------------------------------------------------------------
drop function public.admin_list_members();
create function public.admin_list_members(p_league_id uuid default null)
returns table (
  league_id uuid, league_name text, user_id uuid, display_name text, email text,
  role public.app_role, member_status public.member_status, account_status public.member_status,
  invite_code text, joined_at timestamptz, approved_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return query
    select m.league_id, l.name, p.id, p.display_name, u.email::text, p.role, m.status, p.status,
           m.invite_code, m.joined_at, m.approved_at
      from public.league_members m
      join public.leagues l on l.id = m.league_id
      join public.profiles p on p.id = m.user_id
      join auth.users u on u.id = p.id
     where p_league_id is null or m.league_id = p_league_id
     order by (m.status = 'pending') desc, m.joined_at;
end;
$$;

drop function public.admin_set_member_status(uuid, public.member_status);
create function public.admin_set_membership(p_league_id uuid, p_user_id uuid, p_status public.member_status)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  insert into public.league_members (league_id, user_id, status, approved_at)
  values (p_league_id, p_user_id, p_status, case when p_status = 'active' then now() end)
  on conflict (league_id, user_id) do update
    set status = excluded.status,
        approved_at = case when excluded.status = 'active' then coalesce(public.league_members.approved_at, now())
                           else public.league_members.approved_at end;
end;
$$;

create function public.admin_set_account_status(p_user_id uuid, p_status public.member_status)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_CHANGE_OWN_STATUS';
  end if;
  if p_status = 'pending' then
    raise exception 'INVALID_STATUS';
  end if;
  update public.profiles set status = p_status where id = p_user_id;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

-- 12. Pronósticos y consultas por porra ----------------------------------------------------------------
create or replace function public.submit_prediction(p_fixture_id uuid, p_home_goals integer, p_away_goals integer)
returns public.predictions language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_fixture public.fixtures;
  v_round public.rounds;
  v_existing public.predictions;
  v_result public.predictions;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if p_home_goals is null or p_away_goals is null
     or p_home_goals not between 0 and 20 or p_away_goals not between 0 and 20 then
    raise exception 'INVALID_SCORE' using errcode = '22023';
  end if;

  select * into v_fixture from public.fixtures where id = p_fixture_id for share;
  if not found then
    raise exception 'FIXTURE_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into v_round from public.rounds where id = v_fixture.round_id;
  if not private.is_league_player(v_round.league_id) then
    raise exception 'NOT_LEAGUE_MEMBER' using errcode = '42501';
  end if;
  if v_round.status <> 'open' then
    raise exception 'ROUND_NOT_OPEN';
  end if;
  if v_fixture.locked_at is not null or v_fixture.kickoff_at <= clock_timestamp() or v_fixture.status <> 'scheduled' then
    raise exception 'PREDICTION_LOCKED';
  end if;

  select * into v_existing from public.predictions where fixture_id = p_fixture_id and user_id = v_uid for update;
  if found then
    if v_existing.home_goals = p_home_goals and v_existing.away_goals = p_away_goals then
      return v_existing;
    end if;
    update public.predictions set home_goals = p_home_goals, away_goals = p_away_goals
     where id = v_existing.id returning * into v_result;
    insert into public.prediction_log (fixture_id, user_id, action, home_goals, away_goals)
    values (p_fixture_id, v_uid, 'update', p_home_goals, p_away_goals);
  else
    insert into public.predictions (fixture_id, user_id, home_goals, away_goals)
    values (p_fixture_id, v_uid, p_home_goals, p_away_goals) returning * into v_result;
    insert into public.prediction_log (fixture_id, user_id, action, home_goals, away_goals)
    values (p_fixture_id, v_uid, 'create', p_home_goals, p_away_goals);
  end if;
  return v_result;
end;
$$;

create or replace function public.get_round_submissions(p_round_id uuid)
returns table (user_id uuid, display_name text, submitted_count integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_league uuid := (select league_id from public.rounds where id = p_round_id);
begin
  if v_league is null or not private.can_view_league(v_league) then
    raise exception 'NOT_LEAGUE_MEMBER' using errcode = '42501';
  end if;
  return query
    select pr.id, pr.display_name,
           (select count(*)::integer from public.predictions p
              join public.fixtures f on f.id = p.fixture_id
             where f.round_id = p_round_id and p.user_id = pr.id)
      from public.league_members m join public.profiles pr on pr.id = m.user_id
     where m.league_id = v_league and m.status = 'active' and pr.status = 'active'
     order by pr.display_name;
end;
$$;

create or replace function public.get_round_pot(p_round_id uuid)
returns table (pot_before_cents bigint, participants_count integer, contribution_cents bigint, pot_in_play_cents bigint, is_closed boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_round public.rounds;
  v_s public.round_settlements;
  v_contrib integer;
  v_n integer;
  v_balance bigint;
begin
  select * into v_round from public.rounds where id = p_round_id;
  if not found or not private.can_view_league(v_round.league_id) then
    raise exception 'NOT_LEAGUE_MEMBER' using errcode = '42501';
  end if;

  select * into v_s from public.round_settlements where round_id = p_round_id;
  if found then
    return query select v_s.pot_before_cents, v_s.participants_count, v_s.contribution_total_cents, v_s.pot_in_play_cents, true;
    return;
  end if;

  select s.pot_contribution_cents into v_contrib from public.seasons s where s.id = v_round.season_id;
  select count(*)::integer into v_n from (
    select p.user_id from public.predictions p join public.fixtures f on f.id = p.fixture_id
     where f.round_id = p_round_id group by p.user_id having count(*) = 2
  ) t;
  v_balance := private.pot_balance(v_round.league_id);
  return query select v_balance, v_n, (v_n * coalesce(v_contrib, 0))::bigint, (v_balance + v_n * coalesce(v_contrib, 0))::bigint, false;
end;
$$;

drop function public.get_pot_balance();
create function public.get_pot_balance(p_league_id uuid)
returns bigint language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_view_league(p_league_id) then
    raise exception 'NOT_LEAGUE_MEMBER' using errcode = '42501';
  end if;
  return private.pot_balance(p_league_id);
end;
$$;

drop function public.get_leaderboard(uuid);
create function public.get_leaderboard(p_league_id uuid, p_season_id uuid default null)
returns table (user_id uuid, display_name text, rounds_played integer, wins integer, total_won_cents bigint, exact_hits integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_season uuid;
begin
  if not private.can_view_league(p_league_id) then
    raise exception 'NOT_LEAGUE_MEMBER' using errcode = '42501';
  end if;
  v_season := coalesce(p_season_id, (select id from public.seasons where is_active limit 1));

  return query
  with closed as (
    select r.id, r.status from public.rounds r
     where r.league_id = p_league_id and r.season_id = v_season and r.status in ('settled', 'void')
  ),
  tickets as (
    select p.user_id, f.round_id, count(*) as n
      from public.predictions p join public.fixtures f on f.id = p.fixture_id
     where f.round_id in (select id from closed)
     group by p.user_id, f.round_id
  ),
  played as (select t.user_id, count(*) filter (where t.n = 2) as c from tickets t group by t.user_id),
  hits as (
    select p.user_id, count(*) as c
      from public.predictions p join public.fixtures f on f.id = p.fixture_id
     where f.round_id in (select id from closed where status = 'settled')
       and f.status = 'finished' and p.home_goals = f.home_goals and p.away_goals = f.away_goals
     group by p.user_id
  ),
  won as (
    select w.user_id, count(*) as c, sum(w.share_cents) as cents
      from public.round_winners w where w.round_id in (select id from closed)
     group by w.user_id
  )
  select pr.id, pr.display_name, coalesce(pl.c, 0)::integer, coalesce(wo.c, 0)::integer,
         coalesce(wo.cents, 0)::bigint, coalesce(h.c, 0)::integer
    from public.profiles pr
    left join public.league_members m on m.user_id = pr.id and m.league_id = p_league_id
    left join played pl on pl.user_id = pr.id
    left join won wo on wo.user_id = pr.id
    left join hits h on h.user_id = pr.id
   where m.status = 'active' or pl.user_id is not null
   order by 4 desc, 5 desc, 6 desc, 2 asc;
end;
$$;

-- 13. Cierre de jornada, reapertura, sustitución y ajustes por porra ------------------------------------
create or replace function private.close_round(p_round_id uuid, p_void boolean, p_reason text)
returns public.round_settlements language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
  v_season public.seasons;
  v_fx integer;
  v_unfinished integer;
  v_participants integer;
  v_contrib bigint;
  v_fee bigint;
  v_before bigint;
  v_in_play bigint;
  v_winners integer := 0;
  v_share bigint := 0;
  v_res public.round_settlements;
begin
  perform private.assert_admin();
  perform set_config('porra.internal', 'on', true);

  select * into v_round from public.rounds where id = p_round_id for update;
  if not found then
    raise exception 'ROUND_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtext('porra_pot_' || v_round.league_id::text));
  if v_round.status <> 'open' then
    raise exception 'ROUND_NOT_OPEN: solo se cierran jornadas abiertas';
  end if;
  select * into v_season from public.seasons where id = v_round.season_id;

  if not p_void then
    select count(*), count(*) filter (where f.status <> 'finished' or f.home_goals is null)
      into v_fx, v_unfinished from public.fixtures f where f.round_id = p_round_id;
    if v_fx <> 2 then
      raise exception 'ROUND_NEEDS_TWO_FIXTURES';
    end if;
    if v_unfinished > 0 then
      raise exception 'FIXTURES_NOT_FINISHED: faltan resultados';
    end if;
  elsif char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'VOID_REASON_REQUIRED';
  end if;

  select count(*)::integer into v_participants from (
    select p.user_id from public.predictions p join public.fixtures f on f.id = p.fixture_id
     where f.round_id = p_round_id group by p.user_id having count(*) = 2
  ) t;

  v_contrib := v_participants::bigint * v_season.pot_contribution_cents;
  v_fee := v_participants::bigint * (v_season.entry_fee_cents - v_season.pot_contribution_cents);
  v_before := private.pot_balance(v_round.league_id);

  if v_contrib > 0 then
    insert into public.pot_movements (league_id, round_id, kind, amount_cents, note, created_by)
    values (v_round.league_id, p_round_id, 'contribution', v_contrib,
            format('%s boletos × %s cént.', v_participants, v_season.pot_contribution_cents), auth.uid());
  end if;
  v_in_play := v_before + v_contrib;

  if not p_void then
    insert into public.round_winners (round_id, user_id, share_cents)
    select p_round_id, p.user_id, 0
      from public.predictions p join public.fixtures f on f.id = p.fixture_id
     where f.round_id = p_round_id and p.home_goals = f.home_goals and p.away_goals = f.away_goals
     group by p.user_id having count(*) = 2;
    get diagnostics v_winners = row_count;

    if v_winners > 0 then
      v_share := v_in_play / v_winners;
      update public.round_winners set share_cents = v_share where round_id = p_round_id;
      if v_share > 0 then
        insert into public.pot_movements (league_id, round_id, kind, amount_cents, user_id, note, created_by)
        select v_round.league_id, p_round_id, 'payout', -v_share, w.user_id, 'Premio de la jornada', auth.uid()
          from public.round_winners w where w.round_id = p_round_id;
      end if;
    end if;
  end if;

  update public.rounds set status = case when p_void then 'void' else 'settled' end::public.round_status where id = p_round_id;

  insert into public.round_settlements (
    round_id, kind, participants_count, entry_fee_cents, pot_contribution_cents,
    contribution_total_cents, admin_fee_total_cents, pot_before_cents, pot_in_play_cents,
    winners_count, share_cents, pot_after_cents, reason, settled_by
  ) values (
    p_round_id, case when p_void then 'void' else 'settled' end::public.settlement_kind,
    v_participants, v_season.entry_fee_cents, v_season.pot_contribution_cents,
    v_contrib, v_fee, v_before, v_in_play, v_winners, v_share, v_in_play - v_share * v_winners,
    nullif(btrim(coalesce(p_reason, '')), ''), auth.uid()
  ) returning * into v_res;

  perform set_config('porra.internal', 'off', true);
  return v_res;
end;
$$;

create or replace function public.admin_reopen_round(p_round_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_s public.round_settlements;
  v_league uuid;
begin
  perform private.assert_admin();
  perform set_config('porra.internal', 'on', true);
  select league_id into v_league from public.rounds where id = p_round_id;
  perform pg_advisory_xact_lock(hashtext('porra_pot_' || coalesce(v_league::text, '')));

  select * into v_s from public.round_settlements where round_id = p_round_id for update;
  if not found then
    raise exception 'ROUND_NOT_CLOSED';
  end if;
  if exists (
    select 1 from public.round_settlements s join public.rounds r on r.id = s.round_id
    where r.league_id = v_league and s.settled_at > v_s.settled_at
  ) then
    raise exception 'ONLY_LATEST_ROUND: solo se puede reabrir la última jornada cerrada';
  end if;

  delete from public.pot_movements where round_id = p_round_id;
  delete from public.round_winners where round_id = p_round_id;
  delete from public.round_settlements where round_id = p_round_id;
  update public.rounds set status = 'open' where id = p_round_id;
  perform set_config('porra.internal', 'off', true);
end;
$$;

drop function public.admin_replace_fixture(uuid, text, text, text, timestamptz);
create function public.admin_replace_fixture(
  p_fixture_id uuid, p_competition text, p_home_team text, p_away_team text, p_kickoff_at timestamptz,
  p_home_team_id uuid default null, p_away_team_id uuid default null
)
returns public.fixtures language plpgsql security definer set search_path = '' as $$
declare
  v_f public.fixtures;
begin
  perform private.assert_admin();
  perform set_config('porra.internal', 'on', true);

  select * into v_f from public.fixtures where id = p_fixture_id for update;
  if not found then
    raise exception 'FIXTURE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_f.locked_at is not null or v_f.kickoff_at <= now() or v_f.status in ('live', 'finished') then
    raise exception 'FIXTURE_LOCKED: no se puede sustituir un partido ya empezado';
  end if;
  if exists (select 1 from public.rounds where id = v_f.round_id and status in ('settled', 'void')) then
    raise exception 'ROUND_CLOSED';
  end if;
  if p_kickoff_at <= now() then
    raise exception 'KICKOFF_IN_PAST';
  end if;

  insert into public.prediction_log (fixture_id, user_id, action, home_goals, away_goals)
  select p.fixture_id, p.user_id, 'reset', p.home_goals, p.away_goals from public.predictions p where p.fixture_id = p_fixture_id;
  delete from public.predictions where fixture_id = p_fixture_id;

  update public.fixtures
     set competition = btrim(p_competition), home_team = btrim(p_home_team), away_team = btrim(p_away_team),
         home_team_id = p_home_team_id, away_team_id = p_away_team_id,
         kickoff_at = p_kickoff_at, status = 'scheduled', home_goals = null, away_goals = null
   where id = p_fixture_id
  returning * into v_f;
  perform set_config('porra.internal', 'off', true);
  return v_f;
end;
$$;

drop function public.admin_adjust_pot(bigint, text);
create function public.admin_adjust_pot(p_league_id uuid, p_amount_cents bigint, p_note text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_balance bigint;
begin
  perform private.assert_admin();
  perform set_config('porra.internal', 'on', true);
  perform pg_advisory_xact_lock(hashtext('porra_pot_' || p_league_id::text));
  if p_amount_cents is null or p_amount_cents = 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'NOTE_REQUIRED';
  end if;
  if not exists (select 1 from public.leagues where id = p_league_id) then
    raise exception 'LEAGUE_NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.pot_movements (league_id, kind, amount_cents, note, created_by)
  values (p_league_id, 'adjustment', p_amount_cents, btrim(p_note), auth.uid());
  v_balance := private.pot_balance(p_league_id);
  if v_balance < 0 then
    raise exception 'POT_NEGATIVE';
  end if;
  perform set_config('porra.internal', 'off', true);
  return v_balance;
end;
$$;

drop function private.pot_balance();

-- 14. RLS -----------------------------------------------------------------------------------------------
alter table public.teams enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;

revoke all on public.teams, public.leagues, public.league_members from anon, authenticated;
grant select on public.teams, public.leagues, public.league_members to authenticated;
grant insert, update on public.teams, public.leagues to authenticated;

create policy teams_select on public.teams for select to authenticated using (true);
create policy teams_admin_insert on public.teams for insert to authenticated with check ((select private.is_admin()));
create policy teams_admin_update on public.teams for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy leagues_select on public.leagues for select to authenticated
  using ((select private.is_admin()) or private.has_membership(id));
create policy leagues_admin_insert on public.leagues for insert to authenticated with check ((select private.is_admin()));
create policy leagues_admin_update on public.leagues for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy league_members_select on public.league_members for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()) or private.shares_league(id));

drop policy seasons_select on public.seasons;
create policy seasons_select on public.seasons for select to authenticated using (true);

drop policy rounds_select on public.rounds;
create policy rounds_select on public.rounds for select to authenticated
  using (league_id in (select private.my_league_ids()) and (status <> 'draft' or (select private.is_admin())));

drop policy fixtures_select on public.fixtures;
create policy fixtures_select on public.fixtures for select to authenticated
  using (exists (select 1 from public.rounds r where r.id = round_id));

drop policy predictions_select on public.predictions;
create policy predictions_select on public.predictions for select to authenticated
  using (user_id = (select auth.uid()) or private.can_see_fixture_predictions(fixture_id));

drop policy prediction_log_select on public.prediction_log;
create policy prediction_log_select on public.prediction_log for select to authenticated
  using (user_id = (select auth.uid()) or private.can_see_fixture_predictions(fixture_id));

drop policy pot_movements_select on public.pot_movements;
create policy pot_movements_select on public.pot_movements for select to authenticated
  using (league_id in (select private.my_league_ids()));

drop policy round_winners_select on public.round_winners;
create policy round_winners_select on public.round_winners for select to authenticated
  using (exists (select 1 from public.rounds r where r.id = round_id));

drop policy round_settlements_select on public.round_settlements;
create policy round_settlements_select on public.round_settlements for select to authenticated
  using (exists (select 1 from public.rounds r where r.id = round_id));

-- 15. Permisos de funciones ----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin(), private.is_active_member(), private.fixture_locked(uuid),
  private.is_league_player(uuid), private.can_view_league(uuid), private.my_league_ids(), private.has_membership(uuid),
  private.shares_league(uuid), private.fixture_league(uuid), private.can_see_fixture_predictions(uuid) to authenticated;

grant execute on function public.check_invite_code(text) to anon, authenticated;
grant execute on function public.update_my_display_name(text) to authenticated;
grant execute on function public.redeem_invite_code(text) to authenticated;
grant execute on function public.submit_prediction(uuid, integer, integer) to authenticated;
grant execute on function public.get_round_submissions(uuid) to authenticated;
grant execute on function public.get_round_pot(uuid) to authenticated;
grant execute on function public.get_pot_balance(uuid) to authenticated;
grant execute on function public.get_leaderboard(uuid, uuid) to authenticated;
grant execute on function public.admin_list_members(uuid) to authenticated;
grant execute on function public.admin_set_membership(uuid, uuid, public.member_status) to authenticated;
grant execute on function public.admin_set_account_status(uuid, public.member_status) to authenticated;
grant execute on function public.admin_set_member_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_create_invite_code(uuid, text, integer, timestamptz) to authenticated;
grant execute on function public.admin_set_invite_code_active(text, boolean) to authenticated;
grant execute on function public.admin_settle_round(uuid) to authenticated;
grant execute on function public.admin_void_round(uuid, text) to authenticated;
grant execute on function public.admin_reopen_round(uuid) to authenticated;
grant execute on function public.admin_replace_fixture(uuid, text, text, text, timestamptz, uuid, uuid) to authenticated;
grant execute on function public.admin_adjust_pot(uuid, bigint, text) to authenticated;

select set_config('porra.internal', 'off', true);
