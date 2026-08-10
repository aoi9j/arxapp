-- ARX · ACCESO PRIVADO
-- Ejecuta este archivo UNA VEZ en Supabase > SQL Editor.
-- No contiene las claves de Supabase.

create extension if not exists pgcrypto with schema extensions;

alter table public.profiles
  add column if not exists role text not null default 'member',
  add column if not exists access_verified_at timestamptz;

-- Solo se permiten estos dos roles.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('member','founder'));

-- La app solo necesita poder editar los datos normales del perfil.
-- El rol y la fecha de acceso los modifica únicamente la función segura de abajo.
revoke update on public.profiles from anon, authenticated;
grant update (display_name, bio, avatar_url, interests) on public.profiles to authenticated;

-- Valida el código sin enviar los códigos al navegador ni guardarlos en el HTML.
-- Los códigos se comparan mediante SHA-256.
create or replace function public.verify_arx_access_code(p_code text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_role text;
  v_uid uuid := auth.uid();
  v_hash text := encode(extensions.digest(upper(trim(coalesce(p_code,''))), 'sha256'), 'hex');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if v_hash = '177a5351e5782456bd008934596eea888dca4a1cf486e9bdd48b77dfbc4b7489' then
    v_role := 'founder';
  elsif v_hash = '9fbc54d717eef10c3f017485398c40937b410bfb141ddd8df1d158dd3a302da4' then
    v_role := 'member';
  else
    return null;
  end if;

  update public.profiles
     set role = v_role,
         access_verified_at = now()
   where id = v_uid;

  if not found then
    raise exception 'profile_not_found';
  end if;

  return v_role;
end;
$$;

revoke all on function public.verify_arx_access_code(text) from public;
grant execute on function public.verify_arx_access_code(text) to authenticated;

-- Protección adicional: aunque alguien intente manipular el perfil desde el navegador,
-- no podrá cambiar role/access_verified_at mediante un UPDATE normal.
create or replace function public.protect_arx_access_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.access_verified_at is distinct from old.access_verified_at)
     and current_setting('request.jwt.claim.role', true) <> 'service_role' then
    -- Solo la función verify_arx_access_code debe establecer estos campos.
    -- PostgreSQL ejecuta esa función como su propietario.
    if current_user <> 'postgres' then
      raise exception 'access_fields_protected';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_arx_access_fields on public.profiles;
create trigger protect_arx_access_fields
before update on public.profiles
for each row execute function public.protect_arx_access_fields();

-- Recarga de esquema para que el RPC quede disponible inmediatamente.
notify pgrst, 'reload schema';
