-- Atomic, authenticated-only addition of a single flashcard to an existing set.
--
-- Derives ownership from auth.uid() and locks the parent set row so concurrent
-- additions to the same set serialize and receive stable, gap-free positions.
-- The client never supplies user_id, set ownership, or position.

create or replace function public.add_flashcard(p_set_id uuid, p_front text, p_back text)
returns table (flashcard_id uuid, "position" integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_set_user_id uuid;
  v_position integer;
  v_flashcard_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_set_id is null then
    raise exception 'invalid set id' using errcode = '22023';
  end if;

  if p_front is null or btrim(p_front) = '' or char_length(btrim(p_front)) > 50000 then
    raise exception 'invalid flashcard front' using errcode = '22023';
  end if;

  if p_back is null or btrim(p_back) = '' or char_length(btrim(p_back)) > 50000 then
    raise exception 'invalid flashcard back' using errcode = '22023';
  end if;

  -- Lock the set row for the caller so concurrent inserts into the same set
  -- are serialized and never observe a stale max(position).
  select user_id
  into v_set_user_id
  from public.flashcard_sets
  where id = p_set_id
  for update;

  -- Non-disclosing: an unknown or foreign set is reported the same way.
  if v_set_user_id is null or v_set_user_id <> v_user_id then
    raise exception 'set not found' using errcode = '22023';
  end if;

  select coalesce(max(public.flashcards.position), -1) + 1
  into v_position
  from public.flashcards
  where set_id = p_set_id;

  insert into public.flashcards (user_id, set_id, front, back, position)
  values (v_user_id, p_set_id, btrim(p_front), btrim(p_back), v_position)
  returning id into v_flashcard_id;

  return query select v_flashcard_id, v_position;
end;
$$;

revoke all on function public.add_flashcard(uuid, text, text) from public, anon;
grant execute on function public.add_flashcard(uuid, text, text) to authenticated;
