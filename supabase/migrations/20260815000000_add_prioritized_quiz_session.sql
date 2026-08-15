-- Manual Quiz with server-selected prioritized cards (wrong -> unseen -> random).
--
-- The browser must not nominate arbitrary question cards. The public manual Quiz
-- RPC (create_quiz_session) keeps its balanced/strict modes. This service-role
-- boundary receives an exact ordered card list and the scope it was selected
-- from, validates ownership/scope membership at the write boundary, then builds
-- the same immutable quiz snapshot with distractors drawn from the scope.
--
-- Origin stays the safe manual default through the existing
-- set_quiz_session_origin trigger; no caller-supplied origin is accepted.

create or replace function public.create_quiz_session_prioritized(
  p_user_id uuid,
  p_card_ids uuid[],
  p_scope_card_ids uuid[],
  p_question_count integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_card record;
  v_choices jsonb;
  v_correct_index integer;
  v_position integer := 0;
  v_session_card_ids uuid[];
  v_card_ids uuid[] := coalesce(p_card_ids, '{}'::uuid[]);
  v_scope_card_ids uuid[] := coalesce(p_scope_card_ids, '{}'::uuid[]);
begin
  if p_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_question_count is null or p_question_count not between 1 and 100
     or cardinality(v_card_ids) = 0
     or cardinality(v_scope_card_ids) = 0
     or cardinality(v_card_ids) <> p_question_count
     or array_position(v_card_ids, null) is not null
     or array_position(v_scope_card_ids, null) is not null
     or cardinality(v_card_ids) <> cardinality(array(select distinct id from unnest(v_card_ids) as input(id)))
     or cardinality(v_scope_card_ids) <> cardinality(array(select distinct id from unnest(v_scope_card_ids) as input(id)))
     or exists (select 1 from unnest(v_card_ids) as input(id) where not input.id = any(v_scope_card_ids)) then
    raise exception 'invalid prioritized quiz request' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_scope_card_ids) as input(id)
    where not exists (
      select 1 from public.flashcards f where f.id = input.id and f.user_id = p_user_id
    )
  ) then
    raise exception 'quiz cards not owned' using errcode = '42501';
  end if;

  insert into public.quiz_sessions (user_id, mode, requested_question_count, actual_question_count, source_set_ids, source_collection_ids, source_all)
  values (p_user_id, 'balanced', p_question_count, p_question_count, '{}'::uuid[], '{}'::uuid[], true)
  returning id into v_session_id;

  for v_card in
    select f.id, f.front, f.back
    from unnest(v_card_ids) with ordinality as input(id, ordinality)
    join public.flashcards f on f.id = input.id and f.user_id = p_user_id
    order by input.ordinality
  loop
    select jsonb_agg(choice order by ordering) into v_choices
    from (
      select choice, ordering from (
        select v_card.back as choice, md5(v_card.id::text || v_card.back) as ordering
        union all
        select back, md5(v_card.id::text || id::text)
        from (
          select distinct on (lower(regexp_replace(btrim(f.back), '\\s+', ' ', 'g'))) f.id, f.back
          from public.flashcards f
          where f.id = any(v_scope_card_ids)
            and lower(regexp_replace(btrim(f.back), '\\s+', ' ', 'g')) <> lower(regexp_replace(btrim(v_card.back), '\\s+', ' ', 'g'))
          order by lower(regexp_replace(btrim(f.back), '\\s+', ' ', 'g')), md5(f.id::text || v_session_id::text)
        ) distractors limit 3
      ) choices
    ) ordered;

    select ordinality - 1 into v_correct_index from jsonb_array_elements_text(v_choices) with ordinality where value = v_card.back limit 1;
    if jsonb_array_length(v_choices) < 2 then raise exception 'not enough choices' using errcode = '22023'; end if;

    insert into public.quiz_questions (session_id, user_id, position, flashcard_id, source_flashcard_id, prompt, correct_answer, choices, correct_choice_index)
    values (v_session_id, p_user_id, v_position, v_card.id, v_card.id, v_card.front, v_card.back, v_choices, v_correct_index);
    v_position := v_position + 1;
  end loop;

  if v_position <> p_question_count then
    raise exception 'not enough eligible cards' using errcode = '22023';
  end if;

  select coalesce(array_agg(q.source_flashcard_id order by q.position), '{}'::uuid[]) into v_session_card_ids
  from public.quiz_questions q where q.session_id = v_session_id;

  perform public.create_learning_coverage_session(
    p_user_id, 'quiz', v_session_card_ids, v_scope_card_ids, v_session_id
  );
  return v_session_id;
end;
$$;

comment on function public.create_quiz_session_prioritized(uuid, uuid[], uuid[], integer) is
  'Trusted manual Quiz creation from a server-selected ordered card list. Validates that every question card is owned, distinct, and within the given scope, then snapshots questions with distractors drawn from the scope. Service-role only; the browser never supplies question card ids directly.';

revoke all on function public.create_quiz_session_prioritized(uuid, uuid[], uuid[], integer) from public, anon, authenticated;
grant execute on function public.create_quiz_session_prioritized(uuid, uuid[], uuid[], integer) to service_role;