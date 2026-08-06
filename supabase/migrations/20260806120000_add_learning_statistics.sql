-- Read-only, caller-scoped statistics derived from completed quiz sessions.
-- No analytics rows are stored: the source of truth remains quiz snapshots.
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

  select p.timezone into v_timezone from public.profiles p where p.id = v_user_id;
  if v_timezone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
    v_timezone := 'Asia/Ho_Chi_Minh';
  end if;
  v_today := (now() at time zone v_timezone)::date;

  with completed as (
    select s.*, (s.completed_at at time zone v_timezone)::date as active_date
    from public.quiz_sessions s where s.user_id = v_user_id and s.completed_at is not null
  )
  select count(*)::integer, coalesce(sum(actual_question_count),0)::integer, coalesce(sum(correct_answer_count),0)::integer,
         count(distinct active_date)::integer, max(active_date)
  into v_total_quizzes, v_questions, v_correct, v_active_days, v_last_date from completed;

  select exists(select 1 from public.quiz_sessions s where s.user_id=v_user_id and s.completed_at is not null and (s.completed_at at time zone v_timezone)::date=v_today) into v_completed_today;
  if v_completed_today then v_end:=v_today;
  elsif exists(select 1 from public.quiz_sessions s where s.user_id=v_user_id and s.completed_at is not null and (s.completed_at at time zone v_timezone)::date=v_today-1) then v_end:=v_today-1;
  end if;
  v_cursor:=v_end;
  while v_cursor is not null and exists(select 1 from public.quiz_sessions s where s.user_id=v_user_id and s.completed_at is not null and (s.completed_at at time zone v_timezone)::date=v_cursor) loop
    v_current:=v_current+1; v_cursor:=v_cursor-1;
  end loop;

  with dates as (select distinct (completed_at at time zone v_timezone)::date as day from public.quiz_sessions where user_id=v_user_id and completed_at is not null), grouped as (select day, day-(row_number() over(order by day))::integer as grp from dates) select coalesce(max(run),0)::integer into v_longest from (select count(*)::integer as run from grouped group by grp) runs;
  with series as (select generate_series(v_today-29,v_today,interval '1 day')::date as day), dates as (select distinct (completed_at at time zone v_timezone)::date as day from public.quiz_sessions where user_id=v_user_id and completed_at is not null) select coalesce(jsonb_agg(jsonb_build_object('date',series.day,'active',dates.day is not null) order by series.day),'[]'::jsonb) into v_days from series left join dates using(day);
  select coalesce(jsonb_agg(jsonb_build_object('mode',mode,'quiz_count',quiz_count,'questions',questions,'correct',correct) order by mode),'[]'::jsonb) into v_modes from (select mode,count(*)::integer quiz_count,sum(actual_question_count)::integer questions,sum(correct_answer_count)::integer correct from public.quiz_sessions where user_id=v_user_id and completed_at is not null group by mode) breakdown;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'mode',mode,'completed_at',completed_at,'questions',actual_question_count,'correct',correct_answer_count) order by completed_at desc),'[]'::jsonb) into v_recent from (select id,mode,completed_at,actual_question_count,correct_answer_count from public.quiz_sessions where user_id=v_user_id and completed_at is not null order by completed_at desc limit 10) recent;
  return jsonb_build_object('timezone',v_timezone,'current_streak',v_current,'longest_streak',v_longest,'completed_today',v_completed_today,'total_completed_quizzes',v_total_quizzes,'questions_answered',v_questions,'correct_answers',v_correct,'active_days',v_active_days,'last_active_date',v_last_date,'daily_activity',v_days,'mode_breakdown',v_modes,'recent_quizzes',v_recent);
end;
$$;

revoke all on function public.get_learning_statistics() from public, anon;
grant execute on function public.get_learning_statistics() to authenticated;
