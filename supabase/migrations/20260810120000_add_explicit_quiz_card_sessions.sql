-- Smart Review reuses quiz snapshots and answer handling, but its target cards
-- are selected by the mastery domain rather than a set/collection configuration.
-- Normal quiz creation still enforces its existing 10-question product minimum.
alter table public.quiz_sessions
  drop constraint if exists quiz_sessions_requested_question_count_check,
  drop constraint if exists quiz_sessions_actual_question_count_check;

alter table public.quiz_sessions
  add constraint quiz_sessions_requested_question_count_check
    check (requested_question_count between 1 and 100),
  add constraint quiz_sessions_actual_question_count_check
    check (actual_question_count between 1 and 100);

-- This is intentionally a general explicit-target primitive. The browser never
-- receives this list from Smart Review: its server action derives fresh ordered
-- candidates from the authenticated user's MasterySnapshot immediately before
-- calling this RPC. Distractors are active cards from the owner's full library,
-- while only p_card_ids become quiz questions and later review events.
create or replace function public.create_quiz_session_from_card_ids(p_card_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_card record;
  v_choices jsonb;
  v_correct_index integer;
  v_position integer := 0;
  v_target_ids uuid[];
  v_target_count integer;
  v_distinct_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_card_ids is null
     or cardinality(p_card_ids) not between 1 and 10
     or array_position(p_card_ids, null) is not null then
    raise exception 'invalid explicit quiz request' using errcode = '22023';
  end if;

  select count(distinct input.id) into v_distinct_count
  from unnest(p_card_ids) as input(id);
  if v_distinct_count <> cardinality(p_card_ids) then
    raise exception 'invalid explicit quiz request' using errcode = '22023';
  end if;

  -- Revalidate the selected IDs at the write boundary. A card deleted between
  -- candidate loading and this RPC is excluded, never resurrected from history.
  select
    coalesce(array_agg(f.id order by input.ordinality), '{}'::uuid[]),
    count(*)::integer
  into v_target_ids, v_target_count
  from unnest(p_card_ids) with ordinality as input(id, ordinality)
  join public.flashcards f
    on f.id = input.id
   and f.user_id = v_user_id;

  if v_target_count = 0 then
    raise exception 'no active explicit quiz cards' using errcode = '22023';
  end if;

  insert into public.quiz_sessions (
    user_id,
    mode,
    requested_question_count,
    actual_question_count,
    source_set_ids,
    source_collection_ids,
    source_all
  ) values (
    v_user_id,
    'balanced',
    v_target_count,
    v_target_count,
    '{}'::uuid[],
    '{}'::uuid[],
    true
  ) returning id into v_session_id;

  for v_card in
    select f.id, f.front, f.back
    from unnest(v_target_ids) with ordinality as target(id, ordinality)
    join public.flashcards f on f.id = target.id and f.user_id = v_user_id
    order by target.ordinality
  loop
    select jsonb_agg(choice order by ordering) into v_choices
    from (
      select choice, ordering from (
        select v_card.back as choice, md5(v_card.id::text || v_card.back) as ordering
        union all
        select back, md5(id::text || v_session_id::text)
        from (
          select distinct on (lower(regexp_replace(btrim(f.back), '\\s+', ' ', 'g'))) f.id, f.back
          from public.flashcards f
          where f.user_id = v_user_id
            and lower(regexp_replace(btrim(f.back), '\\s+', ' ', 'g'))
              <> lower(regexp_replace(btrim(v_card.back), '\\s+', ' ', 'g'))
          order by
            lower(regexp_replace(btrim(f.back), '\\s+', ' ', 'g')),
            md5(f.id::text || v_session_id::text)
        ) distractors
        limit 3
      ) choices
    ) ordered;

    if jsonb_array_length(v_choices) < 2 then
      raise exception 'not enough choices' using errcode = '22023';
    end if;

    select ordinality - 1 into v_correct_index
    from jsonb_array_elements_text(v_choices) with ordinality
    where value = v_card.back
    limit 1;

    insert into public.quiz_questions (
      session_id,
      user_id,
      position,
      flashcard_id,
      source_flashcard_id,
      prompt,
      correct_answer,
      choices,
      correct_choice_index
    ) values (
      v_session_id,
      v_user_id,
      v_position,
      v_card.id,
      v_card.id,
      v_card.front,
      v_card.back,
      v_choices,
      v_correct_index
    );
    v_position := v_position + 1;
  end loop;

  return v_session_id;
end;
$$;

-- Keep the raw explicit-card entry point private from the migration that first
-- introduces it. A later server-only wrapper is the sole callable boundary.
-- Revoking service_role here prevents privileged callers from bypassing that
-- wrapper and supplying card IDs without its trusted owner scope.
revoke all on function public.create_quiz_session_from_card_ids(uuid[]) from public, anon, authenticated, service_role;
