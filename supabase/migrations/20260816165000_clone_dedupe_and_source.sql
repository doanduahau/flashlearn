-- S8: prevent duplicate clones of the same shared set and track clone provenance.
--
-- Additive migration:
--   1. source_share_token column on flashcard_sets records which share link a
--      clone came from (provenance). Nullable, not unique (one link can have
--      many clones). Never exposed through get_shared_set_by_token.
--   2. clone_shared_set is dropped and recreated because its return type
--      changes (extra already_exists output column). Same pattern as S3
--      (20260816120000_add_classroom_flag_to_shared_preview.sql): the
--      signature, SECURITY DEFINER, empty search_path and grants are restored
--      to exactly the same set as before (service_role only).
--
-- New clone_shared_set semantics:
--   - Classroom link: if the user already has a live membership
--     (set_id, member_user_id) whose clone still exists and is owned by the
--     user, do NOT create a new clone; return the existing clone with
--     already_exists = true. The membership is never re-pointed. If the
--     student deleted the clone, fall through and create a fresh one
--     (register_set_membership upserts the membership back to the new clone).
--   - Plain link: if the user already owns a clone with the same
--     source_share_token, return that clone (earliest created) with
--     already_exists = true.
--   - Otherwise create a new independent snapshot (front/back/position only,
--     2000-card limit unchanged) recording source_share_token, and register
--     the classroom membership in the same transaction when classroom is ON.
--   - An advisory lock on (token, user) serializes concurrent clones so the
--     duplicate checks cannot race.
--
-- Grants: service_role only (the server action calls through the admin
-- client). RLS is untouched.

alter table public.flashcard_sets
  add column source_share_token text;

create index idx_flashcard_sets_source_share_token
  on public.flashcard_sets(source_share_token)
  where source_share_token is not null;

comment on column public.flashcard_sets.source_share_token is
  'Share token of the link this set was cloned from (provenance). Null for sets created directly. Never exposed to clients.';

drop function public.clone_shared_set(p_token text, p_user_id uuid);

create function public.clone_shared_set(
  p_token text,
  p_user_id uuid
)
returns table (new_set_id uuid, already_exists boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.flashcard_sets%rowtype;
  v_card_count bigint;
  v_new_set_id uuid;
  v_existing uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    raise exception 'invalid share token' using errcode = '22023';
  end if;

  if p_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- Serialize concurrent clones of the same link by the same user so the
  -- duplicate checks below cannot race.
  perform pg_advisory_xact_lock(hashtext('clone_shared_set:' || p_token || ':' || p_user_id::text));

  select *
  into v_source
  from public.flashcard_sets
  where share_token = p_token;

  if not found then
    raise exception 'link not found or disabled' using errcode = '42501';
  end if;

  if v_source.share_classroom_enabled then
    -- Already joined: return the existing clone without creating a new one.
    -- The join with flashcard_sets guarantees the clone still exists and is
    -- owned by the member; if the student deleted the clone, no row is found
    -- and we fall through to create a fresh one.
    select m.clone_set_id
    into v_existing
    from public.shared_set_memberships m
    join public.flashcard_sets f
      on f.id = m.clone_set_id and f.user_id = m.member_user_id
    where m.set_id = v_source.id and m.member_user_id = p_user_id;

    if found then
      return query select v_existing, true;
      return;
    end if;
  else
    -- Already saved a plain clone from this link: return the earliest copy.
    select id
    into v_existing
    from public.flashcard_sets
    where user_id = p_user_id and source_share_token = p_token
    order by created_at asc
    limit 1;

    if found then
      return query select v_existing, true;
      return;
    end if;
  end if;

  select count(*) into v_card_count
  from public.flashcards
  where set_id = v_source.id and user_id = v_source.user_id;

  if v_card_count > 2000 then
    raise exception 'Bộ này vượt quá giới hạn 2000 thẻ' using errcode = '22023';
  end if;

  insert into public.flashcard_sets (user_id, name, description, source_share_token)
  values (p_user_id, v_source.name, v_source.description, p_token)
  returning id into v_new_set_id;

  insert into public.flashcards (user_id, set_id, front, back, position)
  select p_user_id, v_new_set_id, front, back, position
  from public.flashcards
  where set_id = v_source.id and user_id = v_source.user_id
  order by position asc;

  if v_source.share_classroom_enabled then
    perform public.register_set_membership(p_token, v_new_set_id, p_user_id);
  end if;

  return query select v_new_set_id, false;
end;
$$;

comment on function public.clone_shared_set(text, uuid) is
  'Clones a shared set as an independent snapshot for the given user (front/back/position only, max 2000 cards) and records the source share token on the clone. If the user already joined a classroom link (live membership whose clone still exists) or already saved a plain clone from the same link, returns the existing clone with already_exists = true instead of creating a duplicate. Classroom clones also record a membership via register_set_membership in the same transaction. Service-role only.';

revoke all on function public.clone_shared_set(text, uuid) from public, anon, authenticated;
grant execute on function public.clone_shared_set(text, uuid) to service_role;
