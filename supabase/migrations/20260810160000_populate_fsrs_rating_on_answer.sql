-- Populate fsrs_rating atomically inside the immutable card_review_event insert
-- and extend the RPC return so the trusted server action can reconcile the
-- affected card into its shadow FSRS projection. No browser-controlled FSRS
-- values are accepted; ratings derive exclusively from the correct-index
-- comparison already performed server-side.

-- The return type changes (two new OUT columns), so the existing signature
-- must be dropped before the replacement can be created.
drop function if exists public.submit_quiz_answer(uuid, integer);

create function public.submit_quiz_answer(
  p_question_id uuid,
  p_selected_choice_index integer
)
returns table(
  session_id uuid,
  is_correct boolean,
  completed boolean,
  flashcard_id uuid,
  review_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_question public.quiz_questions;
  v_answered integer;
  v_completed_at timestamptz;
  v_answered_at timestamptz;
  v_timezone text := 'Asia/Ho_Chi_Minh';
  v_local_date date;
  v_question_count integer;
  v_correct_count integer;
  v_is_correct boolean;
  v_event_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_question_id is null
     or p_selected_choice_index is null
     or p_selected_choice_index not between 0 and 3 then
    raise exception 'invalid answer' using errcode = '22023';
  end if;

  select q.* into v_question
  from public.quiz_questions q
  join public.quiz_sessions s on s.id = q.session_id
  where q.id = p_question_id
    and q.user_id = v_user_id
    and s.user_id = v_user_id
    and s.completed_at is null
  for update of q, s;

  if not found
     or v_question.answered_at is not null
     or p_selected_choice_index >= jsonb_array_length(v_question.choices) then
    raise exception 'question not found' using errcode = '22023';
  end if;

  v_answered_at := now();
  v_is_correct := p_selected_choice_index = v_question.correct_choice_index;

  update public.quiz_questions
  set selected_choice_index = p_selected_choice_index,
      is_correct = v_is_correct,
      answered_at = v_answered_at
  where id = v_question.id;

  -- A legacy snapshot can lack this value only when its source card had been
  -- deleted before this migration. It remains answerable; all new snapshots
  -- carry the durable identity and therefore append a review event.
  if v_question.source_flashcard_id is not null then
    insert into public.card_review_events (
      user_id,
      flashcard_id,
      source,
      is_correct,
      reviewed_at,
      quiz_session_id,
      quiz_question_id,
      fsrs_rating
    ) values (
      v_user_id,
      v_question.source_flashcard_id,
      'quiz',
      v_is_correct,
      v_answered_at,
      v_question.session_id,
      v_question.id,
      case when v_is_correct then 3 else 1 end
    )
    on conflict (quiz_question_id)
      -- On a browser retry the event already exists.  Setting fsrs_rating
      -- again is idempotent (same rating derived from the same correctness)
      -- and the RETURNING clause still captures the event id so the server
      -- action can reconcile the card on every answer/retry.
      do update set fsrs_rating = excluded.fsrs_rating
    returning id into v_event_id;
  end if;

  select count(*) into v_answered
  from public.quiz_questions remaining
  where remaining.session_id = v_question.session_id
    and remaining.answered_at is null;

  if v_answered = 0 then
    v_completed_at := now();
    select count(*)::integer, count(*) filter (where answered.is_correct)::integer
    into v_question_count, v_correct_count
    from public.quiz_questions answered
    where answered.session_id = v_question.session_id;

    update public.quiz_sessions target
    set completed_at = v_completed_at,
        correct_answer_count = v_correct_count
    where target.id = v_question.session_id;

    select p.timezone into v_timezone
    from public.profiles p
    where p.id = v_user_id;

    if v_timezone is null
       or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
      v_timezone := 'Asia/Ho_Chi_Minh';
    end if;

    v_local_date := (v_completed_at at time zone v_timezone)::date;

    insert into public.daily_learning_records (
      user_id,
      local_date,
      timezone,
      completed_quiz_count,
      questions_answered,
      correct_answers,
      first_completed_at,
      last_completed_at
    ) values (
      v_user_id,
      v_local_date,
      v_timezone,
      1,
      v_question_count,
      v_correct_count,
      v_completed_at,
      v_completed_at
    ) on conflict (user_id, local_date) do update
    set completed_quiz_count = public.daily_learning_records.completed_quiz_count + 1,
        questions_answered = public.daily_learning_records.questions_answered + excluded.questions_answered,
        correct_answers = public.daily_learning_records.correct_answers + excluded.correct_answers,
        last_completed_at = excluded.last_completed_at;
  end if;

  return query
  select
    v_question.session_id,
    v_is_correct,
    v_answered = 0,
    v_question.source_flashcard_id,
    v_event_id;
end;
$$;

-- Preserve existing grants exactly.
revoke all on function public.submit_quiz_answer(uuid, integer) from public, anon;
grant execute on function public.submit_quiz_answer(uuid, integer) to authenticated;
