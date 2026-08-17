-- Task N12: record daily activity for every learning/quiz mode.
--
-- Previously only submit_quiz_answer wrote daily_learning_records, so Match,
-- Memory, Runner and Study completions never contributed to the streak. This
-- migration adds a service-role-only RPC that upserts the daily record for
-- any completion: quiz/match/typing add quiz counts + question stats, while
-- memory/runner/study only ensure the local date exists (streak) without
-- inflating the "bài hôm nay" counts that Task N14 derives from
-- completed_quiz_count.

-- The old table constraint required completed_quiz_count > 0, but a day that
-- is only active through memory/runner/study legitimately has 0 completed
-- quizzes. Relax it so a streak-only record can be stored.
alter table public.daily_learning_records
  drop constraint daily_learning_records_completed_quiz_count_check;
alter table public.daily_learning_records
  add constraint daily_learning_records_completed_quiz_count_check
  check (completed_quiz_count >= 0);

create or replace function public.record_daily_activity(
  p_user_id uuid,
  p_mode text,
  p_questions_answered integer,
  p_correct_answers integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text := 'Asia/Ho_Chi_Minh';
  v_local_date date;
  v_now timestamptz := now();
  v_questions integer;
  v_correct integer;
begin
  if p_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_mode is null or p_mode not in ('quiz', 'match', 'typing', 'memory', 'runner', 'study') then
    raise exception 'invalid mode' using errcode = '22023';
  end if;

  v_questions := coalesce(greatest(p_questions_answered, 0), 0);
  v_correct := coalesce(greatest(p_correct_answers, 0), 0);
  if v_correct > v_questions then
    v_correct := v_questions;
  end if;

  select p.timezone into v_timezone
  from public.profiles p
  where p.id = p_user_id;

  if v_timezone is null
     or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
    v_timezone := 'Asia/Ho_Chi_Minh';
  end if;

  v_local_date := (v_now at time zone v_timezone)::date;

  if p_mode in ('quiz', 'match', 'typing') then
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
      p_user_id,
      v_local_date,
      v_timezone,
      1,
      v_questions,
      v_correct,
      v_now,
      v_now
    )
    on conflict (user_id, local_date) do update
    set completed_quiz_count = public.daily_learning_records.completed_quiz_count + 1,
        questions_answered = public.daily_learning_records.questions_answered + excluded.questions_answered,
        correct_answers = public.daily_learning_records.correct_answers + excluded.correct_answers,
        timezone = excluded.timezone,
        last_completed_at = excluded.last_completed_at;
  else
    -- Memory / runner / study: the day counts as active (streak) but the
    -- quiz-derived counts must not change.
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
      p_user_id,
      v_local_date,
      v_timezone,
      0,
      0,
      0,
      v_now,
      v_now
    )
    on conflict (user_id, local_date) do update
    set timezone = excluded.timezone,
        last_completed_at = excluded.last_completed_at;
  end if;
end;
$$;

revoke all on function public.record_daily_activity(uuid, text, integer, integer) from public, anon;
revoke all on function public.record_daily_activity(uuid, text, integer, integer) from authenticated;
grant execute on function public.record_daily_activity(uuid, text, integer, integer) to service_role;
