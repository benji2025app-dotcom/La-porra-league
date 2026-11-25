-- LA PORRA LEAGUE · 004 · RLS y permisos
-- Principio: lectura mínima por RLS; escritura de pronósticos, bote y ganadores SOLO por RPC.

alter table public.profiles enable row level security;
alter table public.invite_codes enable row level security;
alter table public.seasons enable row level security;
alter table public.rounds enable row level security;
alter table public.fixtures enable row level security;
alter table public.predictions enable row level security;
alter table public.prediction_log enable row level security;
alter table public.pot_movements enable row level security;
alter table public.round_winners enable row level security;
alter table public.round_settlements enable row level security;

-- Permisos de tabla ------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on public.seasons, public.rounds, public.fixtures to authenticated;

-- Funciones ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_active_member() to authenticated;
grant execute on function private.fixture_locked(uuid) to authenticated;

grant execute on function public.check_invite_code(text) to anon, authenticated;
grant execute on function public.update_my_display_name(text) to authenticated;
grant execute on function public.submit_prediction(uuid, integer, integer) to authenticated;
grant execute on function public.get_round_submissions(uuid) to authenticated;
grant execute on function public.get_round_pot(uuid) to authenticated;
grant execute on function public.get_pot_balance() to authenticated;
grant execute on function public.get_leaderboard(uuid) to authenticated;
grant execute on function public.admin_list_members() to authenticated;
grant execute on function public.admin_set_member_status(uuid, public.member_status) to authenticated;
grant execute on function public.admin_set_member_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_create_invite_code(text, integer, timestamptz) to authenticated;
grant execute on function public.admin_set_invite_code_active(text, boolean) to authenticated;
grant execute on function public.admin_settle_round(uuid) to authenticated;
grant execute on function public.admin_void_round(uuid, text) to authenticated;
grant execute on function public.admin_reopen_round(uuid) to authenticated;
grant execute on function public.admin_replace_fixture(uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.admin_adjust_pot(bigint, text) to authenticated;

-- Políticas ----------------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_active_member()));

create policy invite_codes_admin_select on public.invite_codes for select to authenticated
  using ((select private.is_admin()));

create policy seasons_select on public.seasons for select to authenticated
  using ((select private.is_active_member()));
create policy seasons_admin_insert on public.seasons for insert to authenticated
  with check ((select private.is_admin()));
create policy seasons_admin_update on public.seasons for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy rounds_select on public.rounds for select to authenticated
  using ((select private.is_active_member()) and (status <> 'draft' or (select private.is_admin())));
create policy rounds_admin_insert on public.rounds for insert to authenticated
  with check ((select private.is_admin()));
create policy rounds_admin_update on public.rounds for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy rounds_admin_delete on public.rounds for delete to authenticated
  using ((select private.is_admin()));

create policy fixtures_select on public.fixtures for select to authenticated
  using (
    (select private.is_active_member())
    and exists (select 1 from public.rounds r
                where r.id = round_id and (r.status <> 'draft' or (select private.is_admin())))
  );
create policy fixtures_admin_insert on public.fixtures for insert to authenticated
  with check ((select private.is_admin()));
create policy fixtures_admin_update on public.fixtures for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy fixtures_admin_delete on public.fixtures for delete to authenticated
  using ((select private.is_admin()));

-- Pronósticos: los tuyos siempre; los ajenos solo desde el inicio del partido.
-- Ni siquiera el administrador ve los ajenos antes.
create policy predictions_select on public.predictions for select to authenticated
  using (
    user_id = (select auth.uid())
    or ((select private.is_active_member()) and private.fixture_locked(fixture_id))
  );

create policy prediction_log_select on public.prediction_log for select to authenticated
  using (
    user_id = (select auth.uid())
    or ((select private.is_active_member()) and private.fixture_locked(fixture_id))
  );

create policy pot_movements_select on public.pot_movements for select to authenticated
  using ((select private.is_active_member()));
create policy round_winners_select on public.round_winners for select to authenticated
  using ((select private.is_active_member()));
create policy round_settlements_select on public.round_settlements for select to authenticated
  using ((select private.is_active_member()));
