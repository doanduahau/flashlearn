-- Task N17: group quiz-setup appearance counts across the whole Kiểm tra
-- group (quiz + match + typing) instead of counting quiz-mode sessions only.
--
-- Additive migration: `get_quiz_scope_sets` is recreated with the SAME
-- signature and return type (total, wrong_ids, appearance_counts) so the
-- generated client types stay unchanged — only the `appearance` CTE changes
-- to sum flashcard_coverage.appearance_count across c.mode in
-- ('quiz', 'match', 'typing'). The `latest`/`wrong` CTEs (the "câu sai"
-- definition) are untouched. Covered by pgTAP 036 (section 5 asserts the
-- cross-mode sum).

create or replace function public.get_quiz_scope_sets(
  p_set_ids uuid[],
  p_collection_ids uuid[],
  p_all boolean
)
returns table (total integer, wrong_ids uuid[], appearance_counts jsonb)
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
  ),
  appearance as (
    select s.id, coalesce(sum(c.appearance_count), 0) as count
    from scope s
    left join public.flashcard_coverage c
      on c.user_id = auth.uid()
     and c.mode in ('quiz', 'match', 'typing')
     and c.flashcard_id = s.id
    group by s.id
  )
  select
    (select count(*)::integer from scope) as total,
    coalesce(array(select id from wrong order by id), '{}'::uuid[]) as wrong_ids,
    coalesce(
      (select jsonb_object_agg(id::text, count) from appearance),
      '{}'::jsonb
    ) as appearance_counts;
$$;

comment on function public.get_quiz_scope_sets(uuid[], uuid[], boolean) is
  'Deduplicated scope for the authenticated user plus latest-wrong card ids and a jsonb map of flashcard_id -> appearance count across the quiz/match/typing group (0 = never appeared in the group).';

revoke all on function public.get_quiz_scope_sets(uuid[], uuid[], boolean) from public, anon;
grant execute on function public.get_quiz_scope_sets(uuid[], uuid[], boolean) to authenticated;
grant execute on function public.get_quiz_scope_sets(uuid[], uuid[], boolean) to service_role;
