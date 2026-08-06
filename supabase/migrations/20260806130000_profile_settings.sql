-- Profile settings: narrowly scoped profile updates.
--
-- Previously `authenticated` held a blanket UPDATE grant on public.profiles,
-- which let any user rewrite any column of their own row (id, avatar_url,
-- created_at, updated_at). This migration replaces that with a single scoped
-- RPC that:
--   - derives the owner from auth.uid() (never a client-supplied user_id),
--   - rejects anonymous callers,
--   - allows only display_name and timezone to change,
--   - validates the timezone against pg_timezone_names at the database
--     boundary (positive/negative offsets included),
--   - returns the canonical (trimmed) row so the client can render it back.
--
-- Direct UPDATE on public.profiles is revoked from authenticated; the RLS
-- update policy is dropped because there is no longer any direct update path.

create or replace function public.update_profile(p_display_name text, p_timezone text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_display_name text;
  v_row public.profiles;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  v_display_name := nullif(btrim(p_display_name), '');
  if v_display_name is not null and char_length(v_display_name) > 100 then
    raise exception 'invalid display name' using errcode = '22023';
  end if;

  if p_timezone is null
     or char_length(p_timezone) > 64
     or not exists (
       select 1 from pg_catalog.pg_timezone_names where name = p_timezone
     ) then
    raise exception 'invalid timezone' using errcode = '22023';
  end if;

  update public.profiles
  set display_name = v_display_name, timezone = p_timezone
  where id = v_user_id
  returning * into v_row;

  if not found then
    raise exception 'profile not found' using errcode = '22023';
  end if;

  return v_row;
end;
$$;

revoke all on function public.update_profile(text, text) from public, anon;
grant execute on function public.update_profile(text, text) to authenticated;

revoke update on table public.profiles from authenticated;
drop policy if exists "profiles_update_own" on public.profiles;
