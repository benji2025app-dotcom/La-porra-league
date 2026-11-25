-- LA PORRA LEAGUE · Batería de tests de reglas y seguridad
-- Ejecutar contra una base SIN usuarios. Todo se deshace al final (el último RAISE revierte la transacción).
-- Resultado esperado: ERROR "ALL_TESTS_PASSED". Cualquier otro error = test fallido.

create schema porra_test;
grant usage on schema porra_test to anon, authenticated;

create function porra_test.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function porra_test.expect_error(p_label text, p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm not like p_pattern then
      raise exception 'TEST FAIL [%]: error inesperado: %', p_label, sqlerrm;
    end if;
    return;
  end;
  raise exception 'TEST FAIL [%]: se esperaba un error %', p_label, p_pattern;
end $$;

grant execute on all functions in schema porra_test to anon, authenticated;

do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000000a'; -- admin (también juega)
  b uuid := '00000000-0000-4000-8000-00000000000b';
  c uuid := '00000000-0000-4000-8000-00000000000c';
  d uuid := '00000000-0000-4000-8000-00000000000d'; -- pendiente de aprobación
  e uuid := '00000000-0000-4000-8000-00000000000e';
  f uuid := '00000000-0000-4000-8000-00000000000f';
  v_season uuid;
  r1 uuid; r2 uuid; r3 uuid; r4 uuid;
  f1 uuid; f2 uuid; f3 uuid; f4 uuid; f5 uuid; f6 uuid; f7 uuid; f8 uuid;
  v_code text;
  v_n integer;
  v_bal bigint;
  v_s public.round_settlements;
  v_pot record;
begin
  if exists (select 1 from public.profiles) then
    raise exception 'TEST SETUP: la base debe estar vacía de usuarios';
  end if;
  select id into v_season from public.seasons where is_active;

  -- T1 · El primer usuario es admin activo
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '{"display_name":"Admin"}');
  assert (select role = 'admin' and status = 'active' from public.profiles where id = a), 'T1 bootstrap admin';

  perform porra_test.as_user(a);
  v_code := public.admin_create_invite_code('test', 3, null);
  reset role;

  -- T2 · Registro con código inválido falla
  perform porra_test.expect_error('T2 código inválido',
    format($q$insert into auth.users (id, aud, role, email, raw_user_meta_data) values (%L,'authenticated','authenticated','e@test.local','{"invite_code":"PORRA-NOPE0000"}')$q$, e),
    '%INVALID_INVITE_CODE%');
  perform porra_test.expect_error('T2b sin código',
    format($q$insert into auth.users (id, aud, role, email) values (%L,'authenticated','authenticated','e@test.local')$q$, e),
    '%INVALID_INVITE_CODE%');

  -- T3 · Código válido → pendiente; respeta usos máximos
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (b, 'authenticated', 'authenticated', 'b@test.local', json_build_object('invite_code', lower(v_code), 'display_name', 'Bea')),
    (c, 'authenticated', 'authenticated', 'c@test.local', json_build_object('invite_code', v_code, 'display_name', 'Carlos')),
    (d, 'authenticated', 'authenticated', 'd@test.local', json_build_object('invite_code', v_code, 'display_name', 'Dani'));
  assert (select count(*) from public.profiles where status = 'pending') = 3, 'T3 nuevos pendientes';
  perform porra_test.expect_error('T3 usos agotados',
    format($q$insert into auth.users (id, aud, role, email, raw_user_meta_data) values (%L,'authenticated','authenticated','f@test.local',%L)$q$,
           f, json_build_object('invite_code', v_code)::text),
    '%INVALID_INVITE_CODE%');

  -- T4 · Admin aprueba a B y C; D sigue pendiente
  perform porra_test.as_user(a);
  perform public.admin_set_member_status(b, 'active');
  perform public.admin_set_member_status(c, 'active');
  perform porra_test.expect_error('T4 admin no se cambia a sí mismo',
    format('select public.admin_set_member_status(%L, %L)', a, 'blocked'), '%CANNOT_CHANGE_OWN_STATUS%');

  -- T5 · Jugador no crea jornadas ni gestiona
  perform porra_test.as_user(b);
  perform porra_test.expect_error('T5 jugador crea jornada',
    format('insert into public.rounds (season_id, number, name) values (%L, 99, %L)', v_season, 'X'), '%row-level security%');
  perform porra_test.expect_error('T5b jugador lista miembros', 'select * from public.admin_list_members()', '%FORBIDDEN%');
  perform porra_test.expect_error('T5c jugador ajusta bote', 'select public.admin_adjust_pot(100000, ''robo'')', '%FORBIDDEN%');
  perform porra_test.expect_error('T5d jugador se hace admin',
    format('update public.profiles set role = %L where id = %L', 'admin', b), '%permission denied%');
  assert (select count(*) from public.invite_codes) = 0, 'T5e jugador no ve códigos';

  -- T6 · Ciclo de vida de jornada
  perform porra_test.as_user(a);
  perform porra_test.expect_error('T6 jornada nace abierta',
    format('insert into public.rounds (season_id, number, name, status) values (%L, 1, %L, %L)', v_season, 'J1', 'open'),
    '%ROUND_MUST_START_AS_DRAFT%');
  insert into public.rounds (season_id, number, name) values (v_season, 1, 'Jornada 1') returning id into r1;
  insert into public.rounds (season_id, number, name) values (v_season, 2, 'Jornada 2') returning id into r2;
  insert into public.fixtures (round_id, club, competition, home_team, away_team, kickoff_at)
  values (r1, 'barcelona', 'LaLiga', 'FC Barcelona', 'Sevilla FC', now() + interval '1 hour') returning id into f1;
  perform porra_test.expect_error('T6b abrir con un partido',
    format('update public.rounds set status = %L where id = %L', 'open', r1), '%ROUND_NEEDS_TWO_FIXTURES%');
  insert into public.fixtures (round_id, club, competition, home_team, away_team, kickoff_at)
  values (r1, 'real_madrid', 'Champions League', 'Real Madrid', 'Liverpool', now() + interval '2 hours') returning id into f2;
  update public.rounds set status = 'open' where id = r1;
  perform porra_test.expect_error('T6c partido con hora pasada',
    format('insert into public.fixtures (round_id, club, competition, home_team, away_team, kickoff_at) values (%L,%L,%L,%L,%L, now() - interval %L)',
           r2, 'barcelona', 'LaLiga', 'FC Barcelona', 'Betis', '1 minute'),
    '%KICKOFF_IN_PAST%');
  perform porra_test.expect_error('T6d tercer partido',
    format('insert into public.fixtures (round_id, club, competition, home_team, away_team, kickoff_at) values (%L,%L,%L,%L,%L, now() + interval %L)',
           r1, 'barcelona', 'Copa', 'FC Barcelona', 'Getafe', '3 hours'),
    '%duplicate key%');

  -- T7 · Visibilidad de jornadas
  perform porra_test.as_user(b);
  select count(*) into v_n from public.rounds;
  assert v_n = 1, 'T7 jugador solo ve jornadas publicadas: ' || v_n;
  perform porra_test.as_user(d);
  select count(*) into v_n from public.rounds;
  assert v_n = 0, 'T7b pendiente no ve jornadas';
  perform porra_test.expect_error('T7c pendiente no pronostica',
    format('select public.submit_prediction(%L, 1, 0)', f1), '%NOT_ACTIVE_MEMBER%');

  -- T8 · Pronósticos y modificaciones
  perform porra_test.as_user(b);
  perform public.submit_prediction(f1, 2, 1);
  perform public.submit_prediction(f2, 1, 1);
  perform public.submit_prediction(f1, 3, 1); -- modifica
  perform porra_test.as_user(c);
  perform public.submit_prediction(f1, 0, 0);
  perform public.submit_prediction(f2, 1, 1); -- marcadores repetidos permitidos
  perform porra_test.as_user(a);
  perform public.submit_prediction(f1, 1, 0);

  -- T9 · Ocultos antes del inicio, incluso para el admin
  perform porra_test.as_user(b);
  select count(*) into v_n from public.predictions;
  assert v_n = 2, 'T9 B solo ve los suyos: ' || v_n;
  perform porra_test.as_user(a);
  select count(*) into v_n from public.predictions;
  assert v_n = 1, 'T9b admin solo ve los suyos: ' || v_n;
  select count(*) into v_n from public.prediction_log where user_id <> a;
  assert v_n = 0, 'T9c admin no ve el historial ajeno';

  -- T10 · Escritura directa prohibida y validación de marcador
  perform porra_test.as_user(b);
  perform porra_test.expect_error('T10 insert directo',
    format('insert into public.predictions (fixture_id, user_id, home_goals, away_goals) values (%L,%L,5,0)', f2, c), '%permission denied%');
  perform porra_test.expect_error('T10b update directo',
    'update public.predictions set home_goals = 9', '%permission denied%');
  perform porra_test.expect_error('T10c marcador 21', format('select public.submit_prediction(%L, 21, 0)', f2), '%INVALID_SCORE%');
  perform porra_test.expect_error('T10d marcador negativo', format('select public.submit_prediction(%L, -1, 0)', f2), '%INVALID_SCORE%');

  -- T11 · Quién ha enviado (sin marcadores) y bote en juego
  select submitted_count into v_n from public.get_round_submissions(r1) where user_id = b;
  assert v_n = 2, 'T11 B ha enviado 2';
  assert not exists (select 1 from public.get_round_submissions(r1) where user_id = d), 'T11b pendientes no aparecen';
  select * into v_pot from public.get_round_pot(r1);
  assert v_pot.participants_count = 2 and v_pot.pot_in_play_cents = 2400, 'T11c bote en juego 2 × 12 €';

  -- T12 · Resultado antes del inicio prohibido
  perform porra_test.as_user(a);
  perform porra_test.expect_error('T12 resultado anticipado',
    format('update public.fixtures set home_goals = 1, away_goals = 0 where id = %L', f2), '%RESULT_BEFORE_KICKOFF%');

  -- T13 · Empieza el partido 1: bloqueo + revelado
  reset role;
  update public.fixtures set kickoff_at = now() - interval '1 minute' where id = f1;
  perform porra_test.as_user(b);
  perform porra_test.expect_error('T13 pronóstico bloqueado', format('select public.submit_prediction(%L, 0, 0)', f1), '%PREDICTION_LOCKED%');
  perform porra_test.as_user(a);
  perform porra_test.expect_error('T13a admin también bloqueado', format('select public.submit_prediction(%L, 3, 1)', f1), '%PREDICTION_LOCKED%');
  perform porra_test.as_user(b);
  select count(*) into v_n from public.predictions;
  assert v_n = 4, 'T13b B ve los suyos (2) + ajenos del partido 1 (2): ' || v_n;
  select count(*) into v_n from public.predictions where fixture_id = f2 and user_id <> b;
  assert v_n = 0, 'T13c partido 2 sigue oculto';

  -- T14 · Retrasar la hora NO reabre el partido
  perform porra_test.as_user(a);
  update public.fixtures set kickoff_at = now() + interval '3 hours' where id = f1;
  perform porra_test.as_user(b);
  perform porra_test.expect_error('T14 sigue bloqueado tras retrasar', format('select public.submit_prediction(%L, 0, 0)', f1), '%PREDICTION_LOCKED%');
  select count(*) into v_n from public.predictions where fixture_id = f1;
  assert v_n = 3, 'T14b sigue revelado';
  perform porra_test.as_user(a);
  perform porra_test.expect_error('T14c cambiar equipos tras inicio',
    format('update public.fixtures set home_team = %L where id = %L', 'Otro', f1), '%FIXTURE_LOCKED%');

  -- T15 · Ni el superusuario modifica pronósticos bloqueados
  reset role;
  perform porra_test.expect_error('T15 postgres edita bloqueado',
    format('update public.predictions set home_goals = 9 where fixture_id = %L', f1), '%PREDICTION_LOCKED%');
  perform porra_test.expect_error('T15b borrar pronóstico',
    format('delete from public.predictions where fixture_id = %L', f1), '%PREDICTION_IMMUTABLE%');
  perform porra_test.expect_error('T15c manipular bote',
    'insert into public.pot_movements (kind, amount_cents) values (''adjustment'', 999)', '%INTERNAL_ONLY%');
  perform porra_test.expect_error('T15d borrar historial',
    'delete from public.prediction_log', '%APPEND_ONLY%');

  -- T16 · Liquidación
  perform porra_test.as_user(a);
  perform porra_test.expect_error('T16 liquidar sin resultados', format('select public.admin_settle_round(%L)', r1), '%FIXTURES_NOT_FINISHED%');
  perform porra_test.as_user(b);
  perform porra_test.expect_error('T16b jugador liquida', format('select public.admin_settle_round(%L)', r1), '%FORBIDDEN%');
  reset role;
  update public.fixtures set kickoff_at = now() - interval '1 minute' where id = f2;
  perform porra_test.as_user(a);
  update public.fixtures set home_goals = 3, away_goals = 1, status = 'finished' where id = f1;
  update public.fixtures set home_goals = 1, away_goals = 1, status = 'finished' where id = f2;
  select * into v_s from public.admin_settle_round(r1);
  assert v_s.participants_count = 2, 'T16c participantes (A solo tiene 1 pronóstico)';
  assert v_s.winners_count = 1 and v_s.share_cents = 2400 and v_s.pot_after_cents = 0, 'T16d B gana 24 €';
  assert v_s.admin_fee_total_cents = 600, 'T16e gestión 2 × 3 €';
  assert (select user_id from public.round_winners where round_id = r1) = b, 'T16f ganador B';
  assert public.get_pot_balance() = 0, 'T16g bote vacío tras pagar';

  -- T17 · Jornada cerrada es inmutable
  perform porra_test.expect_error('T17 editar resultado cerrado',
    format('update public.fixtures set home_goals = 0 where id = %L', f1), '%ROUND_CLOSED%');
  perform porra_test.expect_error('T17b renombrar cerrada',
    format('update public.rounds set name = %L where id = %L', 'X', r1), '%ROUND_CLOSED%');
  perform porra_test.expect_error('T17c liquidar dos veces', format('select public.admin_settle_round(%L)', r1), '%ROUND_NOT_OPEN%');

  -- T18 · Nadie acierta → se acumula
  insert into public.fixtures (round_id, club, competition, home_team, away_team, kickoff_at)
  values (r2, 'barcelona', 'LaLiga', 'FC Barcelona', 'Betis', now() + interval '1 hour') returning id into f3;
  insert into public.fixtures (round_id, club, competition, home_team, away_team, kickoff_at)
  values (r2, 'real_madrid', 'LaLiga', 'Real Madrid', 'Valencia', now() + interval '2 hours') returning id into f4;
  update public.rounds set status = 'open' where id = r2;
  perform porra_test.as_user(b); perform public.submit_prediction(f3, 1, 0); perform public.submit_prediction(f4, 2, 0);
  perform porra_test.as_user(c); perform public.submit_prediction(f3, 2, 2); perform public.submit_prediction(f4, 2, 0);
  reset role;
  update public.fixtures set kickoff_at = now() - interval '1 minute' where id in (f3, f4);
  perform porra_test.as_user(a);
  update public.fixtures set home_goals = 1, away_goals = 0, status = 'finished' where id = f3;
  update public.fixtures set home_goals = 3, away_goals = 0, status = 'finished' where id = f4;
  select * into v_s from public.admin_settle_round(r2);
  assert v_s.winners_count = 0 and v_s.pot_after_cents = 2400, 'T18 bote acumulado 24 €';

  -- T19 · Varios acertantes → reparto; céntimo sobrante se queda en el bote
  perform public.admin_adjust_pot(1, 'test de redondeo');
  insert into public.rounds (season_id, number, name) values (v_season, 3, 'Jornada 3') returning id into r3;
  insert into public.fixtures (round_id, club, competition, home_team, away_team, kickoff_at)
  values (r3, 'barcelona', 'Copa del Rey', 'Barbastro', 'FC Barcelona', now() + interval '1 hour') returning id into f5;
  insert into public.fixtures (round_id, club, competition, home_team, away_team, kickoff_at)
  values (r3, 'real_madrid', 'LaLiga', 'Atlético de Madrid', 'Real Madrid', now() + interval '2 hours') returning id into f6;
  update public.rounds set status = 'open' where id = r3;
  perform porra_test.as_user(b); perform public.submit_prediction(f5, 0, 2); perform public.submit_prediction(f6, 1, 0);
  perform porra_test.as_user(c); perform public.submit_prediction(f5, 0, 2); perform public.submit_prediction(f6, 1, 0);
  reset role;
  update public.fixtures set kickoff_at = now() - interval '1 minute' where id in (f5, f6);
  perform porra_test.as_user(a);
  update public.fixtures set home_goals = 0, away_goals = 2, status = 'finished' where id = f5;
  update public.fixtures set home_goals = 1, away_goals = 0, status = 'finished' where id = f6;
  select * into v_s from public.admin_settle_round(r3);
  assert v_s.pot_in_play_cents = 4801 and v_s.winners_count = 2 and v_s.share_cents = 2400 and v_s.pot_after_cents = 1,
    'T19 reparto 48,01 € entre 2 → 24 € cada uno, 1 cént. al bote';

  -- T20 · Reabrir solo la última jornada cerrada
  perform porra_test.expect_error('T20 reabrir antigua', format('select public.admin_reopen_round(%L)', r2), '%ONLY_LATEST_ROUND%');
  perform public.admin_reopen_round(r3);
  assert public.get_pot_balance() = 2401, 'T20b bote restaurado al reabrir';
  select * into v_s from public.admin_settle_round(r3);
  assert v_s.pot_after_cents = 1, 'T20c re-liquidación consistente';

  -- T21 · Aplazado: sustituir partido (reinicia pronósticos) y anular jornada
  insert into public.rounds (season_id, number, name) values (v_season, 4, 'Jornada 4') returning id into r4;
  insert into public.fixtures (round_id, club, competition, home_team, away_team, kickoff_at)
  values (r4, 'barcelona', 'LaLiga', 'FC Barcelona', 'Girona', now() + interval '1 hour') returning id into f7;
  insert into public.fixtures (round_id, club, competition, home_team, away_team, kickoff_at)
  values (r4, 'real_madrid', 'LaLiga', 'Real Madrid', 'Osasuna', now() + interval '2 hours') returning id into f8;
  update public.rounds set status = 'open' where id = r4;
  perform porra_test.as_user(b); perform public.submit_prediction(f7, 2, 0); perform public.submit_prediction(f8, 3, 0);
  perform porra_test.as_user(c); perform public.submit_prediction(f7, 1, 1);
  perform porra_test.as_user(a);
  perform porra_test.expect_error('T21 cambiar equipos con pronósticos',
    format('update public.fixtures set away_team = %L where id = %L', 'Mallorca', f8), '%USE_REPLACE_FIXTURE%');
  perform public.admin_replace_fixture(f8, 'LaLiga', 'Real Madrid', 'Mallorca', now() + interval '1 day');
  perform porra_test.as_user(b);
  select count(*) into v_n from public.predictions where fixture_id = f8;
  assert v_n = 0, 'T21b pronósticos del partido sustituido reiniciados';
  assert exists (select 1 from public.prediction_log where fixture_id = f8 and user_id = b and action = 'reset'), 'T21c queda registro del reinicio';
  perform public.submit_prediction(f8, 2, 1);
  perform porra_test.as_user(a);
  perform porra_test.expect_error('T21d anular sin motivo', format('select public.admin_void_round(%L, %L)', r4, ''), '%VOID_REASON_REQUIRED%');
  select * into v_s from public.admin_void_round(r4, 'Partido del Madrid aplazado');
  assert v_s.kind = 'void' and v_s.participants_count = 1 and v_s.winners_count = 0 and v_s.pot_after_cents = 1201,
    'T21e anulada: el boleto completo suma 12 € al bote';

  -- T22 · Clasificación
  perform porra_test.as_user(b);
  assert (select wins = 2 and total_won_cents = 4800 and exact_hits = 5 and rounds_played = 4
            from public.get_leaderboard() where user_id = b), 'T22 B: 2 victorias, 48 €, 5 aciertos';
  assert (select wins = 1 and total_won_cents = 2400 and exact_hits = 3 and rounds_played = 3
            from public.get_leaderboard() where user_id = c), 'T22b C: 1 victoria, 24 €, 3 aciertos';
  assert (select user_id from public.get_leaderboard() limit 1) = b, 'T22c B lidera';

  -- T23 · Anónimo no lee nada
  reset role;
  perform set_config('role', 'anon', true);
  perform porra_test.expect_error('T23 anon lee pronósticos', 'select * from public.predictions', '%permission denied%');
  perform porra_test.expect_error('T23b anon lee perfiles', 'select * from public.profiles', '%permission denied%');
  perform porra_test.expect_error('T23c anon llama RPC', format('select public.get_round_pot(%L)', r1), '%permission denied%');
  assert public.check_invite_code('PORRA-NOPE0000') = false, 'T23d anon valida códigos';
  reset role;

  raise exception 'ALL_TESTS_PASSED';
end $$;
