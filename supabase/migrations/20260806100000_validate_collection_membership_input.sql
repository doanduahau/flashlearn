-- Validate membership-sync input inside the SECURITY DEFINER boundary.
-- The client schema is not an authorization boundary: direct RPC callers must
-- not be able to clear memberships with null input or bypass the 50-id limit.

create or replace function public.set_card_collections(p_card_id uuid, p_collection_ids uuid[])
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_card_id is null then
    raise exception 'invalid card id' using errcode = '22023';
  end if;

  if p_collection_ids is null
    or cardinality(p_collection_ids) > 50
    or array_position(p_collection_ids, null::uuid) is not null then
    raise exception 'invalid collection ids' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.flashcards where id = p_card_id and user_id = v_user_id
  ) then
    raise exception 'card not found' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_collection_ids) as requested_collection(id)
    left join public.special_collections as sc
      on sc.id = requested_collection.id and sc.user_id = v_user_id
    where sc.id is null
  ) then
    raise exception 'collection not found' using errcode = '22023';
  end if;

  delete from public.special_collection_items
  where user_id = v_user_id
    and flashcard_id = p_card_id
    and not (collection_id = any (p_collection_ids));

  insert into public.special_collection_items (user_id, collection_id, flashcard_id)
  select v_user_id, sc.id, p_card_id
  from public.special_collections as sc
  where sc.user_id = v_user_id
    and sc.id = any (p_collection_ids)
  on conflict (collection_id, flashcard_id) do nothing;

  return 'ok';
end;
$$;

revoke all on function public.set_card_collections(uuid, uuid[]) from public, anon;
grant execute on function public.set_card_collections(uuid, uuid[]) to authenticated;
