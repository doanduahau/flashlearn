-- Flashcard Runner V1 — Task 1 repair (independent-review blockers).
--
-- This is an additive correction to the unpublished draft migration
-- 20260813020000_add_runner_database_foundation.sql. Per repository convention
-- an already-run migration is never edited, so the corrected design is layered
-- here rather than rewriting the draft.
--
-- The frozen product decision: a dedicated trusted Runner session/config record
-- linked 1:1 with `learning_coverage_sessions`, so difficulty and the canonical
-- distractor seed are server-established and immutable.
--
-- Changes:
--   1. `runner_sessions` — trusted 1:1 runner config (difficulty + seed id).
--   2. `create_runner_session(...)` — service-role-only trusted creation boundary.
--   3. `load_runner_candidate_eligibility(...)` — side-effect-free whole-library
--      eligibility read model (no seed, no nullable outputs).
--   4. `load_runner_session_questions(...)` — session-seeded canonical question
--      generation from the immutable session snapshot.
--   5. `submit_runner_best_time(p_runner_session_id, p_elapsed_ms)` — difficulty
--      and question_count are derived from trusted DB state, never the caller.
--
-- `load_runner_candidates(uuid[])` and the old `submit_runner_best_time(uuid, text,
-- integer)` are superseded and dropped.

-- ---------------------------------------------------------------------------
-- 1. Trusted Runner session/config, linked 1:1 with a coverage session.
-- ---------------------------------------------------------------------------

-- Composite-FK target so cross-user coverage linkage is impossible at the DB
-- level (ADR 001 ownership pattern), mirroring flashcard_sets/user_id_id.
alter table public.learning_coverage_sessions
  add constraint learning_coverage_sessions_user_id_id_key unique (user_id, id);

create table public.runner_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  coverage_session_id uuid not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  created_at timestamptz not null default now(),
  constraint runner_sessions_coverage_session_key unique (coverage_session_id),
  constraint runner_sessions_user_coverage_fk
    foreign key (user_id, coverage_session_id)
    references public.learning_coverage_sessions (user_id, id)
    on delete cascade
);

comment on table public.runner_sessions is
  'Trusted Runner session configuration, one per learning_coverage_sessions row. Stores immutable difficulty and provides the canonical distractor seed (its own id). It is not run history, analytics, game state, or leaderboard data.';

comment on column public.runner_sessions.difficulty is
  'Server-established difficulty (easy/medium/hard). Immutable after creation.';

create index runner_sessions_user_idx on public.runner_sessions (user_id);

alter table public.runner_sessions enable row level security;

create policy "runner_sessions_select_own"
  on public.runner_sessions for select
  to authenticated
  using (user_id = auth.uid());

-- Trusted config is never mutated directly by a browser. The `alter default
-- privileges` in the core migration grants INSERT/UPDATE/DELETE to authenticated
-- for new tables, so revoke those and allow SELECT only. Creation/mutation goes
-- through the service-role RPC below.
revoke all on table public.runner_sessions from public, anon, authenticated;
grant select on table public.runner_sessions to authenticated;
grant all privileges on table public.runner_sessions to service_role;

-- ---------------------------------------------------------------------------
-- 2. Trusted creation boundary (service-role only).
-- ---------------------------------------------------------------------------

create or replace function public.create_runner_session(
  p_user_id uuid,
  p_session_card_ids uuid[],
  p_scope_card_ids uuid[],
  p_difficulty text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coverage_session_id uuid;
  v_runner_session_id uuid := gen_random_uuid();
begin
  if p_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_difficulty not in ('easy', 'medium', 'hard') then
    raise exception 'invalid runner difficulty' using errcode = '22023';
  end if;

  -- Reuse the existing trusted coverage-session boundary. It validates ownership,
  -- non-empty distinct snapshots, session ⊆ scope, and mode-specific rules, and
  -- creates the immutable coverage snapshot in the same transaction.
  select public.create_learning_coverage_session(
    p_user_id, 'runner', p_session_card_ids, p_scope_card_ids, null
  ) into v_coverage_session_id;

  insert into public.runner_sessions (id, user_id, coverage_session_id, difficulty)
  values (v_runner_session_id, p_user_id, v_coverage_session_id, p_difficulty);

  return v_runner_session_id;
end;
$$;

comment on function public.create_runner_session(uuid, uuid[], uuid[], text) is
  'Trusted Runner session creation. Establishes an immutable card/scope snapshot (mode runner) and a 1:1 runner_sessions config with server-established difficulty. Service-role only.';

revoke all on function public.create_runner_session(uuid, uuid[], uuid[], text) from public, anon, authenticated;
grant execute on function public.create_runner_session(uuid, uuid[], uuid[], text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Pre-session eligibility read model (side-effect free, no seed).
-- ---------------------------------------------------------------------------

create or replace function public.load_runner_candidate_eligibility(p_card_ids uuid[])
returns table (
  flashcard_id uuid,
  eligible boolean
)
language sql
security invoker
set search_path = ''
as $$
  select
    target.id,
    (
      select count(distinct lower(regexp_replace(btrim(f.back), '\\s+', ' ', 'g'))) >= 2
      from public.flashcards as f
      where f.user_id = auth.uid()
        and lower(regexp_replace(btrim(f.back), '\\s+', ' ', 'g'))
            <> lower(regexp_replace(btrim(target.back), '\\s+', ' ', 'g'))
    ) as eligible
  from unnest(p_card_ids) with ordinality as input(id, ord)
  join public.flashcards as target
    on target.id = input.id
   and target.user_id = auth.uid()
  order by input.ord;
$$;

comment on function public.load_runner_candidate_eligibility(uuid[]) is
  'Read-only eligibility: whether a candidate card can form a 3-choice Runner question (1 correct + 2 distinct normalized wrong answers) from the authenticated user''s whole library. No seed, no ordering, no writes.';

revoke all on function public.load_runner_candidate_eligibility(uuid[]) from public, anon;
grant execute on function public.load_runner_candidate_eligibility(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Session-seeded canonical question generation.
-- ---------------------------------------------------------------------------

create or replace function public.load_runner_session_questions(p_runner_session_id uuid)
returns table (
  flashcard_id uuid,
  front text,
  correct_answer text,
  choices jsonb
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.runner_sessions;
  v_coverage public.learning_coverage_sessions;
  v_card record;
  v_choices jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_runner_session_id is null then
    raise exception 'invalid runner session' using errcode = '22023';
  end if;

  select * into v_session
  from public.runner_sessions r
  where r.id = p_runner_session_id
    and r.user_id = v_user_id;

  if not found then
    raise exception 'runner session not found' using errcode = '22023';
  end if;

  select * into v_coverage
  from public.learning_coverage_sessions s
  where s.id = v_session.coverage_session_id
    and s.user_id = v_user_id
    and s.mode = 'runner';

  if not found then
    raise exception 'invalid runner session' using errcode = '22023';
  end if;

  -- Questions come only from the immutable session snapshot; distractors may
  -- come from any flashcard owned by the same user. The Runner session id is
  -- the canonical seed, the direct analogue of quiz_sessions.id in the Quiz
  -- engine (see create_quiz_session_from_card_ids). The LIMIT 3 applies to the
  -- whole UNION (one correct + up to three distinct wrong answers), so a fully
  -- eligible question yields exactly three choices — identical to Quiz.
  for v_card in
    select f.id, f.front, f.back
    from unnest(v_coverage.session_card_ids) with ordinality as input(id, ord)
    join public.flashcards as f
      on f.id = input.id
     and f.user_id = v_user_id
    order by input.ord
  loop
    select jsonb_agg(choice order by ordering) into v_choices
    from (
      select choice, ordering from (
        select v_card.back as choice, md5(v_card.id::text || v_card.back) as ordering
        union all
        select back, md5(id::text || p_runner_session_id::text)
        from (
          select distinct on (lower(regexp_replace(btrim(f.back), '\\s+', ' ', 'g'))) f.id, f.back
          from public.flashcards as f
          where f.user_id = v_user_id
            and lower(regexp_replace(btrim(f.back), '\\s+', ' ', 'g'))
                <> lower(regexp_replace(btrim(v_card.back), '\\s+', ' ', 'g'))
          order by
            lower(regexp_replace(btrim(f.back), '\\s+', ' ', 'g')),
            md5(f.id::text || p_runner_session_id::text)
        ) distractors
        limit 3
      ) choices
    ) ordered;

    if v_choices is null or jsonb_array_length(v_choices) < 3 then
      continue;
    end if;

    flashcard_id := v_card.id;
    front := v_card.front;
    correct_answer := v_card.back;
    choices := v_choices;
    return next;
  end loop;
end;
$$;

comment on function public.load_runner_session_questions(uuid) is
  'Session-seeded Runner question generation. Questions come only from the immutable session snapshot; distractors come from the whole user library. Uses the runner session id as the canonical seed, mirroring the Quiz distractor operation exactly. Returns only questions with exactly three distinct choices.';

revoke all on function public.load_runner_session_questions(uuid) from public, anon;
grant execute on function public.load_runner_session_questions(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Best-time mutation — difficulty and question_count are trusted, not caller
--    supplied.
-- ---------------------------------------------------------------------------

drop function if exists public.load_runner_candidates(uuid[]);
drop function if exists public.submit_runner_best_time(uuid, text, integer);

create or replace function public.submit_runner_best_time(
  p_runner_session_id uuid,
  p_elapsed_ms integer
)
returns table (
  result_best_ms integer,
  result_question_count integer,
  is_new_best boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.runner_sessions;
  v_coverage public.learning_coverage_sessions;
  v_question_count integer;
  v_best_ms integer;
  v_is_new_best boolean;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_runner_session_id is null or p_elapsed_ms is null or p_elapsed_ms <= 0 then
    raise exception 'invalid runner result' using errcode = '22023';
  end if;

  -- Trusted session + completion lookups. Difficulty is taken from runner_sessions,
  -- question_count from the immutable coverage snapshot, and completion from the
  -- coverage lifecycle. None of these are accepted from the browser.
  select * into v_session
  from public.runner_sessions r
  where r.id = p_runner_session_id
    and r.user_id = v_user_id;

  if not found then
    raise exception 'invalid runner session' using errcode = '22023';
  end if;

  select * into v_coverage
  from public.learning_coverage_sessions s
  where s.id = v_session.coverage_session_id
    and s.user_id = v_user_id
    and s.mode = 'runner'
    and s.completed_at is not null;

  if not found then
    raise exception 'invalid runner session' using errcode = '22023';
  end if;

  v_question_count := cardinality(v_coverage.session_card_ids);

  -- Atomic best-only upsert. `is_new_best` follows the INSERT ... ON CONFLICT ...
  -- DO UPDATE ... WHERE best_ms > excluded.best_ms RETURNING semantics: a row is
  -- returned only when this statement actually inserted or strictly improved. A
  -- stale pre-read is never used, so a slower caller losing a concurrent first
  -- insert race cannot report true.
  insert into public.runner_personal_bests (user_id, difficulty, question_count, best_ms)
  values (v_user_id, v_session.difficulty, v_question_count, p_elapsed_ms)
  on conflict (user_id, difficulty, question_count)
  do update
    set best_ms = least(public.runner_personal_bests.best_ms, excluded.best_ms),
        updated_at = now()
    where public.runner_personal_bests.best_ms > excluded.best_ms
  returning best_ms into v_best_ms;

  if v_best_ms is null then
    -- Equal or slower: the DO UPDATE WHERE filtered the row out, so RETURNING
    -- produced nothing. Read the stored minimum and report a non-improvement.
    select rpb.best_ms into v_best_ms
    from public.runner_personal_bests as rpb
    where rpb.user_id = v_user_id
      and rpb.difficulty = v_session.difficulty
      and rpb.question_count = v_question_count;
    v_is_new_best := false;
  else
    v_is_new_best := true;
  end if;

  return query
    select v_best_ms, v_question_count, v_is_new_best;
end;
$$;

comment on function public.submit_runner_best_time(uuid, integer) is
  'Submits a Runner completion time. Derives user, difficulty, question_count and completion from trusted DB state; stores the best-only minimum atomically and reports whether this call actually inserted or improved the record.';

revoke all on function public.submit_runner_best_time(uuid, integer) from public, anon;
grant execute on function public.submit_runner_best_time(uuid, integer) to authenticated;
