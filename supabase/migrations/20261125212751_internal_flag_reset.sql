-- LA PORRA LEAGUE · 006 · La marca interna se desactiva al terminar cada función de gestión
-- (evita que siga activa en el resto de la transacción).

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

  perform set_config('porra.internal', 'off', true);
  return v_res;
end;
$$;

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
  perform set_config('porra.internal', 'off', true);
end;
$$;

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
  perform set_config('porra.internal', 'off', true);
  return v_f;
end;
$$;

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
  perform set_config('porra.internal', 'off', true);
  return v_balance;
end;
$$;
