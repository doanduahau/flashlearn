-- Task V1: consolidate dashboard + quiz-setup counts into RPCs.
--
-- Additive migration:
--   1. get_dashboard_counts()            — due ("Cần ôn") + untouched ("Chưa học")
--      counts for the authenticated user, replacing the many-query TS chain.
--   2. get_quiz_scope_sets(...)          — deduplicated scope + uncovered/wrong
--      id sets for the authenticated user, replacing chunked/paginated TS loads.
--
-- Both run as SECURITY INVOKER with empty search_path, resolve the caller via
-- auth.uid(), and are granted to authenticated + service_role (mirroring
-- get_learning_statistics) because the dashboard and quiz setup call them with
-- the session user. RLS keeps each user scoped to their own rows.
--
-- The pre-existing get_due_review_card_count(uuid) is intentionally UNCHANGED:
-- the send-reminders edge function (W3) calls it with an explicit p_user_id as
-- service_role and must keep working.

-- ---------------------------------------------------------------------------
-- 1. get_dashboard_counts()
-- ---------------------------------------------------------------------------

create or replace function public.get_dashboard_counts()
returns table (due_count integer, untouched_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (
      select count(*)::integer
      from (
        select distinct on (flashcard_id) flashcard_id, is_correct
        from (
          select q.flashcard_id, q.is_correct, q.answered_at as answered_at, q.id::text as event_id
          from public.quiz_questions q
          join public.quiz_sessions s on s.id = q.session_id
          where q.user_id = auth.uid()
            and q.flashcard_id is not null
            and q.is_correct is not null
            and q.answered_at is not null
            and s.completed_at is not null
          union all
          select m.flashcard_id, m.is_correct, m.answered_at as answered_at, m.id::text as event_id
          from public.mode_answer_events m
          where m.user_id = auth.uid()
            and m.is_correct is not null
            and m.answered_at is not null
        ) answers
        order by flashcard_id, answered_at desc, event_id desc
      ) latest
      where latest.is_correct = false
    ) as due_count,
    (
      select count(*)::integer
      from public.flashcards f
      where f.user_id = auth.uid()
        and not exists (
          select 1 from public.mode_answer_events m
          where m.user_id = f.user_id and m.flashcard_id = f.id
        )
        and not exists (
          select 1 from public.quiz_questions q
          join public.quiz_sessions s on s.id = q.session_id
          where q.user_id = f.user_id
            and q.flashcard_id = f.id
            and q.answered_at is not null
            and s.completed_at is not null
        )
        and not exists (
          select 1 from public.card_review_events c
          where c.user_id = f.user_id and c.flashcard_id = f.id
        )
    ) as untouched_count;
$$;

comment on function public.get_dashboard_counts() is
  'Dashboard summary for the authenticated user: due_count = cards whose latest answer across quiz/match/typing is wrong; untouched_count = cards with no answer or review event in any mode.';

revoke all on function public.get_dashboard_counts() from public, anon;
grant execute on function public.get_dashboard_counts() to authenticated;
grant execute on function public.get_dashboard_counts() to service_role;

-- ---------------------------------------------------------------------------
-- 2. get_quiz_scope_sets(p_set_ids, p_collection_ids, p_all)
-- ---------------------------------------------------------------------------

create or replace function public.get_quiz_scope_sets(
  p_set_ids uuid[],
  p_collection_ids uuid[],
  p_all boolean
)
returns table (total integer, uncovered_ids uuid[], wrong_ids uuid[])
language sql
stable
security invoker
set search_path = ''
as $$
  with scope as (
    select distinct f.id
    from public.flashcards f
    where f.user_id = auth.uid()
      and (
        p_all = true
        or f.set_id = any(coalesce(p_set_ids, '{}'::uuid[]))
        or exists (
          select 1 from public.special_collection_items i
          where i.user_id = auth.uid()
            and i.collection_id = any(coalesce(p_collection_ids, '{}'::uuid[]))
            and i.flashcard_id = f.id
        )
      )
  ),
  uncovered as (
    select s.id
    from scope s
    where not exists (
      select 1 from public.flashcard_coverage c
      where c.user_id = auth.uid() and c.mode = 'quiz' and c.flashcard_id = s.id
    )
  ),
  latest as (
    select distinct on (flashcard_id) flashcard_id, is_correct
    from (
      select q.flashcard_id, q.is_correct, q.answered_at as answered_at, q.id::text as event_id
      from public.quiz_questions q
      join public.quiz_sessions s on s.id = q.session_id
      where q.user_id = auth.uid()
        and q.flashcard_id is not null
        and q.is_correct is not null
        and q.answered_at is not null
        and s.completed_at is not null
      union all
      select m.flashcard_id, m.is_correct, m.answered_at as answered_at, m.id::text as event_id
      from public.mode_answer_events m
      where m.user_id = auth.uid()
        and m.is_correct is not null
        and m.answered_at is not null
    ) answers
    order by flashcard_id, answered_at desc, event_id desc
  ),
  wrong as (
    select s.id
    from scope s
    join latest on latest.flashcard_id = s.id
    where latest.is_correct = false
  )
  select
    (select count(*)::integer from scope) as total,
    coalesce(array(select id from uncovered order by id), '{}'::uuid[]) as uncovered_ids,
    coalesce(array(select id from wrong order by id), '{}'::uuid[]) as wrong_ids;
$$;

comment on function public.get_quiz_scope_sets(uuid[], uuid[], boolean) is
  'Deduplicated scope for the authenticated user (all, by set ids, and/or by collection ids) plus the quiz-uncovered card ids and latest-wrong card ids within that scope.';

revoke all on function public.get_quiz_scope_sets(uuid[], uuid[], boolean) from public, anon;
grant execute on function public.get_quiz_scope_sets(uuid[], uuid[], boolean) to authenticated;
grant execute on function public.get_quiz_scope_sets(uuid[], uuid[], boolean) to service_role;
