-- N8: Typing mode DB foundation.
--
-- Additive migration:
--   1. typing_attempts table (mirror of match_attempts, S5) storing the final
--      snapshot of one completed Typing session: source scope, total
--      questions, correct questions and elapsed time.
--   2. save_typing_attempt RPC (SECURITY DEFINER, service_role only).
--   3. mode_answer_events table: per-card correct/wrong events for Match and
--      Typing so "wrong cards" / "uncovered cards" / accuracy are computed
--      uniformly across all three quiz modes (quiz + match + typing). Quiz
--      already has per-card history (quiz_questions), so only match/typing
--      write here.
--   4. record_mode_answers RPC (SECURITY DEFINER, service_role only) writing
--      a batch of per-card events in one call.
--   5. Coverage mode 'typing': the mode check constraints on flashcard_coverage
--      and learning_coverage_sessions are widened, and
--      create_learning_coverage_session accepts 'typing' so "uncovered cards"
--      work for the typing mode exactly like the other modes.
--
-- The browser never writes these tables directly: the server actions call the
-- RPCs through the admin client, so RPC grants are service_role only. Table
-- grants mirror match_attempts (authenticated select-only, service_role all).

-- ---------------------------------------------------------------------------
-- 1. typing_attempts (mirror match_attempts)
-- ---------------------------------------------------------------------------

create table public.typing_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_set_ids uuid[] not null default '{}',
  source_collection_ids uuid[] not null default '{}',
  source_all boolean not null default false,
  total_questions integer not null check (total_questions > 0),
  correct_questions integer not null check (correct_questions >= 0 and correct_questions <= total_questions),
  elapsed_ms integer not null check (elapsed_ms >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (completed_at is null or completed_at >= started_at)
);

comment on table public.typing_attempts is
  'Final snapshot of one completed Typing session: source scope, total questions, correct questions and elapsed time. Written by the server via save_typing_attempt.' ;

create index idx_typing_attempts_user_completed on public.typing_attempts(user_id, completed_at desc);

alter table public.typing_attempts enable row level security;

create policy "typing_attempts_select_own"
on public.typing_attempts
for select
to authenticated
using (user_id = auth.uid());

revoke all on table public.typing_attempts from public, anon, authenticated;
grant select on table public.typing_attempts to authenticated;
grant all privileges on table public.typing_attempts to service_role;

-- ---------------------------------------------------------------------------
-- 2. save_typing_attempt
-- ---------------------------------------------------------------------------

create or replace function public.save_typing_attempt(
  p_user_id uuid,
  p_source_set_ids uuid[],
  p_source_collection_ids uuid[],
  p_source_all boolean,
  p_total_questions integer,
  p_correct_questions integer,
  p_elapsed_ms integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_set_ids uuid[] := coalesce(p_source_set_ids, '{}'::uuid[]);
  v_collection_ids uuid[] := coalesce(p_source_collection_ids, '{}'::uuid[]);
  v_attempt_id uuid;
begin
  if p_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_total_questions is null or p_total_questions <= 0
     or p_correct_questions is null or p_correct_questions < 0
     or p_correct_questions > p_total_questions
     or p_elapsed_ms is null or p_elapsed_ms < 0
     or array_position(v_set_ids, null) is not null
     or array_position(v_collection_ids, null) is not null then
    raise exception 'invalid typing attempt' using errcode = '22023';
  end if;

  insert into public.typing_attempts (
    user_id,
    source_set_ids,
    source_collection_ids,
    source_all,
    total_questions,
    correct_questions,
    elapsed_ms,
    started_at,
    completed_at
  )
  values (
    p_user_id,
    v_set_ids,
    v_collection_ids,
    coalesce(p_source_all, false),
    p_total_questions,
    p_correct_questions,
    p_elapsed_ms,
    now(),
    now()
  )
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

comment on function public.save_typing_attempt(uuid, uuid[], uuid[], boolean, integer, integer, integer) is
  'Records a completed Typing attempt for the given user: source scope, total questions, correct questions and elapsed time. Service-role only; the browser never writes typing results directly.';

revoke all on function public.save_typing_attempt(uuid, uuid[], uuid[], boolean, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.save_typing_attempt(uuid, uuid[], uuid[], boolean, integer, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 3. mode_answer_events (per-card match/typing results)
-- ---------------------------------------------------------------------------

create table public.mode_answer_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  mode text not null check (mode in ('match', 'typing')),
  is_correct boolean not null,
  answered_at timestamptz not null default now()
);

comment on table public.mode_answer_events is
  'Per-card correct/wrong results for Match and Typing sessions, used to compute wrong-card, uncovered-card and accuracy metrics uniformly across all quiz modes. Quiz keeps its own per-card history in quiz_questions.';

create index idx_mode_answer_events_user_card on public.mode_answer_events(user_id, flashcard_id, answered_at desc);
create index idx_mode_answer_events_user_completed on public.mode_answer_events(user_id, answered_at desc);

alter table public.mode_answer_events enable row level security;

create policy "mode_answer_events_select_own"
on public.mode_answer_events
for select
to authenticated
using (user_id = auth.uid());

revoke all on table public.mode_answer_events from public, anon, authenticated;
grant select on table public.mode_answer_events to authenticated;
grant all privileges on table public.mode_answer_events to service_role;

-- ---------------------------------------------------------------------------
-- 4. record_mode_answers
-- ---------------------------------------------------------------------------

create or replace function public.record_mode_answers(
  p_user_id uuid,
  p_mode text,
  p_answers jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_answer jsonb;
  v_flashcard_id uuid;
  v_is_correct boolean;
  v_count integer;
begin
  if p_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_mode is null or p_mode not in ('match', 'typing') then
    raise exception 'invalid mode' using errcode = '22023';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'invalid answers payload' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(p_answers);
  if v_count > 200 then
    raise exception 'too many answers' using errcode = '22023';
  end if;

  for v_answer in select * from jsonb_array_elements(p_answers)
  loop
    if jsonb_typeof(v_answer) <> 'object'
       or v_answer -> 'flashcard_id' is null
       or v_answer -> 'is_correct' is null
       or jsonb_typeof(v_answer -> 'flashcard_id') <> 'string'
       or jsonb_typeof(v_answer -> 'is_correct') <> 'boolean' then
      raise exception 'invalid answer entry' using errcode = '22023';
    end if;

    begin
      v_flashcard_id := (v_answer ->> 'flashcard_id')::uuid;
    exception when others then
      raise exception 'invalid answer entry' using errcode = '22023';
    end;

    v_is_correct := (v_answer ->> 'is_correct')::boolean;

    insert into public.mode_answer_events (user_id, flashcard_id, mode, is_correct)
    values (p_user_id, v_flashcard_id, p_mode, v_is_correct);
  end loop;
end;
$$;

comment on function public.record_mode_answers(uuid, text, jsonb) is
  'Records up to 200 per-card correct/wrong events for a completed Match or Typing session (mode must be match or typing). The cards are not ownership-verified here: the user only ever plays their own cards and RLS blocks direct writes; SECURITY DEFINER bypasses RLS by design. Service-role only.';

revoke all on function public.record_mode_answers(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_mode_answers(uuid, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Coverage mode 'typing'
-- ---------------------------------------------------------------------------

alter table public.flashcard_coverage
  drop constraint flashcard_coverage_mode_check,
  add constraint flashcard_coverage_mode_check check (mode in ('quiz', 'match', 'memory', 'runner', 'typing'));

alter table public.learning_coverage_sessions
  drop constraint learning_coverage_sessions_mode_check,
  add constraint learning_coverage_sessions_mode_check check (mode in ('quiz', 'match', 'memory', 'runner', 'typing'));

create or replace function public.create_learning_coverage_session(
  p_user_id uuid,
  p_mode text,
  p_session_card_ids uuid[],
  p_scope_card_ids uuid[],
  p_quiz_session_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_session_card_ids uuid[] := coalesce(p_session_card_ids, '{}'::uuid[]);
  v_scope_card_ids uuid[] := coalesce(p_scope_card_ids, '{}'::uuid[]);
begin
  if p_user_id is null
     or p_mode not in ('quiz', 'match', 'memory', 'runner', 'typing')
     or cardinality(v_session_card_ids) is null
     or cardinality(v_scope_card_ids) is null
     or cardinality(v_session_card_ids) = 0
     or cardinality(v_scope_card_ids) = 0
     or array_position(v_session_card_ids, null) is not null
     or array_position(v_scope_card_ids, null) is not null
     or cardinality(v_session_card_ids) <> cardinality(array(select distinct id from unnest(v_session_card_ids) as input(id)))
     or cardinality(v_scope_card_ids) <> cardinality(array(select distinct id from unnest(v_scope_card_ids) as input(id)))
     or exists (select 1 from unnest(v_session_card_ids) as input(id) where not input.id = any(v_scope_card_ids)) then
    raise exception 'invalid coverage session' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_scope_card_ids) as input(id)
    where not exists (
      select 1 from public.flashcards f where f.id = input.id and f.user_id = p_user_id
    )
  ) then
    raise exception 'coverage cards not owned' using errcode = '42501';
  end if;

  if p_mode = 'quiz' then
    if p_quiz_session_id is null or not exists (
      select 1 from public.quiz_sessions q
      where q.id = p_quiz_session_id and q.user_id = p_user_id and q.origin = 'manual'
    ) then
      raise exception 'invalid quiz coverage session' using errcode = '22023';
    end if;
  elsif p_quiz_session_id is not null then
    raise exception 'quiz reference is only valid for quiz coverage' using errcode = '22023';
  end if;

  insert into public.learning_coverage_sessions (
    user_id, mode, session_card_ids, scope_card_ids, quiz_session_id
  ) values (
    p_user_id, p_mode, v_session_card_ids, v_scope_card_ids, p_quiz_session_id
  ) returning id into v_session_id;

  return v_session_id;
end;
$$;

revoke all on function public.create_learning_coverage_session(uuid, text, uuid[], uuid[], uuid) from public, anon, authenticated;
grant execute on function public.create_learning_coverage_session(uuid, text, uuid[], uuid[], uuid) to service_role;
