-- Persist a user-owned order for regular flashcard sets. Existing sets retain
-- the current newest-first display order as their initial custom order.

alter table public.flashcard_sets
  add column sort_order bigint;

with ranked_sets as (
  select
    id,
    row_number() over (partition by user_id order by created_at desc, id asc) * 1024 as sort_order
  from public.flashcard_sets
)
update public.flashcard_sets as sets
set sort_order = ranked_sets.sort_order
from ranked_sets
where ranked_sets.id = sets.id;

alter table public.flashcard_sets
  alter column sort_order set default 0,
  alter column sort_order set not null;

create index idx_flashcard_sets_user_sort_order
  on public.flashcard_sets (user_id, sort_order asc, id asc);

-- New imports are placed at the front of the user's order. A per-user
-- transaction advisory lock serializes imports with reordering without
-- renumbering the full collection.
create or replace function public.import_flashcard_set(p_name text, p_cards jsonb)
returns table (set_id uuid, imported_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_set_id uuid;
  v_sort_order bigint;
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 70123)
  );

  select coalesce(min(sort_order), 1024) - 1024
  into v_sort_order
  from public.flashcard_sets
  where user_id = v_user_id;

  insert into public.flashcard_sets (user_id, name, sort_order)
  values (v_user_id, btrim(p_name), v_sort_order)
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

-- Move one owned set by swapping only its rank with its adjacent neighbor.
-- Ownership is derived from auth.uid(), and the advisory lock prevents two
-- simultaneous moves for the same user's library from observing stale ranks.
create or replace function public.move_flashcard_set(p_set_id uuid, p_direction text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_order bigint;
  v_neighbor_id uuid;
  v_neighbor_order bigint;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_set_id is null or p_direction not in ('up', 'down') then
    raise exception 'invalid reorder request' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 70123)
  );

  select sort_order
  into v_current_order
  from public.flashcard_sets
  where id = p_set_id and user_id = v_user_id
  for update;

  if v_current_order is null then
    raise exception 'set not found' using errcode = '22023';
  end if;

  if p_direction = 'up' then
    select id, sort_order
    into v_neighbor_id, v_neighbor_order
    from public.flashcard_sets
    where user_id = v_user_id
      and (sort_order < v_current_order or (sort_order = v_current_order and id < p_set_id))
    order by sort_order desc, id desc
    limit 1
    for update;
  else
    select id, sort_order
    into v_neighbor_id, v_neighbor_order
    from public.flashcard_sets
    where user_id = v_user_id
      and (sort_order > v_current_order or (sort_order = v_current_order and id > p_set_id))
    order by sort_order asc, id asc
    limit 1
    for update;
  end if;

  if v_neighbor_id is null then
    return;
  end if;

  update public.flashcard_sets
  set sort_order = v_neighbor_order
  where id = p_set_id and user_id = v_user_id;

  update public.flashcard_sets
  set sort_order = v_current_order
  where id = v_neighbor_id and user_id = v_user_id;
end;
$$;

revoke all on function public.move_flashcard_set(uuid, text) from public, anon;
grant execute on function public.move_flashcard_set(uuid, text) to authenticated;
