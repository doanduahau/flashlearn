-- Flashcard Runner V1 — database/security foundation (consolidated).
--
-- Single final Runner migration. It creates the accepted Runner foundation from a
-- clean database: trusted session config, canonical distractor generation, and
-- best-only personal-best persistence. It intentionally supersedes the earlier
-- unpublished layered Runner migrations (…20000 draft / …30000 repair / …40000
-- integrity) and never exposes any known-bad intermediate RPC.
--
-- Frozen product decisions encoded here:
--   * A dedicated trusted Runner session/config (`runner_sessions`) is linked 1:1
--     with a `learning_coverage_sessions` snapshot. Its own `id` is the canonical
--     distractor seed (the analogue of `quiz_sessions.id`).
--   * Difficulty (easy/medium/hard) is immutable trusted session config; the
--     best-time RPC never accepts difficulty from a caller.
--   * Questions come only from the immutable session snapshot; distractors come
--     from the whole authenticated user's library.
--   * Exactly three choices per question (1 correct + 2 canonical wrong answers),
--     using the same normalization/exclusion/dedup semantics as Quiz.
--   * Best-time key is (user, difficulty, question_count); a faster time replaces,
--     an equal/slower time never worsens.

-- ---------------------------------------------------------------------------
-- 1. Personal-best persistence (best-only; no history, no leaderboard).
-- ---------------------------------------------------------------------------

create table public.runner_personal_bests (
  user_id uuid not null references auth.users(id) on delete cascade,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  question_count integer not null check (question_count > 0),
  best_ms integer not null check (best_ms > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, difficulty, question_count)
);

comment on table public.runner_personal_bests is
  'Runner personal best time per (user, difficulty, question_count). Best-only: a faster completion replaces the stored time; an equal or slower one never worsens it.';

comment on column public.runner_personal_bests.best_ms is
  'Fastest completion time in milliseconds.';

alter table public.runner_personal_bests enable row level security;

create policy "runner_personal_bests_select_own"
  on public.runner_personal_bests for select
  to authenticated
  using (user_id = auth.uid());

-- The `alter default privileges` in the core migration grants
-- SELECT/INSERT/UPDATE/DELETE to `authenticated` for new tables. Revoke those and
-- allow only SELECT: best times are mutated exclusively through the scoped RPC.
revoke all on table public.runner_personal_bests from public, anon, authenticated;
grant select on table public.runner_personal_bests to authenticated;
grant all privileges on table public.runner_personal_bests to service_role;

-- ---------------------------------------------------------------------------
-- 2. Trusted Runner session/config, linked 1:1 with a coverage session.
-- ---------------------------------------------------------------------------

-- Composite-FK target so cross-user coverage linkage is impossible at the DB
-- level (ADR 001 ownership pattern), mirroring flashcard_sets(user_id, id).
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

-- Trusted config is never mutated directly by a browser; allow SELECT only.
revoke all on table public.runner_sessions from public, anon, authenticated;
grant select on table public.runner_sessions to authenticated;
grant all privileges on table public.runner_sessions to service_role;

-- ---------------------------------------------------------------------------
-- 3. Runner-mode linkage enforcement (a Runner config must reference a Runner
--    coverage snapshot owned by the same user).
-- ---------------------------------------------------------------------------

create or replace function public.validate_runner_session_coverage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.learning_coverage_sessions as coverage
    where coverage.id = new.coverage_session_id
      and coverage.user_id = new.user_id
      and coverage.mode = 'runner'
  ) then
    raise exception 'runner session requires runner coverage' using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_runner_session_coverage() from public, anon, authenticated;

create trigger runner_sessions_require_runner_coverage
before insert or update of user_id, coverage_session_id on public.runner_sessions
for each row execute function public.validate_runner_session_coverage();

-- ---------------------------------------------------------------------------
-- 4. Trusted creation boundary (service-role only).
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

  -- Every requested question must be owned by this user and have at least two
  -- distinct canonical wrong answers in the user's whole library. The later
  -- coverage creation validates the remaining snapshot invariants (non-empty,
  -- distinct IDs, session subset of scope) in this same transaction.
  if exists (
    select 1
    from unnest(coalesce(p_session_card_ids, '{}'::uuid[])) as input(id)
    left join public.flashcards as target
      on target.id = input.id
     and target.user_id = p_user_id
    where target.id is null
       or (
         select count(distinct lower(regexp_replace(btrim(f.back), '\s+', ' ', 'g')))
         from public.flashcards as f
         where f.user_id = p_user_id
           and lower(regexp_replace(btrim(f.back), '\s+', ' ', 'g'))
               <> lower(regexp_replace(btrim(target.back), '\s+', ' ', 'g'))
       ) < 2
  ) then
    raise exception 'runner question is ineligible' using errcode = '22023';
  end if;

  select public.create_learning_coverage_session(
    p_user_id, 'runner', p_session_card_ids, p_scope_card_ids, null
  ) into v_coverage_session_id;

  insert into public.runner_sessions (id, user_id, coverage_session_id, difficulty)
  values (v_runner_session_id, p_user_id, v_coverage_session_id, p_difficulty);

  return v_runner_session_id;
end;
$$;

comment on function public.create_runner_session(uuid, uuid[], uuid[], text) is
  'Trusted Runner session creation. Establishes an immutable card/scope snapshot (mode runner) and a 1:1 runner_sessions config with server-established difficulty. Rejects any ineligible question card atomically. Service-role only.';

revoke all on function public.create_runner_session(uuid, uuid[], uuid[], text) from public, anon, authenticated;
grant execute on function public.create_runner_session(uuid, uuid[], uuid[], text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Pre-session eligibility read model (side-effect free, no seed).
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
      select count(distinct lower(regexp_replace(btrim(f.back), '\s+', ' ', 'g'))) >= 2
      from public.flashcards as f
      where f.user_id = auth.uid()
        and lower(regexp_replace(btrim(f.back), '\s+', ' ', 'g'))
            <> lower(regexp_replace(btrim(target.back), '\s+', ' ', 'g'))
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
-- 6. Session-seeded canonical question generation.
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
  -- the canonical seed (see create_quiz_session_from_card_ids). A snapshotted
  -- card that is no longer available, or one that can no longer form exactly
  -- three choices, fails the whole load instead of being silently dropped.
  for v_card in
    select input.id as snapshot_card_id, f.id as live_card_id, f.front, f.back
    from unnest(v_coverage.session_card_ids) with ordinality as input(id, ord)
    left join public.flashcards as f
      on f.id = input.id
     and f.user_id = v_user_id
    order by input.ord
  loop
    if v_card.live_card_id is null then
      raise exception 'runner session question unavailable' using errcode = '22023';
    end if;

    select jsonb_agg(choice order by ordering) into v_choices
    from (
      select choice, ordering from (
        select v_card.back as choice, md5(v_card.live_card_id::text || v_card.back) as ordering
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
      raise exception 'runner session question unavailable' using errcode = '22023';
    end if;

    flashcard_id := v_card.snapshot_card_id;
    front := v_card.front;
    correct_answer := v_card.back;
    choices := v_choices;
    return next;
  end loop;
end;
$$;

comment on function public.load_runner_session_questions(uuid) is
  'Session-seeded Runner question generation. Questions come only from the immutable session snapshot; distractors come from the whole user library. Uses the runner session id as the canonical seed, mirroring the Quiz distractor operation exactly. Produces exactly one question per snapshotted card, each with exactly three distinct choices, or fails the whole load.';

revoke all on function public.load_runner_session_questions(uuid) from public, anon;
grant execute on function public.load_runner_session_questions(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Best-time mutation — difficulty and question_count are trusted, not caller
--    supplied.
-- ---------------------------------------------------------------------------

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
