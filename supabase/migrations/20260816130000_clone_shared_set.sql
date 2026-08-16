-- S4: clone a shared set into the requesting user's account.
--
-- Additive migration: adds a single SECURITY DEFINER RPC. No schema changes.
--
-- Semantics:
--   - The clone is an independent snapshot: the new set keeps the original
--     name and description, and only front/back/position are copied. No
--     mastery, stats, special collections or learning history are copied.
--   - Limit of 2000 cards (mirrors IMPORT_MAX_ROWS). Manual card inserts can
--     push a set above the import cap, so the guard lives here too.
--   - Classroom mode: when the shared link has share_classroom_enabled = true
--     the clone also records a membership through the existing
--     register_set_membership RPC inside the same transaction, so a failure
--     rolls back both the clone and the membership.
--   - Grants: service_role only (the server action calls through the admin
--     client). RLS is untouched.

create or replace function public.clone_shared_set(
  p_token text,
  p_user_id uuid
)
returns table (new_set_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.flashcard_sets%rowtype;
  v_card_count bigint;
  v_new_set_id uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    raise exception 'invalid share token' using errcode = '22023';
  end if;

  if p_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select *
  into v_source
  from public.flashcard_sets
  where share_token = p_token;

  if not found then
    raise exception 'link not found or disabled' using errcode = '42501';
  end if;

  select count(*) into v_card_count
  from public.flashcards
  where set_id = v_source.id and user_id = v_source.user_id;

  if v_card_count > 2000 then
    raise exception 'Bộ này vượt quá giới hạn 2000 thẻ' using errcode = '22023';
  end if;

  insert into public.flashcard_sets (user_id, name, description)
  values (p_user_id, v_source.name, v_source.description)
  returning id into v_new_set_id;

  insert into public.flashcards (user_id, set_id, front, back, position)
  select p_user_id, v_new_set_id, front, back, position
  from public.flashcards
  where set_id = v_source.id and user_id = v_source.user_id
  order by position asc;

  if v_source.share_classroom_enabled then
    perform public.register_set_membership(p_token, v_new_set_id, p_user_id);
  end if;

  return query select v_new_set_id;
end;
$$;

comment on function public.clone_shared_set(text, uuid) is
  'Clones a shared set as an independent snapshot for the given user: the new set keeps the original name and description, and cards are copied with only front, back and position (no mastery, stats, collections or history). Enforces a 2000-card limit. When the shared link is in classroom mode, also records a classroom membership via register_set_membership in the same transaction. Service-role only.';

revoke all on function public.clone_shared_set(text, uuid) from public, anon, authenticated;
grant execute on function public.clone_shared_set(text, uuid) to service_role;

-- Additive grant: the S1 migration enabled RLS on shared_set_memberships with
-- an owner-only select policy but granted no table privileges to service_role.
-- The server (admin client) needs to read memberships for the classroom stats
-- flow (S6/S7) and for verification. service_role bypasses RLS, so this does
-- not open any data to anon/authenticated. Mirrors daily_learning_records.
grant all on table public.shared_set_memberships to service_role;