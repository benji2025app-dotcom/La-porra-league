-- LA PORRA LEAGUE · 003 · Funciones públicas (RPC)

-- Registro ------------------------------------------------------------------------
create or replace function public.check_invite_code(p_code text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.invite_codes c
    where c.code = upper(btrim(coalesce(p_code, '')))
      and c.is_active
      and (c.expires_at is null or c.expires_at > now())
      and (c.max_uses is null or c.used_count < c.max_uses)
  );
$$;

create or replace function public.update_my_display_name(p_display_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if char_length(v_name) not between 2 and 30 then
    raise exception 'INVALID_DISPLAY_NAME' using errcode = '22023';
  end if;
  update public.profiles set display_name = v_name where id = auth.uid();
end;
$$;

-- Pronósticos ---------------------------------------------------------------------
create or replace function public.submit_prediction(p_fixture_id uuid, p_home_goals integer, p_away_goals integer)
returns public.predictions language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_fixture public.fixtures;
  v_round_status public.round_status;
  v_existing public.predictions;
  v_result public.predictions;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if not private.is_active_member() then
    raise exception 'NOT_ACTIVE_MEMBER' using errcode = '42501';
  end if;
  if p_home_goals is null or p_away_goals is null
     or p_home_goals not between 0 and 20 or p_away_goals not between 0 and 20 then
    raise exception 'INVALID_SCORE' using errcode = '22023';
  end if;

  select * into v_fixture from public.fixtures where id = p_fixture_id for share;
  if not found then
    raise exception 'FIXTURE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select status into v_round_status from public.rounds where id = v_fixture.round_id;
  if v_round_status <> 'open' then
    raise exception 'ROUND_NOT_OPEN';
  end if;

  -- Hora del servidor, nunca la del cliente.
  if v_fixture.locked_at is not null or v_fixture.kickoff_at <= clock_timestamp()
     or v_fixture.status <> 'scheduled' then
    raise exception 'PREDICTION_LOCKED';
  end if;

  select * into v_existing from public.predictions
  where fixture_id = p_fixture_id and user_id = v_uid for update;

  if found then
    if v_existing.home_goals = p_home_goals and v_existing.away_goals = p_away_goals then
      return v_existing;
    end if;
    update public.predictions
       set home_goals = p_home_goals, away_goals = p_away_goals
     where id = v_existing.id
    returning * into v_result;
    insert into public.prediction_log (fixture_id, user_id, action, home_goals, away_goals)
    values (p_fixture_id, v_uid, 'update', p_home_goals, p_away_goals);
  else
    insert into public.predictions (fixture_id, user_id, home_goals, away_goals)
    values (p_fixture_id, v_uid, p_home_goals, p_away_goals)
    returning * into v_result;
    insert into public.prediction_log (fixture_id, user_id, action, home_goals, away_goals)
    values (p_fixture_id, v_uid, 'create', p_home_goals, p_away_goals);
  end if;

  return v_result;
end;
$$;

-- Quién ha enviado su boleto (sin revelar marcadores).
create or replace function public.get_round_submissions(p_round_id uuid)
returns table (user_id uuid, display_name text, submitted_count integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_active_member() then
    raise exception 'NOT_ACTIVE_MEMBER' using errcode = '42501';
  end if;
  return query
    select pr.id, pr.display_name,
           (select count(*)::integer from public.predictions p
              join public.fixtures f on f.id = p.fixture_id
             where f.round_id = p_round_id and p.user_id = pr.id)
      from public.profiles pr
     where pr.status = 'active'
     order by pr.display_name;
end;
$$;

-- Bote -------------------------------------------------------------------------------
create or replace function private.pot_balance()
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum(amount_cents), 0)::bigint from public.pot_movements;
$$;

-- Bote en juego de una jornada: si está cerrada, su resumen; si no, estimación en vivo.
create or replace function public.get_round_pot(p_round_id uuid)
returns table (
  pot_before_cents bigint,
  participants_count integer,
  contribution_cents bigint,
  pot_in_play_cents bigint,
  is_closed boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_s public.round_settlements;
  v_contrib integer;
  v_n integer;
  v_balance bigint;
begin
  if not private.is_active_member() then
    raise exception 'NOT_ACTIVE_MEMBER' using errcode = '42501';
  end if;

  select * into v_s from public.round_settlements where round_id = p_round_id;
  if found then
    return query select v_s.pot_before_cents, v_s.participants_count,
                        v_s.contribution_total_cents, v_s.pot_in_play_cents, true;
    return;
  end if;

  select s.pot_contribution_cents into v_contrib
    from public.rounds r join public.seasons s on s.id = r.season_id
   where r.id = p_round_id;

  select count(*)::integer into v_n from (
    select p.user_id from public.predictions p
      join public.fixtures f on f.id = p.fixture_id
     where f.round_id = p_round_id
     group by p.user_id having count(*) = 2
  ) t;

  v_balance := private.pot_balance();
  return query select v_balance, v_n, (v_n * coalesce(v_contrib, 0))::bigint,
                      (v_balance + v_n * coalesce(v_contrib, 0))::bigint, false;
end;
$$;

create or replace function public.get_pot_balance()
returns bigint language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_active_member() then
    raise exception 'NOT_ACTIVE_MEMBER' using errcode = '42501';
  end if;
  return private.pot_balance();
end;
$$;

-- Clasificación: jornadas ganadas > importe ganado > marcadores sueltos acertados.
create or replace function public.get_leaderboard(p_season_id uuid default null)
returns table (
  user_id uuid,
  display_name text,
  rounds_played integer,
  wins integer,
  total_won_cents bigint,
  exact_hits integer
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_season uuid;
begin
  if not private.is_active_member() then
    raise exception 'NOT_ACTIVE_MEMBER' using errcode = '42501';
  end if;
  v_season := coalesce(p_season_id, (select id from public.seasons where is_active limit 1));

  return query
  with closed as (
    select r.id, r.status from public.rounds r
     where r.season_id = v_season and r.status in ('settled', 'void')
  ),
  tickets as (
    select p.user_id, f.round_id, count(*) as n
      from public.predictions p join public.fixtures f on f.id = p.fixture_id
     where f.round_id in (select id from closed)
     group by p.user_id, f.round_id
  ),
  played as (
    select t.user_id, count(*) filter (where t.n = 2) as c from tickets t group by t.user_id
  ),
  hits as (
    select p.user_id, count(*) as c
      from public.predictions p join public.fixtures f on f.id = p.fixture_id
     where f.round_id in (select id from closed where status = 'settled')
       and f.status = 'finished'
       and p.home_goals = f.home_goals and p.away_goals = f.away_goals
     group by p.user_id
  ),
  won as (
    select w.user_id, count(*) as c, sum(w.share_cents) as cents
      from public.round_winners w
     where w.round_id in (select id from closed)
     group by w.user_id
  )
  select pr.id, pr.display_name,
         coalesce(pl.c, 0)::integer,
         coalesce(wo.c, 0)::integer,
         coalesce(wo.cents, 0)::bigint,
         coalesce(h.c, 0)::integer
    from public.profiles pr
    left join played pl on pl.user_id = pr.id
    left join won wo on wo.user_id = pr.id
    left join hits h on h.user_id = pr.id
   where pr.status = 'active' or pl.user_id is not null
   order by 4 desc, 5 desc, 6 desc, 2 asc;
end;
$$;

-- Administración --------------------------------------------------------------------
create or replace function public.admin_list_members()
returns table (
  user_id uuid, display_name text, email text, role public.app_role,
  status public.member_status, invite_code text, created_at timestamptz, approved_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return query
    select p.id, p.display_name, u.email::text, p.role, p.status, p.invite_code, p.created_at, p.approved_at
      from public.profiles p join auth.users u on u.id = p.id
     order by (p.status = 'pending') desc, p.created_at;
end;
$$;

create or replace function public.admin_set_member_status(p_user_id uuid, p_status public.member_status)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_CHANGE_OWN_STATUS';
  end if;
  update public.profiles
     set status = p_status,
         approved_at = case when p_status = 'active' then coalesce(approved_at, now()) else approved_at end
   where id = p_user_id;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_set_member_role(p_user_id uuid, p_role public.app_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'CANNOT_DEMOTE_SELF';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_create_invite_code(
  p_note text default null, p_max_uses integer default null, p_expires_at timestamptz default null
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_code text := 'PORRA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
begin
  perform private.assert_admin();
  insert into public.invite_codes (code, note, max_uses, expires_at, created_by)
  values (v_code, nullif(btrim(p_note), ''), p_max_uses, p_expires_at, auth.uid());
  return v_code;
end;
$$;

create or replace function public.admin_set_invite_code_active(p_code text, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  update public.invite_codes set is_active = p_active where code = p_code;
end;
$$;

-- Cierre de jornada (liquidación o anulación). Núcleo común.
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
  perform pg_advisory_xact_lock(hashtext('porra_pot'));

  select * into v_round from public.rounds where id = p_round_id for update;
  if not found then
    raise exception 'ROUND_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_round.status <> 'open' then
    raise exception 'ROUND_NOT_OPEN: solo se cierran jornadas abiertas';
  end if;
  select * into v_season from public.seasons where id = v_round.season_id;

  if not p_void then
    select count(*), count(*) filter (where f.status <> 'finished' or f.home_goals is null)
      into v_fx, v_unfinished
      from public.fixtures f where f.round_id = p_round_id;
    if v_fx <> 2 then
      raise exception 'ROUND_NEEDS_TWO_FIXTURES';
    end if;
    if v_unfinished > 0 then
      raise exception 'FIXTURES_NOT_FINISHED: faltan resultados';
    end if;
  elsif char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'VOID_REASON_REQUIRED';
  end if;

  -- Participantes = quien tiene boleto completo (los dos pronósticos).
  select count(*)::integer into v_participants from (
    select p.user_id from public.predictions p
      join public.fixtures f on f.id = p.fixture_id
     where f.round_id = p_round_id
     group by p.user_id having count(*) = 2
  ) t;

  v_contrib := v_participants::bigint * v_season.pot_contribution_cents;
  v_fee := v_participants::bigint * (v_season.entry_fee_cents - v_season.pot_contribution_cents);
  v_before := private.pot_balance();

  if v_contrib > 0 then
    insert into public.pot_movements (round_id, kind, amount_cents, note, created_by)
    values (p_round_id, 'contribution', v_contrib,
            format('%s boletos × %s cént.', v_participants, v_season.pot_contribution_cents), auth.uid());
  end if;
  v_in_play := v_before + v_contrib;

  if not p_void then
    insert into public.round_winners (round_id, user_id, share_cents)
    select p_round_id, p.user_id, 0
      from public.predictions p join public.fixtures f on f.id = p.fixture_id
     where f.round_id = p_round_id
       and p.home_goals = f.home_goals and p.away_goals = f.away_goals
     group by p.user_id having count(*) = 2;
    get diagnostics v_winners = row_count;

    if v_winners > 0 then
      -- Reparto a partes iguales; los céntimos sobrantes se quedan en el bote.
      v_share := v_in_play / v_winners;
      update public.round_winners set share_cents = v_share where round_id = p_round_id;
      if v_share > 0 then
        insert into public.pot_movements (round_id, kind, amount_cents, user_id, note, created_by)
        select p_round_id, 'payout', -v_share, w.user_id, 'Premio de la jornada', auth.uid()
          from public.round_winners w where w.round_id = p_round_id;
      end if;
    end if;
  end if;

  update public.rounds set status = case when p_void then 'void' else 'settled' end::public.round_status
   where id = p_round_id;

  insert into public.round_settlements (
    round_id, kind, participants_count, entry_fee_cents, pot_contribution_cents,
    contribution_total_cents, admin_fee_total_cents, pot_before_cents, pot_in_play_cents,
    winners_count, share_cents, pot_after_cents, reason, settled_by
  ) values (
    p_round_id, case when p_void then 'void' else 'settled' end::public.settlement_kind,
    v_participants, v_season.entry_fee_cents, v_season.pot_contribution_cents,
    v_contrib, v_fee, v_before, v_in_play,
    v_winners, v_share, v_in_play - v_share * v_winners,
    nullif(btrim(coalesce(p_reason, '')), ''), auth.uid()
  ) returning * into v_res;

  return v_res;
end;
$$;

create or replace function public.admin_settle_round(p_round_id uuid)
returns public.round_settlements language sql security definer set search_path = '' as $$
  select * from private.close_round(p_round_id, false, null);
$$;

-- Anular jornada (p. ej. partido aplazado): los boletos suman al bote y no hay ganadores.
create or replace function public.admin_void_round(p_round_id uuid, p_reason text)
returns public.round_settlements language sql security definer set search_path = '' as $$
  select * from private.close_round(p_round_id, true, p_reason);
$$;

-- Deshacer el cierre de la última jornada cerrada (para corregir un resultado).
create or replace function public.admin_reopen_round(p_round_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_s public.round_settlements;
begin
  perform private.assert_admin();
  perform set_config('porra.internal', 'on', true);
  perform pg_advisory_xact_lock(hashtext('porra_pot'));

  select * into v_s from public.round_settlements where round_id = p_round_id for update;
  if not found then
    raise exception 'ROUND_NOT_CLOSED';
  end if;
  if exists (select 1 from public.round_settlements where settled_at > v_s.settled_at) then
    raise exception 'ONLY_LATEST_ROUND: solo se puede reabrir la última jornada cerrada';
  end if;

  delete from public.pot_movements where round_id = p_round_id;
  delete from public.round_winners where round_id = p_round_id;
  delete from public.round_settlements where round_id = p_round_id;
  update public.rounds set status = 'open' where id = p_round_id;
end;
$$;

-- Sustituir un partido aún no empezado (aplazamiento conocido antes del inicio).
-- Los pronósticos de ese partido se reinician y quedan registrados.
create or replace function public.admin_replace_fixture(
  p_fixture_id uuid, p_competition text, p_home_team text, p_away_team text, p_kickoff_at timestamptz
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
  select p.fixture_id, p.user_id, 'reset', p.home_goals, p.away_goals
    from public.predictions p where p.fixture_id = p_fixture_id;
  delete from public.predictions where fixture_id = p_fixture_id;

  update public.fixtures
     set competition = btrim(p_competition), home_team = btrim(p_home_team),
         away_team = btrim(p_away_team), kickoff_at = p_kickoff_at,
         status = 'scheduled', home_goals = null, away_goals = null
   where id = p_fixture_id
  returning * into v_f;
  return v_f;
end;
$$;

-- Ajuste manual del bote (con motivo obligatorio y trazabilidad).
create or replace function public.admin_adjust_pot(p_amount_cents bigint, p_note text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_balance bigint;
begin
  perform private.assert_admin();
  perform set_config('porra.internal', 'on', true);
  perform pg_advisory_xact_lock(hashtext('porra_pot'));
  if p_amount_cents is null or p_amount_cents = 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'NOTE_REQUIRED';
  end if;
  insert into public.pot_movements (kind, amount_cents, note, created_by)
  values ('adjustment', p_amount_cents, btrim(p_note), auth.uid());
  v_balance := private.pot_balance();
  if v_balance < 0 then
    raise exception 'POT_NEGATIVE';
  end if;
  return v_balance;
end;
$$;
