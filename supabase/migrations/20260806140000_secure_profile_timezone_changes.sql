-- Timezone changes are deliberately infrequent. Local activity dates are
-- snapshotted when a quiz is completed so changing the profile timezone never
-- rewrites completed streak history.

alter table public.profiles
  add column timezone_changed_at timestamptz;

create table public.daily_learning_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  timezone text not null check (char_length(timezone) between 1 and 64),
  completed_quiz_count integer not null default 0 check (completed_quiz_count > 0),
  questions_answered integer not null default 0 check (questions_answered >= 0),
  correct_answers integer not null default 0 check (correct_answers >= 0),
  first_completed_at timestamptz not null,
  last_completed_at timestamptz not null,
  primary key (user_id, local_date),
  check (last_completed_at >= first_completed_at),
  check (correct_answers <= questions_answered)
);

create index idx_daily_learning_records_user_date
  on public.daily_learning_records (user_id, local_date desc);

-- Existing completed sessions are snapshotted once using the timezone that was
-- saved when this migration is applied. Future profile timezone changes do not
-- recalculate these rows.
insert into public.daily_learning_records (
  user_id,
  local_date,
  timezone,
  completed_quiz_count,
  questions_answered,
  correct_answers,
  first_completed_at,
  last_completed_at
)
select
  s.user_id,
  (s.completed_at at time zone coalesce(valid_timezone.timezone, 'Asia/Ho_Chi_Minh'))::date,
  coalesce(valid_timezone.timezone, 'Asia/Ho_Chi_Minh'),
  count(*)::integer,
  sum(s.actual_question_count)::integer,
  sum(s.correct_answer_count)::integer,
  min(s.completed_at),
  max(s.completed_at)
from public.quiz_sessions s
left join public.profiles p on p.id = s.user_id
left join lateral (
  select p.timezone
  where p.timezone is not null
    and exists (select 1 from pg_catalog.pg_timezone_names where name = p.timezone)
) valid_timezone on true
where s.completed_at is not null
group by
  s.user_id,
  valid_timezone.timezone,
  (s.completed_at at time zone coalesce(valid_timezone.timezone, 'Asia/Ho_Chi_Minh'))::date;

alter table public.daily_learning_records enable row level security;

create policy "daily_learning_records_select_own"
  on public.daily_learning_records for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.daily_learning_records from public, anon, authenticated;
grant select on table public.daily_learning_records to authenticated;
grant all on table public.daily_learning_records to service_role;

create or replace function public.update_profile(p_display_name text, p_timezone text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_display_name text;
  v_current_timezone text;
  v_timezone_changed_at timestamptz;
  v_next_allowed_at timestamptz;
  v_row public.profiles;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  v_display_name := nullif(btrim(p_display_name), '');
  if v_display_name is not null and char_length(v_display_name) > 100 then
    raise exception 'invalid display name' using errcode = '22023';
  end if;

  if p_timezone is null
     or char_length(p_timezone) > 64
     or not exists (
       select 1 from pg_catalog.pg_timezone_names where name = p_timezone
     ) then
    raise exception 'invalid timezone' using errcode = '22023';
  end if;

  select timezone, timezone_changed_at
  into v_current_timezone, v_timezone_changed_at
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'profile not found' using errcode = '22023';
  end if;

  if p_timezone is distinct from v_current_timezone then
    v_next_allowed_at := v_timezone_changed_at + interval '72 hours';
    if v_next_allowed_at is not null and now() < v_next_allowed_at then
      raise exception 'timezone_change_cooldown'
        using errcode = 'P0001',
          detail = jsonb_build_object(
            'code', 'timezone_change_cooldown',
            'available_at', v_next_allowed_at
          )::text;
    end if;

    update public.profiles
    set display_name = v_display_name,
        timezone = p_timezone,
        timezone_changed_at = now()
    where id = v_user_id
    returning * into v_row;
  else
    update public.profiles
    set display_name = v_display_name
    where id = v_user_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke all on function public.update_profile(text, text) from public, anon;
grant execute on function public.update_profile(text, text) to authenticated;
revoke update on table public.profiles from authenticated;

create or replace function public.submit_quiz_answer(p_question_id uuid, p_selected_choice_index integer)
returns table(session_id uuid, is_correct boolean, completed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_question public.quiz_questions;
  v_answered integer;
  v_completed_at timestamptz;
  v_timezone text := 'Asia/Ho_Chi_Minh';
  v_local_date date;
  v_question_count integer;
  v_correct_count integer;
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

  update public.quiz_questions
  set selected_choice_index = p_selected_choice_index,
      is_correct = (p_selected_choice_index = v_question.correct_choice_index),
      answered_at = now()
  where id = v_question.id;

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
    )
    on conflict (user_id, local_date) do update
    set completed_quiz_count = public.daily_learning_records.completed_quiz_count + 1,
        questions_answered = public.daily_learning_records.questions_answered + excluded.questions_answered,
        correct_answers = public.daily_learning_records.correct_answers + excluded.correct_answers,
        last_completed_at = excluded.last_completed_at;
  end if;

  return query
  select
    v_question.session_id,
    p_selected_choice_index = v_question.correct_choice_index,
    v_answered = 0;
end;
$$;

revoke all on function public.submit_quiz_answer(uuid, integer) from public, anon;
grant execute on function public.submit_quiz_answer(uuid, integer) to authenticated;

create or replace function public.get_learning_statistics()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text := 'Asia/Ho_Chi_Minh';
  v_today date;
  v_end date;
  v_cursor date;
  v_current integer := 0;
  v_longest integer := 0;
  v_completed_today boolean := false;
  v_total_quizzes integer := 0;
  v_questions integer := 0;
  v_correct integer := 0;
  v_active_days integer := 0;
  v_last_date date;
  v_days jsonb := '[]'::jsonb;
  v_modes jsonb := '[]'::jsonb;
  v_recent jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select p.timezone into v_timezone
  from public.profiles p
  where p.id = v_user_id;

  if v_timezone is null
     or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
    v_timezone := 'Asia/Ho_Chi_Minh';
  end if;
  v_today := (now() at time zone v_timezone)::date;

  select
    count(*)::integer,
    coalesce(sum(actual_question_count), 0)::integer,
    coalesce(sum(correct_answer_count), 0)::integer
  into v_total_quizzes, v_questions, v_correct
  from public.quiz_sessions
  where user_id = v_user_id
    and completed_at is not null;

  select count(*)::integer, max(local_date)
  into v_active_days, v_last_date
  from public.daily_learning_records
  where user_id = v_user_id;

  select exists(
    select 1
    from public.daily_learning_records
    where user_id = v_user_id and local_date = v_today
  ) into v_completed_today;

  if v_completed_today then
    v_end := v_today;
  elsif exists(
    select 1
    from public.daily_learning_records
    where user_id = v_user_id and local_date = v_today - 1
  ) then
    v_end := v_today - 1;
  end if;

  v_cursor := v_end;
  while v_cursor is not null and exists(
    select 1
    from public.daily_learning_records
    where user_id = v_user_id and local_date = v_cursor
  ) loop
    v_current := v_current + 1;
    v_cursor := v_cursor - 1;
  end loop;

  with dates as (
    select local_date as day
    from public.daily_learning_records
    where user_id = v_user_id
  ), grouped as (
    select day, day - (row_number() over (order by day))::integer as grp
    from dates
  )
  select coalesce(max(run), 0)::integer into v_longest
  from (
    select count(*)::integer as run
    from grouped
    group by grp
  ) runs;

  with series as (
    select generate_series(v_today - 29, v_today, interval '1 day')::date as day
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('date', series.day, 'active', records.local_date is not null)
      order by series.day
    ),
    '[]'::jsonb
  ) into v_days
  from series
  left join public.daily_learning_records records
    on records.user_id = v_user_id and records.local_date = series.day;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'mode', mode,
        'quiz_count', quiz_count,
        'questions', questions,
        'correct', correct
      ) order by mode
    ),
    '[]'::jsonb
  ) into v_modes
  from (
    select
      mode,
      count(*)::integer quiz_count,
      sum(actual_question_count)::integer questions,
      sum(correct_answer_count)::integer correct
    from public.quiz_sessions
    where user_id = v_user_id and completed_at is not null
    group by mode
  ) breakdown;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'mode', mode,
        'completed_at', completed_at,
        'questions', actual_question_count,
        'correct', correct_answer_count
      ) order by completed_at desc
    ),
    '[]'::jsonb
  ) into v_recent
  from (
    select id, mode, completed_at, actual_question_count, correct_answer_count
    from public.quiz_sessions
    where user_id = v_user_id and completed_at is not null
    order by completed_at desc
    limit 10
  ) recent;

  return jsonb_build_object(
    'timezone', v_timezone,
    'current_streak', v_current,
    'longest_streak', v_longest,
    'completed_today', v_completed_today,
    'total_completed_quizzes', v_total_quizzes,
    'questions_answered', v_questions,
    'correct_answers', v_correct,
    'active_days', v_active_days,
    'last_active_date', v_last_date,
    'daily_activity', v_days,
    'mode_breakdown', v_modes,
    'recent_quizzes', v_recent
  );
end;
$$;

revoke all on function public.get_learning_statistics() from public, anon;
grant execute on function public.get_learning_statistics() to authenticated;
