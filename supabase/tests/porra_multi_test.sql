-- LA PORRA LEAGUE · Tests de varias porras (aislamiento, bote y liquidación por porra)
-- Se ejecutan tras la migración multi_porra en la misma transacción y se deshacen al final.
-- Resultado esperado: ERROR "ALL_TESTS_PASSED".

create schema porra_test;
grant usage on schema porra_test to anon, authenticated;
create function porra_test.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function porra_test.expect_error(p_label text, p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlerrm not like p_pattern then raise exception 'TEST FAIL [%]: %', p_label, sqlerrm; end if;
    return;
  end;
  raise exception 'TEST FAIL [%]: se esperaba %', p_label, p_pattern;
end $$;
grant execute on all functions in schema porra_test to anon, authenticated;

do $$
declare
  adm uuid := (select id from public.profiles where role = 'admin' order by created_at limit 1);
  b uuid := '00000000-0000-4000-8000-0000000000b1';
  c uuid := '00000000-0000-4000-8000-0000000000c1';
  d uuid := '00000000-0000-4000-8000-0000000000d1';
  amigos uuid := (select id from public.leagues where name = 'Amigos');
  hotel uuid := (select id from public.leagues where name = 'Hotel');
  sevilla uuid := (select id from public.teams where name = 'Sevilla FC');
  betis uuid := (select id from public.teams where name = 'Real Betis');
  barca uuid := (select id from public.teams where name = 'FC Barcelona');
  rival uuid;
  season uuid := (select id from public.seasons where is_active);
  j14 uuid;
  fx14 uuid;
  rh uuid; fh1 uuid; fh2 uuid;
  code_a text; code_h text;
  v_n integer;
  v_s public.round_settlements;
  v_name text;
begin
  -- M1 · Datos migrados intactos en Amigos
  select id into j14 from public.rounds where league_id = amigos and status = 'open' order by number limit 1;
  assert j14 is not null, 'M1 jornada abierta migrada a Amigos';
  select id into fx14 from public.fixtures where round_id = j14 limit 1;
  assert (select count(*) from public.fixtures where round_id = j14 and club_team_id is not null and home_team_id is not null and away_team_id is not null) = 2,
    'M1b partidos con club y equipos';
  assert (select count(*) from public.predictions p join public.fixtures f on f.id = p.fixture_id where f.round_id = j14) >= 2, 'M1c pronósticos intactos';
  assert (select count(*) from public.league_members where user_id = adm and status = 'active') = 3, 'M1d admin activo en las 3 porras';
  assert not exists (select 1 from public.invite_codes where league_id is distinct from amigos), 'M1e códigos en Amigos';
  assert not exists (select 1 from public.invite_codes where note = 'Código fundador (admin)' and is_active), 'M1f código fundador desactivado';

  -- Códigos por porra y altas
  perform porra_test.as_user(adm);
  code_a := public.admin_create_invite_code(amigos, 'test A', 5, null);
  code_h := public.admin_create_invite_code(hotel, 'test H', 5, null);
  reset role;
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (b, 'authenticated', 'authenticated', 'b1@test.local', json_build_object('invite_code', code_a, 'display_name', 'Bea')),
    (c, 'authenticated', 'authenticated', 'c1@test.local', json_build_object('invite_code', code_h, 'display_name', 'Carlos')),
    (d, 'authenticated', 'authenticated', 'd1@test.local', json_build_object('invite_code', code_a, 'display_name', 'Dani'));

  -- M2 · Membresía pendiente en la porra del código
  assert (select status = 'pending' from public.league_members where user_id = b and league_id = amigos), 'M2 B pendiente en Amigos';
  assert (select count(*) from public.league_members where user_id = c) = 1 and (select league_id from public.league_members where user_id = c) = hotel, 'M2b C solo en Hotel';
  assert (select status = 'active' from public.profiles where id = b), 'M2c cuenta activa por defecto';

  -- M3 · D se une también a Hotel con un segundo código; canjear dos veces no consume dos usos
  perform porra_test.as_user(d);
  v_name := public.redeem_invite_code(code_h);
  assert v_name = 'Hotel', 'M3 canje devuelve nombre de porra';
  perform public.redeem_invite_code(code_h);
  reset role;
  assert (select used_count from public.invite_codes where code = code_h) = 2, 'M3b sin doble consumo';

  -- Pendiente no ve nada
  perform porra_test.as_user(b);
  select count(*) into v_n from public.rounds;
  assert v_n = 0, 'M3c pendiente no ve jornadas';

  perform porra_test.as_user(adm);
  perform public.admin_set_membership(amigos, b, 'active');
  perform public.admin_set_membership(amigos, d, 'active');
  perform public.admin_set_membership(hotel, c, 'active');
  perform public.admin_set_membership(hotel, d, 'active');

  -- Jornada de Hotel
  insert into public.teams (name) values ('Getafe CF') returning id into rival;
  insert into public.rounds (league_id, season_id, number, name) values (hotel, season, 1, 'Jornada 1') returning id into rh;
  perform porra_test.expect_error('M4 club ajeno a la porra',
    format('insert into public.fixtures (round_id, club_team_id, competition, home_team, away_team, kickoff_at) values (%L,%L,%L,%L,%L, now() + interval %L)',
           rh, barca, 'LaLiga', 'FC Barcelona', 'Getafe CF', '1 hour'), '%CLUB_NOT_IN_LEAGUE%');
  perform porra_test.expect_error('M4b el club no juega',
    format('insert into public.fixtures (round_id, club_team_id, competition, home_team, away_team, home_team_id, away_team_id, kickoff_at) values (%L,%L,%L,%L,%L,%L,%L, now() + interval %L)',
           rh, sevilla, 'LaLiga', 'Getafe CF', 'Real Betis', rival, betis, '1 hour'), '%CLUB_NOT_PLAYING%');
  insert into public.fixtures (round_id, club_team_id, competition, home_team, away_team, home_team_id, away_team_id, kickoff_at)
  values (rh, sevilla, 'LaLiga', 'Sevilla FC', 'Getafe CF', sevilla, rival, now() + interval '1 hour') returning id into fh1;
  insert into public.fixtures (round_id, club_team_id, competition, home_team, away_team, home_team_id, kickoff_at)
  values (rh, betis, 'LaLiga', 'Real Betis', 'Valencia CF', betis, now() + interval '2 hours') returning id into fh2;
  update public.rounds set status = 'open' where id = rh;

  -- M5 · Aislamiento de jornadas
  perform porra_test.as_user(b);
  assert not exists (select 1 from public.rounds where league_id = hotel), 'M5 B no ve Hotel';
  assert exists (select 1 from public.rounds where id = j14), 'M5b B ve Amigos';
  perform porra_test.as_user(c);
  assert not exists (select 1 from public.rounds where league_id = amigos), 'M5c C no ve Amigos';
  assert not exists (select 1 from public.fixtures f join public.rounds r on r.id = f.round_id where r.league_id = amigos), 'M5d C no ve partidos de Amigos';
  perform porra_test.as_user(d);
  assert exists (select 1 from public.rounds where league_id = hotel) and exists (select 1 from public.rounds where league_id = amigos), 'M5e D ve las dos';

  -- M6 · Pronosticar solo en tu porra
  perform porra_test.as_user(c);
  perform porra_test.expect_error('M6 C pronostica en Amigos',
    format('select public.submit_prediction(%L, 1, 0)', fx14), '%NOT_LEAGUE_MEMBER%');
  perform public.submit_prediction(fh1, 2, 0);
  perform public.submit_prediction(fh2, 1, 1);
  perform porra_test.as_user(d);
  perform public.submit_prediction(fh1, 2, 0);
  perform public.submit_prediction(fh2, 0, 0);
  perform porra_test.as_user(b);
  perform porra_test.expect_error('M6b B pronostica en Hotel', format('select public.submit_prediction(%L, 1, 0)', fh1), '%NOT_LEAGUE_MEMBER%');

  -- M7 · Perfiles visibles solo entre compañeros de porra
  perform porra_test.as_user(b);
  assert exists (select 1 from public.profiles where id = d) and not exists (select 1 from public.profiles where id = c), 'M7 B ve a D y no a C';
  perform porra_test.as_user(c);
  assert exists (select 1 from public.profiles where id = d) and not exists (select 1 from public.profiles where id = b), 'M7b C ve a D y no a B';

  -- M8 · Revelado por porra
  reset role;
  update public.fixtures set kickoff_at = now() - interval '1 minute' where id in (fh1, fh2);
  perform porra_test.as_user(d);
  select count(*) into v_n from public.predictions where fixture_id in (fh1, fh2);
  assert v_n = 4, 'M8 D ve los de Hotel al empezar: ' || v_n;
  perform porra_test.as_user(b);
  select count(*) into v_n from public.predictions where fixture_id in (fh1, fh2);
  assert v_n = 0, 'M8b B no ve los de Hotel';

  -- M9 · Bote y liquidación por porra
  perform porra_test.as_user(adm);
  perform public.admin_adjust_pot(hotel, 500, 'bote inicial test');
  assert public.get_pot_balance(amigos) = (select coalesce(sum(amount_cents), 0) from public.pot_movements where league_id = amigos), 'M9 Amigos intacto';
  update public.fixtures set home_goals = 2, away_goals = 0, status = 'finished' where id = fh1;
  update public.fixtures set home_goals = 1, away_goals = 1, status = 'finished' where id = fh2;
  select * into v_s from public.admin_settle_round(rh);
  assert v_s.participants_count = 2 and v_s.winners_count = 1 and v_s.pot_in_play_cents = 2900 and v_s.share_cents = 2900, 'M9b C gana 5 + 24 €';
  assert public.get_pot_balance(hotel) = 0, 'M9c bote Hotel a cero';
  assert (select user_id from public.round_winners where round_id = rh) = c, 'M9d ganador C';
  perform porra_test.as_user(c);
  perform porra_test.expect_error('M9e C consulta bote Amigos', format('select public.get_pot_balance(%L)', amigos), '%NOT_LEAGUE_MEMBER%');
  assert (select wins from public.get_leaderboard(hotel) where user_id = c) = 1, 'M9f clasificación Hotel';
  perform porra_test.as_user(b);
  perform porra_test.expect_error('M9g B consulta clasificación Hotel', format('select * from public.get_leaderboard(%L)', hotel), '%NOT_LEAGUE_MEMBER%');
  assert not exists (select 1 from public.round_winners where round_id = rh), 'M9h B no ve ganadores de Hotel';

  -- M10 · Cuenta bloqueada no ve nada
  perform porra_test.as_user(adm);
  perform public.admin_set_account_status(b, 'blocked');
  perform porra_test.as_user(b);
  assert not exists (select 1 from public.rounds), 'M10 bloqueado no ve jornadas';
  perform porra_test.as_user(adm);
  perform porra_test.expect_error('M10b no se bloquea a sí mismo', format('select public.admin_set_account_status(%L, %L)', adm, 'blocked'), '%CANNOT_CHANGE_OWN_STATUS%');

  -- M11 · Jugador no gestiona
  perform porra_test.as_user(d);
  perform porra_test.expect_error('M11 jugador crea código', format('select public.admin_create_invite_code(%L)', hotel), '%FORBIDDEN%');
  perform porra_test.expect_error('M11b jugador crea porra',
    format('insert into public.leagues (name, club_a_id, club_b_id) values (%L, %L, %L)', 'X', sevilla, betis), '%row-level security%');
  assert not exists (select 1 from public.league_members where user_id <> d), 'M11c jugador no ve membresías ajenas';
  reset role;

  raise exception 'ALL_TESTS_PASSED';
end $$;
