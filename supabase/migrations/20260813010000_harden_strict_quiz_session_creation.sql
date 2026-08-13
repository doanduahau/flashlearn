-- Strict quiz pools are coverage-sensitive.  Serialize source-scoped manual
-- Quiz creation with the same per-user/mode advisory lock used by coverage
-- completion, and fail closed if the selected pool ever changes mid-call.
--
-- This is an additive correction to 20260813000000.  It leaves the published
-- migration immutable while ensuring requested_question_count always matches
-- the persisted question snapshots.

create or replace function public.create_quiz_session(
  p_mode text,
  p_set_ids uuid[],
  p_collection_ids uuid[],
  p_all boolean,
  p_question_count integer
)
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
  v_eligible_count integer;
  v_strict_count integer;
  v_set_ids uuid[] := coalesce(p_set_ids, '{}'::uuid[]);
  v_collection_ids uuid[] := coalesce(p_collection_ids, '{}'::uuid[]);
  v_scope_card_ids uuid[];
  v_session_card_ids uuid[];
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_mode not in ('balanced', 'never_tested', 'wrong_answers', 'pure_random')
     or p_question_count is null or p_question_count not between 1 and 100
     or p_all is null or cardinality(v_set_ids) + cardinality(v_collection_ids) > 50
     or (not p_all and cardinality(v_set_ids) + cardinality(v_collection_ids) = 0)
     or (p_all and cardinality(v_set_ids) + cardinality(v_collection_ids) > 0)
     or (cardinality(v_set_ids) > 0 and cardinality(v_collection_ids) > 0)
     or array_position(v_set_ids, null) is not null or array_position(v_collection_ids, null) is not null then
    raise exception 'invalid quiz request' using errcode = '22023';
  end if;

  if exists (select 1 from unnest(v_set_ids) as input(id) where not exists (select 1 from public.flashcard_sets s where s.id = input.id and s.user_id = v_user_id))
     or exists (select 1 from unnest(v_collection_ids) as input(id) where not exists (select 1 from public.special_collections c where c.id = input.id and c.user_id = v_user_id)) then
    raise exception 'source not found' using errcode = '22023';
  end if;

  -- Coverage completion takes this same lock before inserting or resetting
  -- flashcard_coverage.  Hold it across strict-pool counting and selection so
  -- a completed Quiz cannot shrink the pool between those two statements.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_user_id::text || ':quiz')
  );

  select coalesce(array_agg(f.id order by f.id), '{}'::uuid[]) into v_scope_card_ids
  from public.flashcards f
  where f.user_id = v_user_id
    and (p_all or f.set_id = any(v_set_ids) or exists (
      select 1 from public.special_collection_items i
      where i.flashcard_id = f.id and i.user_id = v_user_id and i.collection_id = any(v_collection_ids)
    ));

  select count(*) into v_eligible_count
  from public.flashcards f
  where f.id = any(v_scope_card_ids)
    and (select count(distinct lower(regexp_replace(btrim(other.back), '\\s+', ' ', 'g')))
         from public.flashcards other where other.id = any(v_scope_card_ids)) >= 2;

  if p_question_count > v_eligible_count then raise exception 'not enough eligible cards' using errcode = '22023'; end if;

  if p_mode = 'never_tested' then
    select count(*) into v_strict_count
    from public.flashcards f
    where f.id = any(v_scope_card_ids)
      and not exists (
        select 1 from public.flashcard_coverage c
        where c.user_id = v_user_id and c.mode = 'quiz' and c.flashcard_id = f.id
      );
    if p_question_count > v_strict_count then
      raise exception 'not enough eligible cards' using errcode = '22023';
    end if;
  elsif p_mode = 'wrong_answers' then
    select count(*) into v_strict_count
    from public.flashcards f
    where f.id = any(v_scope_card_ids)
      and exists (
        select 1 from public.quiz_questions q
        join public.quiz_sessions s on s.id = q.session_id
        where q.flashcard_id = f.id and q.user_id = v_user_id
          and s.completed_at is not null and q.is_correct = false
      );
    if p_question_count > v_strict_count then
      raise exception 'not enough eligible cards' using errcode = '22023';
    end if;
  end if;

  insert into public.quiz_sessions (user_id, mode, requested_question_count, actual_question_count, source_set_ids, source_collection_ids, source_all)
  values (v_user_id, p_mode, p_question_count, p_question_count, v_set_ids, v_collection_ids, p_all)
  returning id into v_session_id;

  for v_card in
    with eligible as (
      select f.id, f.front, f.back,
        exists (
          select 1 from public.flashcard_coverage coverage
          where coverage.user_id = v_user_id and coverage.mode = 'quiz' and coverage.flashcard_id = f.id
        ) as has_quiz_coverage,
        count(q.id) filter (where s.completed_at is not null) as completed_count,
        count(q.id) filter (where s.completed_at is not null and q.is_correct = false) as wrong_count,
        max(q.answered_at) filter (where s.completed_at is not null) as last_tested_at,
        coalesce(bool_or(s.id = (select ls.id from public.quiz_sessions ls where ls.user_id = v_user_id and ls.completed_at is not null order by ls.completed_at desc limit 1)), false) as in_last_quiz
      from public.flashcards f
      left join public.quiz_questions q on q.flashcard_id = f.id and q.user_id = v_user_id
      left join public.quiz_sessions s on s.id = q.session_id
      where f.id = any(v_scope_card_ids)
      group by f.id, f.front, f.back
    )
    select * from eligible
    where (p_mode <> 'never_tested' or has_quiz_coverage = false)
      and (p_mode <> 'wrong_answers' or wrong_count > 0)
    order by
      case when has_quiz_coverage then 1 else 0 end,
      case when p_mode = 'wrong_answers' then case when wrong_count > 0 then 0 else 1 end else 0 end,
      case when p_mode = 'wrong_answers' then wrong_count end desc,
      case when p_mode = 'wrong_answers' then wrong_count::numeric / nullif(completed_count, 0) end desc,
      case when p_mode = 'never_tested' then case when completed_count = 0 then 0 else 1 end else 0 end,
      case when p_mode <> 'pure_random' then case when completed_count = 0 then 0 else 1 end else 0 end,
      case when p_mode <> 'pure_random' then case when in_last_quiz then 1 else 0 end else 0 end,
      case when p_mode <> 'pure_random' then completed_count end asc,
      case when p_mode <> 'pure_random' then last_tested_at end asc nulls first,
      case when p_mode <> 'pure_random' then wrong_count::numeric / nullif(completed_count, 0) end desc,
      case when p_mode = 'pure_random' then random() else null end,
      md5(id::text || v_session_id::text)
    limit p_question_count
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
    values (v_session_id, v_user_id, v_position, v_card.id, v_card.id, v_card.front, v_card.back, v_choices, v_correct_index);
    v_position := v_position + 1;
  end loop;

  -- Never persist a session whose declared count differs from its question
  -- snapshots.  This is a final fail-closed guard for concurrent source/card
  -- changes and rolls back the session, questions, and coverage ledger.
  if v_position <> p_question_count then
    raise exception 'not enough eligible cards' using errcode = '22023';
  end if;

  select coalesce(array_agg(q.source_flashcard_id order by q.position), '{}'::uuid[]) into v_session_card_ids
  from public.quiz_questions q where q.session_id = v_session_id;

  perform public.create_learning_coverage_session(
    v_user_id, 'quiz', v_session_card_ids, v_scope_card_ids, v_session_id
  );
  return v_session_id;
end;
$$;

revoke all on function public.create_quiz_session(text, uuid[], uuid[], boolean, integer) from public, anon;
grant execute on function public.create_quiz_session(text, uuid[], uuid[], boolean, integer) to authenticated;
