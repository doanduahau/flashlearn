-- Atomic, authenticated-only import of normalized flashcards.
create or replace function public.import_flashcard_set(p_name text, p_cards jsonb)
returns table (set_id uuid, imported_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_set_id uuid;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_name is null or btrim(p_name) = '' or char_length(btrim(p_name)) > 120 then
    raise exception 'invalid set name' using errcode = '22023';
  end if;

  if jsonb_typeof(p_cards) <> 'array' or jsonb_array_length(p_cards) < 1 or jsonb_array_length(p_cards) > 2000 then
    raise exception 'invalid card count' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_cards) as card
    where jsonb_typeof(card) <> 'object'
      or nullif(btrim(card ->> 'front'), '') is null
      or nullif(btrim(card ->> 'back'), '') is null
      or char_length(btrim(card ->> 'front')) > 50000
      or char_length(btrim(card ->> 'back')) > 50000
  ) then
    raise exception 'invalid flashcard' using errcode = '22023';
  end if;

  insert into public.flashcard_sets (user_id, name)
  values (v_user_id, btrim(p_name))
  returning id into v_set_id;

  insert into public.flashcards (user_id, set_id, front, back, position)
  select
    v_user_id,
    v_set_id,
    btrim(card.value ->> 'front'),
    btrim(card.value ->> 'back'),
    card.ordinality - 1
  from jsonb_array_elements(p_cards) with ordinality as card(value, ordinality);

  get diagnostics v_count = row_count;
  return query select v_set_id, v_count;
end;
$$;

revoke all on function public.import_flashcard_set(text, jsonb) from public, anon;
grant execute on function public.import_flashcard_set(text, jsonb) to authenticated;
