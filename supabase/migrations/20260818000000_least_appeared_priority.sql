-- Least-appeared priority (learning + quiz selection).
--
-- Replaces the binary "uncovered" concept (a card has appeared in a mode or
-- not) with a gradient "appearance count" (how many completed sessions of a
-- mode included the card). Selection now picks latest-wrong cards first, then
-- the remaining cards sorted ascending by appearance count.
--
-- Additive migration:
--   1. flashcard_coverage gains appearance_count (default 1 for existing rows).
--   2. complete_learning_coverage_session increments the count on conflict
--      instead of the old reset-cycle (delete-when-scope-covered) behavior.
--   3. get_quiz_scope_sets returns appearance_counts (jsonb id->count map)
--      instead of uncovered_ids, keeping total + wrong_ids.

-- ---------------------------------------------------------------------------
-- 1. appearance_count column
-- ---------------------------------------------------------------------------

alter table public.flashcard_coverage
  add column appearance_count integer not null default 1;

comment on column public.flashcard_coverage.appearance_count is
  'Number of completed sessions of this mode that included the card (0 never counted because rows are only created on first appearance).';

-- ---------------------------------------------------------------------------
-- 2. Incrementing completion (no reset cycle)
-- ---------------------------------------------------------------------------

create or replace function public.complete_learning_coverage_session(p_session_id uuid)
returns table(completed_at timestamptz, did_reset boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.learning_coverage_sessions;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_session_id is null then
    raise exception 'invalid coverage session' using errcode = '22023';
  end if;

  select * into v_session
  from public.learning_coverage_sessions s
  where s.id = p_session_id
  for update;

  if not found or v_session.user_id <> v_user_id then
    raise exception 'coverage session not found' using errcode = '42501';
  end if;

  -- Serialise coverage changes per user/mode (kept from the prior design so
  -- overlapping scopes cannot race the increment).
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_session.user_id::text || ':' || v_session.mode)
  );

  if v_session.completed_at is not null then
    return query select v_session.completed_at, v_session.did_reset;
    return;
  end if;

  -- A deleted card cannot be counted; only surviving live cards increment.
  insert into public.flashcard_coverage (user_id, mode, flashcard_id, appearance_count)
  select v_session.user_id, v_session.mode, input.id, 1
  from unnest(v_session.session_card_ids) as input(id)
  join public.flashcards f on f.id = input.id and f.user_id = v_session.user_id
  on conflict (user_id, mode, flashcard_id) do update
    set appearance_count = public.flashcard_coverage.appearance_count + 1,
        covered_at = now();

  update public.learning_coverage_sessions
  set completed_at = now(), did_reset = false
  where id = v_session.id
  returning learning_coverage_sessions.completed_at into v_session.completed_at;

  return query select v_session.completed_at, false;
end;
$$;

revoke all on function public.complete_learning_coverage_session(uuid) from public, anon;
grant execute on function public.complete_learning_coverage_session(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. get_quiz_scope_sets returns appearance counts instead of uncovered_ids
-- ---------------------------------------------------------------------------

-- The return type changes (uncovered_ids -> appearance_counts), so drop first.
drop function if exists public.get_quiz_scope_sets(uuid[], uuid[], boolean);

create function public.get_quiz_scope_sets(
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
    select s.id, coalesce(c.appearance_count, 0) as count
    from scope s
    left join public.flashcard_coverage c
      on c.user_id = auth.uid() and c.mode = 'quiz' and c.flashcard_id = s.id
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
  'Deduplicated scope for the authenticated user plus latest-wrong card ids and a jsonb map of flashcard_id -> quiz appearance count (0 = never appeared).';

revoke all on function public.get_quiz_scope_sets(uuid[], uuid[], boolean) from public, anon;
grant execute on function public.get_quiz_scope_sets(uuid[], uuid[], boolean) to authenticated;
grant execute on function public.get_quiz_scope_sets(uuid[], uuid[], boolean) to service_role;
