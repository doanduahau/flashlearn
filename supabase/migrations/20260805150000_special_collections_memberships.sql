-- Harden special collection writes and add narrowly scoped mutations.
--
-- Collections and memberships were previously exposed with broad table grants.
-- Mirror the flashcard_sets/flashcards hardening: revoke unrestricted writes and
-- expose only column-limited updates plus narrowly scoped RPCs. The client never
-- supplies user_id; ownership always derives from auth.uid().

revoke insert on table public.special_collections from authenticated;
revoke update on table public.special_collections from authenticated;
grant update (name, icon, color) on table public.special_collections to authenticated;

revoke insert on table public.special_collection_items from authenticated;
revoke update on table public.special_collection_items from authenticated;

-- ---------------------------------------------------------------------------
-- create_special_collection
-- ---------------------------------------------------------------------------
-- Derives ownership from auth.uid(). Duplicate names (case-insensitive per user)
-- are rejected by the existing unique index idx_special_collections_user_name and
-- surface as a 23505 unique violation handled by the server action.

create or replace function public.create_special_collection(p_name text, p_icon text default null, p_color text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_collection_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_name is null or btrim(p_name) = '' or char_length(btrim(p_name)) > 60 then
    raise exception 'invalid collection name' using errcode = '22023';
  end if;

  if p_icon is not null and char_length(p_icon) > 32 then
    raise exception 'invalid collection icon' using errcode = '22023';
  end if;

  if p_color is not null and char_length(p_color) > 32 then
    raise exception 'invalid collection color' using errcode = '22023';
  end if;

  insert into public.special_collections (user_id, name, icon, color)
  values (v_user_id, btrim(p_name), p_icon, p_color)
  returning id into v_collection_id;

  return v_collection_id;
end;
$$;

revoke all on function public.create_special_collection(text, text, text) from public, anon;
grant execute on function public.create_special_collection(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- set_card_collections
-- ---------------------------------------------------------------------------
-- Syncs the collection memberships of one flashcard owned by the caller to the
-- given collection ids. Memberships for collections not in the list are removed;
-- listed collections are added idempotently (on conflict do nothing). Collection
-- ids not owned by the caller are silently ignored, and a missing or foreign card
-- is reported with the same generic error (non-disclosing).

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

  if p_collection_ids is null then
    p_collection_ids := array[]::uuid[];
  end if;

  if not exists (
    select 1 from public.flashcards where id = p_card_id and user_id = v_user_id
  ) then
    raise exception 'card not found' using errcode = '22023';
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
