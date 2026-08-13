-- A Runner coverage snapshot is a complete question contract. Do not allow a
-- card that cannot produce one correct and two canonical wrong choices into a
-- trusted Runner session, and never silently omit a snapshotted card later.

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
          select distinct on (lower(regexp_replace(btrim(f.back), '\s+', ' ', 'g'))) f.id, f.back
          from public.flashcards as f
          where f.user_id = v_user_id
            and lower(regexp_replace(btrim(f.back), '\s+', ' ', 'g'))
                <> lower(regexp_replace(btrim(v_card.back), '\s+', ' ', 'g'))
          order by
            lower(regexp_replace(btrim(f.back), '\s+', ' ', 'g')),
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
