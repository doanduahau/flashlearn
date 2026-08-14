-- Capy Runner distractors are scoped to the trusted session snapshot.
--
-- The Runner foundation migration is already deployed locally, so this additive
-- migration replaces only the three functions whose eligibility and distractor
-- source depend on the question scope. Function signatures, privileges and
-- security boundaries remain unchanged.

-- ---------------------------------------------------------------------------
-- 1. Trusted creation re-validates against the proposed session, not the
--    owner's whole library. Coverage-session validation still enforces the
--    remaining snapshot invariants in the same transaction.
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

  if exists (
    select 1
    from unnest(coalesce(p_session_card_ids, '{}'::uuid[])) as input(id)
    left join public.flashcards as target
      on target.id = input.id
     and target.user_id = p_user_id
    where target.id is null
  ) then
    raise exception 'runner question is ineligible' using errcode = '22023';
  end if;

  -- Each selected question must find two distinct normalized wrong answers in
  -- this exact proposed session. Nothing outside p_session_card_ids can make a
  -- session eligible, which keeps session creation and question loading aligned.
  if exists (
    with session_cards as (
      select input.id, card.back
      from unnest(coalesce(p_session_card_ids, '{}'::uuid[])) as input(id)
      join public.flashcards as card
        on card.id = input.id
       and card.user_id = p_user_id
    )
    select 1
    from session_cards as target
    where (
      select count(distinct lower(regexp_replace(btrim(candidate.back), '\s+', ' ', 'g')))
      from session_cards as candidate
      where candidate.id <> target.id
        and lower(regexp_replace(btrim(candidate.back), '\s+', ' ', 'g'))
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
  'Trusted Runner session creation. Establishes immutable card/scope snapshots (mode runner) and a 1:1 runner_sessions config with server-established difficulty. Every selected question must have two distinct normalized wrong answers within that selected session. Service-role only.';

revoke all on function public.create_runner_session(uuid, uuid[], uuid[], text) from public, anon, authenticated;
grant execute on function public.create_runner_session(uuid, uuid[], uuid[], text) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Read-only pre-session eligibility uses only the caller's selected scope.
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
  with scope_cards as (
    select input.id, input.ord, card.back
    from unnest(p_card_ids) with ordinality as input(id, ord)
    join public.flashcards as card
      on card.id = input.id
     and card.user_id = auth.uid()
  )
  select
    target.id as flashcard_id,
    (
      select count(distinct lower(regexp_replace(btrim(candidate.back), '\s+', ' ', 'g'))) >= 2
      from scope_cards as candidate
      where candidate.id <> target.id
        and lower(regexp_replace(btrim(candidate.back), '\s+', ' ', 'g'))
            <> lower(regexp_replace(btrim(target.back), '\s+', ' ', 'g'))
    ) as eligible
  from scope_cards as target
  order by target.ord;
$$;

comment on function public.load_runner_candidate_eligibility(uuid[]) is
  'Read-only eligibility: whether a candidate can form a 3-choice Runner question (1 correct plus 2 distinct normalized wrong answers) from other cards in the authenticated user''s supplied scope. No seed, no ordering, no writes.';

revoke all on function public.load_runner_candidate_eligibility(uuid[]) from public, anon;
grant execute on function public.load_runner_candidate_eligibility(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Session question loading reads wrong answers only from the immutable
--    snapshot. The session id plus target card id gives each question an
--    independent deterministic distractor ordering.
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
  from public.runner_sessions as runner_session
  where runner_session.id = p_runner_session_id
    and runner_session.user_id = v_user_id;

  if not found then
    raise exception 'runner session not found' using errcode = '22023';
  end if;

  select * into v_coverage
  from public.learning_coverage_sessions as coverage
  where coverage.id = v_session.coverage_session_id
    and coverage.user_id = v_user_id
    and coverage.mode = 'runner';

  if not found then
    raise exception 'invalid runner session' using errcode = '22023';
  end if;

  -- Questions and distractors both come from the immutable session snapshot.
  -- A deleted or newly ineligible snapshotted card rejects the whole load so a
  -- trusted N-card session can never silently lose a question.
  for v_card in
    select input.id as snapshot_card_id, card.id as live_card_id, card.front, card.back
    from unnest(v_coverage.session_card_ids) with ordinality as input(id, ord)
    left join public.flashcards as card
      on card.id = input.id
     and card.user_id = v_user_id
    order by input.ord
  loop
    if v_card.live_card_id is null then
      raise exception 'runner session question unavailable' using errcode = '22023';
    end if;

    select jsonb_agg(choice order by ordering) into v_choices
    from (
      select v_card.back as choice,
             md5(v_card.live_card_id::text || p_runner_session_id::text || 'correct') as ordering
      union all
      select distractor.back as choice,
             md5(distractor.id::text || p_runner_session_id::text || v_card.live_card_id::text) as ordering
      from (
        select normalized_distractor.id, normalized_distractor.back
        from (
          select distinct on (lower(regexp_replace(btrim(candidate.back), '\s+', ' ', 'g')))
            candidate.id,
            candidate.back
          from unnest(v_coverage.session_card_ids) as input(id)
          join public.flashcards as candidate
            on candidate.id = input.id
           and candidate.user_id = v_user_id
          where candidate.id <> v_card.live_card_id
            and lower(regexp_replace(btrim(candidate.back), '\s+', ' ', 'g'))
                <> lower(regexp_replace(btrim(v_card.back), '\s+', ' ', 'g'))
          order by
            lower(regexp_replace(btrim(candidate.back), '\s+', ' ', 'g')),
            md5(candidate.id::text || p_runner_session_id::text || v_card.live_card_id::text)
        ) as normalized_distractor
        order by md5(normalized_distractor.id::text || p_runner_session_id::text || v_card.live_card_id::text)
        limit 2
      ) as distractor
    ) as ordered_choices;

    if v_choices is null or jsonb_array_length(v_choices) <> 3 then
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
  'Session-seeded Runner question generation. Questions and distractors come only from the immutable session snapshot. The runner session and target card ids seed deterministic distractor selection. Produces exactly one 3-choice question per snapshotted card or fails the whole load.';

revoke all on function public.load_runner_session_questions(uuid) from public, anon;
grant execute on function public.load_runner_session_questions(uuid) to authenticated;
