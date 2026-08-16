-- Additive: expose share_classroom_enabled through the public preview RPC.
--
-- S3 needs the classroom flag on the preview page (banner) and S4 needs it
-- when cloning. get_shared_set_by_token previously did not return it.
--
-- CREATE OR REPLACE FUNCTION cannot change a function's return type, so the
-- function is dropped and recreated with one extra output column and one extra
-- select field. The signature (p_token text), search_path and SECURITY
-- DEFINER flag are unchanged, and the grants are restored to the exact same
-- set as before (authenticated + service_role, never anon/public).

drop function public.get_shared_set_by_token(p_token text);

create function public.get_shared_set_by_token(p_token text)
returns table (
  set_id uuid,
  name text,
  description text,
  created_at timestamptz,
  owner_display_name text,
  card_count bigint,
  share_classroom_enabled boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    raise exception 'invalid share token' using errcode = '22023';
  end if;

  return query
    select
      s.id,
      s.name,
      s.description,
      s.created_at,
      p.display_name,
      (
        select count(*)::bigint
        from public.flashcards f
        where f.set_id = s.id and f.user_id = s.user_id
      ) as card_count,
      s.share_classroom_enabled
    from public.flashcard_sets s
    left join public.profiles p on p.id = s.user_id
    where s.share_token = p_token;
end;
$$;

comment on function public.get_shared_set_by_token(text) is
  'Returns public metadata for the set behind a valid share token: id, name, description, created_at, owner display name, card count and classroom flag. Owner user_id is never returned. Invalid token shape raises 22023; an unknown token returns an empty set. Authenticated only.';

revoke all on function public.get_shared_set_by_token(text) from public, anon;
grant execute on function public.get_shared_set_by_token(text) to authenticated;
grant execute on function public.get_shared_set_by_token(text) to service_role;