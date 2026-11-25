-- LA PORRA LEAGUE · Inicio con Google
-- Con Google no hay formulario previo: el usuario se crea pendiente y SIN código;
-- después debe canjear un código (redeem_invite_code) y el admin solo puede aprobar a quien lo haya canjeado.

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

  -- Proveedor externo (Google): se crea pendiente y sin código; lo canjeará después.
  if v_provider <> 'email' and v_code = '' then
    insert into public.profiles (id, display_name) values (new.id, v_name);
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

create or replace function public.redeem_invite_code(p_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_profile public.profiles;
  v_ok boolean;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_profile.invite_code is not null or v_profile.status <> 'pending' then
    return; -- ya canjeado o ya aprobado: nada que hacer
  end if;

  update public.invite_codes
     set used_count = used_count + 1
   where code = v_code
     and is_active
     and (expires_at is null or expires_at > now())
     and (max_uses is null or used_count < max_uses)
  returning true into v_ok;

  if not coalesce(v_ok, false) then
    raise exception 'INVALID_INVITE_CODE';
  end if;

  update public.profiles set invite_code = v_code where id = auth.uid();
end;
$$;

-- Aprobar exige que el jugador haya canjeado un código.
create or replace function public.admin_set_member_status(p_user_id uuid, p_status public.member_status)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles;
begin
  perform private.assert_admin();
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_CHANGE_OWN_STATUS';
  end if;
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_status = 'active' and v_profile.invite_code is null and v_profile.approved_at is null then
    raise exception 'INVITE_CODE_REQUIRED: el jugador aún no ha canjeado un código de invitación';
  end if;
  update public.profiles
     set status = p_status,
         approved_at = case when p_status = 'active' then coalesce(approved_at, now()) else approved_at end
   where id = p_user_id;
end;
$$;

revoke execute on function public.redeem_invite_code(text) from public, anon;
grant execute on function public.redeem_invite_code(text) to authenticated;
