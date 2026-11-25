-- LA PORRA LEAGUE · 002 · Funciones auxiliares, triggers de integridad y alta de usuarios
-- Las reglas viven en la base de datos: aunque alguien manipule el cliente, no puede saltárselas.

-- Auxiliares (esquema privado, no expuesto por la API) ---------------------------
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.status = 'active'
  );
$$;

create or replace function private.is_active_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
  );
$$;

-- Un partido está bloqueado (y sus pronósticos revelados) desde su inicio.
create or replace function private.fixture_locked(p_fixture_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select f.locked_at is not null or f.kickoff_at <= now() or f.status in ('live', 'finished')
    from public.fixtures f where f.id = p_fixture_id
  ), false);
$$;

-- Marca de operación interna: solo la activan las funciones RPC de liquidación/gestión.
create or replace function private.is_internal()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(current_setting('porra.internal', true), '') = 'on';
$$;

create or replace function private.assert_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
end;
$$;

-- Jornadas ---------------------------------------------------------------------
create or replace function private.rounds_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_fixtures integer;
begin
  if private.is_internal() then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'ROUND_NOT_DRAFT: solo se pueden borrar jornadas en borrador';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'ROUND_MUST_START_AS_DRAFT';
    end if;
    new.created_at := now();
    return new;
  end if;

  -- UPDATE
  if old.status in ('settled', 'void') then
    raise exception 'ROUND_CLOSED: la jornada ya está cerrada';
  end if;
  if new.status in ('settled', 'void') then
    raise exception 'USE_SETTLE_RPC: usa liquidar o anular jornada';
  end if;
  if new.season_id <> old.season_id then
    raise exception 'ROUND_SEASON_IMMUTABLE';
  end if;
  new.created_at := old.created_at;

  if new.status = 'open' and old.status = 'draft' then
    select count(*) into v_fixtures from public.fixtures where round_id = new.id;
    if v_fixtures <> 2 then
      raise exception 'ROUND_NEEDS_TWO_FIXTURES: añade el partido del Barça y el del Madrid';
    end if;
  end if;

  if new.status = 'draft' and old.status = 'open' and exists (
    select 1 from public.predictions p join public.fixtures f on f.id = p.fixture_id
    where f.round_id = old.id
  ) then
    raise exception 'ROUND_HAS_PREDICTIONS';
  end if;

  return new;
end;
$$;

create trigger rounds_guard before insert or update or delete on public.rounds
for each row execute function private.rounds_guard();

-- Partidos ---------------------------------------------------------------------
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

  -- UPDATE
  new.id := old.id;
  new.created_at := old.created_at;
  new.updated_at := now();
  v_was_locked := old.locked_at is not null or old.kickoff_at <= now() or old.status in ('live', 'finished');
  select exists (select 1 from public.predictions where fixture_id = old.id) into v_has_predictions;

  if (new.round_id <> old.round_id or new.club <> old.club) and (v_has_predictions or v_was_locked) then
    raise exception 'FIXTURE_HAS_PREDICTIONS: no se puede mover un partido con pronósticos';
  end if;

  if v_was_locked then
    -- Bloqueo permanente.
    new.locked_at := coalesce(old.locked_at, least(old.kickoff_at, now()));
    if new.home_team <> old.home_team or new.away_team <> old.away_team
       or new.competition <> old.competition then
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

create trigger fixtures_guard before insert or update or delete on public.fixtures
for each row execute function private.fixtures_guard();

-- Pronósticos (defensa en profundidad: incluso con la clave de servicio) ------------
create or replace function private.predictions_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_locked boolean;
begin
  if private.is_internal() then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception 'PREDICTION_IMMUTABLE';
  end if;
  if tg_op = 'UPDATE' and (new.fixture_id <> old.fixture_id or new.user_id <> old.user_id) then
    raise exception 'PREDICTION_IMMUTABLE';
  end if;

  select (f.locked_at is not null or f.kickoff_at <= clock_timestamp() or f.status <> 'scheduled')
    into v_locked
  from public.fixtures f where f.id = new.fixture_id;

  if coalesce(v_locked, true) then
    raise exception 'PREDICTION_LOCKED: el partido ya ha empezado';
  end if;

  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger predictions_guard before insert or update or delete on public.predictions
for each row execute function private.predictions_guard();

-- Tablas de solo-escritura-interna ----------------------------------------------
create or replace function private.internal_only_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_internal() then
    raise exception 'INTERNAL_ONLY: % solo se modifica desde las funciones de la porra', tg_table_name;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger pot_movements_guard before insert or update or delete on public.pot_movements
for each row execute function private.internal_only_guard();
create trigger round_winners_guard before insert or update or delete on public.round_winners
for each row execute function private.internal_only_guard();
create trigger round_settlements_guard before insert or update or delete on public.round_settlements
for each row execute function private.internal_only_guard();

-- El registro de pronósticos es inmutable siempre.
create or replace function private.append_only_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'APPEND_ONLY: % no se puede modificar ni borrar', tg_table_name;
end;
$$;

create trigger prediction_log_guard before update or delete on public.prediction_log
for each row execute function private.append_only_guard();

-- Alta de usuarios: código de invitación + aprobación del admin --------------------
-- El primer usuario registrado se convierte en administrador activo (arranque).
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(btrim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
  v_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  v_ok boolean;
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

  update public.invite_codes
     set used_count = used_count + 1
   where code = v_code
     and is_active
     and (expires_at is null or expires_at > now())
     and (max_uses is null or used_count < max_uses)
  returning true into v_ok;

  if not coalesce(v_ok, false) then
    raise exception 'INVALID_INVITE_CODE' using hint = 'Código de invitación no válido o caducado';
  end if;

  insert into public.profiles (id, display_name, invite_code)
  values (new.id, v_name, v_code);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();
