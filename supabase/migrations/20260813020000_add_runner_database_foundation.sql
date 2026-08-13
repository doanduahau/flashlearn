-- Flashcard Runner V1 — database/security foundation.
--
-- This migration is intentionally additive and side-effect free for the read
-- model. It does NOT implement Runner UI, Canvas, game loop, setup/session/result
-- pages, or coverage completion for a real gameplay flow. It only exposes:
--
--   1. `load_runner_candidates(...)` — a read-only, ownership-scoped, canonical
--      distractor read model for Runner question construction.
--   2. `runner_personal_bests` — the best-only persistence table.
--   3. `submit_runner_best_time(...)` — the scoped best-time mutation RPC.
--
-- Canonical distractor semantics are intentionally NOT duplicated in
-- TypeScript. They reuse the exact normalization used by the Quiz engine:
--
--     lower(regexp_replace(btrim(back), '\s+', ' ', 'g'))
--
-- (see `create_quiz_session` and `create_quiz_session_from_card_ids`).
--
-- The only unavoidable adaptation versus Quiz is the deterministic tiebreaker:
-- Quiz orders distractors by `md5(id || v_session_id)` using a per-session seed.
-- The Runner read model has no session, so it uses the stable `md5(id)` seed.
-- This preserves the same normalization/dedup/exclusion semantics and is
-- deterministic across identical database states.

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
-- SELECT/INSERT/UPDATE/DELETE to `authenticated` for new tables. Revoke those
-- and allow only SELECT: best times are mutated exclusively through the scoped
-- RPC below, never by direct client writes.
revoke all on table public.runner_personal_bests from public, anon, authenticated;
grant select on table public.runner_personal_bests to authenticated;
grant all privileges on table public.runner_personal_bests to service_role;

-- ---------------------------------------------------------------------------
-- 2. Canonical distractor read model.
-- ---------------------------------------------------------------------------

create or replace function public.load_runner_candidates(p_card_ids uuid[])
returns table (
  flashcard_id uuid,
  front text,
  correct_answer text,
  distractor_1 text,
  distractor_2 text,
  eligible boolean
)
language sql
security invoker
set search_path = ''
as $$
  select
    target.id,
    target.front,
    target.back,
    distractors.answers[1] as distractor_1,
    distractors.answers[2] as distractor_2,
    coalesce(array_length(distractors.answers, 1) >= 2, false) as eligible
  from unnest(p_card_ids) with ordinality as input(id, ord)
  join public.flashcards as target
    on target.id = input.id
   and target.user_id = auth.uid()
  cross join lateral (
    select array_agg(candidate.back order by candidate.ordering) as answers
    from (
      select distinct_backs.back, md5(distinct_backs.id::text) as ordering
      from (
        select distinct on (
          lower(regexp_replace(btrim(f.back), '\\s+', ' ', 'g'))
        ) f.id, f.back
        from public.flashcards as f
        where f.user_id = auth.uid()
          and lower(regexp_replace(btrim(f.back), '\\s+', ' ', 'g'))
              <> lower(regexp_replace(btrim(target.back), '\\s+', ' ', 'g'))
        order by
          lower(regexp_replace(btrim(f.back), '\\s+', ' ', 'g')),
          md5(f.id::text)
      ) as distinct_backs
      limit 2
    ) as candidate
  ) as distractors
  order by input.ord;
$$;

comment on function public.load_runner_candidates(uuid[]) is
  'Read-only Runner candidate read model. For each owned requested card returns the question front, the correct answer (back), up to two distinct wrong answers drawn from the authenticated user''s entire flashcard library, and an eligibility flag. No rows are returned for cards the caller does not own. Side-effect free.';

revoke all on function public.load_runner_candidates(uuid[]) from public, anon;
grant execute on function public.load_runner_candidates(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Best-time mutation RPC.
-- ---------------------------------------------------------------------------

create or replace function public.submit_runner_best_time(
  p_session_id uuid,
  p_difficulty text,
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
  v_session public.learning_coverage_sessions;
  v_question_count integer;
  v_previous_best integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_session_id is null
     or p_difficulty not in ('easy', 'medium', 'hard')
     or p_elapsed_ms is null
     or p_elapsed_ms <= 0 then
    raise exception 'invalid runner result' using errcode = '22023';
  end if;

  -- Completion validation: the referenced session must be an owned, completed
  -- Runner coverage session. The question count is derived from the immutable
  -- server-created session snapshot, never trusted from the browser.
  select * into v_session
  from public.learning_coverage_sessions s
  where s.id = p_session_id
    and s.user_id = v_user_id
    and s.mode = 'runner'
    and s.completed_at is not null;

  if not found then
    raise exception 'invalid runner session' using errcode = '22023';
  end if;

  v_question_count := cardinality(v_session.session_card_ids);

  -- Lock the existing row (if any) so concurrent submissions for the same
  -- (user, difficulty, question_count) key converge to the minimum time.
  select rpb.best_ms into v_previous_best
  from public.runner_personal_bests as rpb
  where rpb.user_id = v_user_id
    and rpb.difficulty = p_difficulty
    and rpb.question_count = v_question_count
  for update;

  -- Atomic best-only upsert: a faster time replaces, an equal/slower time is a
  -- no-op (the WHERE clause prevents touching updated_at on a non-improvement).
  insert into public.runner_personal_bests (user_id, difficulty, question_count, best_ms)
  values (v_user_id, p_difficulty, v_question_count, p_elapsed_ms)
  on conflict (user_id, difficulty, question_count)
  do update
    set best_ms = least(public.runner_personal_bests.best_ms, excluded.best_ms),
        updated_at = now()
    where public.runner_personal_bests.best_ms > excluded.best_ms;

  return query
    select
      rpb.best_ms,
      rpb.question_count,
      (v_previous_best is null or p_elapsed_ms < v_previous_best)
    from public.runner_personal_bests as rpb
    where rpb.user_id = v_user_id
      and rpb.difficulty = p_difficulty
      and rpb.question_count = v_question_count;
end;
$$;

comment on function public.submit_runner_best_time(uuid, text, integer) is
  'Submits a Runner completion time. Requires an owned, completed Runner coverage session; derives question_count from that immutable snapshot and stores the best-only minimum time atomically.';

revoke all on function public.submit_runner_best_time(uuid, text, integer) from public, anon;
grant execute on function public.submit_runner_best_time(uuid, text, integer) to authenticated;
