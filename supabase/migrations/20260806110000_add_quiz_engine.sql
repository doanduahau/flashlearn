-- Server-owned quiz sessions.  Browsers may read their own snapshots but never
-- write sessions, questions, scores, or answer keys directly.
create table public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('balanced', 'never_tested', 'wrong_answers', 'pure_random')),
  requested_question_count integer not null check (requested_question_count between 10 and 100),
  actual_question_count integer not null check (actual_question_count between 10 and 100),
  source_set_ids uuid[] not null default '{}',
  source_collection_ids uuid[] not null default '{}',
  source_all boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  correct_answer_count integer not null default 0 check (correct_answer_count between 0 and actual_question_count),
  check (completed_at is null or completed_at >= started_at)
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null check (position >= 0),
  flashcard_id uuid references public.flashcards(id) on delete set null,
  prompt text not null check (btrim(prompt) <> ''),
  correct_answer text not null check (btrim(correct_answer) <> ''),
  choices jsonb not null check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) between 2 and 4),
  correct_choice_index integer not null check (correct_choice_index between 0 and 3),
  selected_choice_index integer check (selected_choice_index between 0 and 3),
  is_correct boolean,
  answered_at timestamptz,
  constraint quiz_questions_session_position_key unique (session_id, position),
  constraint quiz_questions_session_flashcard_key unique (session_id, flashcard_id),
  check (correct_choice_index < jsonb_array_length(choices)),
  check (selected_choice_index is null or selected_choice_index < jsonb_array_length(choices)),
  check (
    (answered_at is null and selected_choice_index is null and is_correct is null)
    or (answered_at is not null and selected_choice_index is not null and is_correct is not null)
  )
);

create index idx_quiz_sessions_user_completed on public.quiz_sessions(user_id, completed_at desc);
create index idx_quiz_questions_session_position on public.quiz_questions(session_id, position);
create index idx_quiz_questions_user_flashcard on public.quiz_questions(user_id, flashcard_id);

alter table public.quiz_sessions enable row level security;
alter table public.quiz_questions enable row level security;

create policy "quiz_sessions_select_own" on public.quiz_sessions for select to authenticated using (user_id = auth.uid());
create policy "quiz_questions_select_own" on public.quiz_questions for select to authenticated using (user_id = auth.uid());

revoke all on table public.quiz_sessions from public, anon, authenticated;
revoke all on table public.quiz_questions from public, anon, authenticated;
grant select on table public.quiz_sessions, public.quiz_questions to authenticated;
grant all privileges on table public.quiz_sessions, public.quiz_questions to service_role;

create or replace function public.create_quiz_session(
  p_mode text,
  p_set_ids uuid[],
  p_collection_ids uuid[],
  p_all boolean,
  p_question_count integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_card record;
  v_choice record;
  v_choices jsonb;
  v_correct_index integer;
  v_position integer := 0;
  v_eligible_count integer;
  v_set_ids uuid[] := coalesce(p_set_ids, '{}'::uuid[]);
  v_collection_ids uuid[] := coalesce(p_collection_ids, '{}'::uuid[]);
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_mode not in ('balanced', 'never_tested', 'wrong_answers', 'pure_random')
     or p_question_count is null or p_question_count not between 10 and 100
     or p_all is null or cardinality(v_set_ids) + cardinality(v_collection_ids) > 50
     or (not p_all and cardinality(v_set_ids) + cardinality(v_collection_ids) = 0)
     or array_position(v_set_ids, null) is not null or array_position(v_collection_ids, null) is not null then
    raise exception 'invalid quiz request' using errcode = '22023';
  end if;

  if exists (select 1 from unnest(v_set_ids) as input(id) where not exists (select 1 from public.flashcard_sets s where s.id = input.id and s.user_id = v_user_id))
     or exists (select 1 from unnest(v_collection_ids) as input(id) where not exists (select 1 from public.special_collections c where c.id = input.id and c.user_id = v_user_id)) then
    raise exception 'source not found' using errcode = '22023';
  end if;

  select count(*) into v_eligible_count
  from public.flashcards f
  where f.user_id = v_user_id
    and (p_all or f.set_id = any(v_set_ids) or exists (
      select 1 from public.special_collection_items i
      where i.flashcard_id = f.id and i.user_id = v_user_id and i.collection_id = any(v_collection_ids)
    ))
    and (select count(distinct lower(regexp_replace(btrim(other.back), '\\s+', ' ', 'g')))
         from public.flashcards other
         where other.user_id = v_user_id and (p_all or other.set_id = any(v_set_ids) or exists (
           select 1 from public.special_collection_items oi where oi.flashcard_id = other.id and oi.user_id = v_user_id and oi.collection_id = any(v_collection_ids)
         ))) >= 2;

  if p_question_count > v_eligible_count then raise exception 'not enough eligible cards' using errcode = '22023'; end if;

  insert into public.quiz_sessions (user_id, mode, requested_question_count, actual_question_count, source_set_ids, source_collection_ids, source_all)
  values (v_user_id, p_mode, p_question_count, p_question_count, v_set_ids, v_collection_ids, p_all)
  returning id into v_session_id;

  for v_card in
    with eligible as (
      select f.id, f.front, f.back,
        count(q.id) filter (where s.completed_at is not null) as completed_count,
        count(q.id) filter (where s.completed_at is not null and q.is_correct = false) as wrong_count,
        max(q.answered_at) filter (where s.completed_at is not null) as last_tested_at,
        coalesce(bool_or(s.id = (select ls.id from public.quiz_sessions ls where ls.user_id = v_user_id and ls.completed_at is not null order by ls.completed_at desc limit 1)), false) as in_last_quiz
      from public.flashcards f
      left join public.quiz_questions q on q.flashcard_id = f.id and q.user_id = v_user_id
      left join public.quiz_sessions s on s.id = q.session_id
      where f.user_id = v_user_id and (p_all or f.set_id = any(v_set_ids) or exists (
        select 1 from public.special_collection_items i where i.flashcard_id = f.id and i.user_id = v_user_id and i.collection_id = any(v_collection_ids)
      ))
      group by f.id, f.front, f.back
    )
    select * from eligible
    order by
      case when p_mode = 'wrong_answers' then case when wrong_count > 0 then 0 else 1 end else 0 end,
      case when p_mode = 'wrong_answers' then wrong_count end desc,
      case when p_mode = 'wrong_answers' then wrong_count::numeric / nullif(completed_count, 0) end desc,
      case when p_mode = 'never_tested' then case when completed_count = 0 then 0 else 1 end else 0 end,
      case when p_mode <> 'pure_random' then case when completed_count = 0 then 0 else 1 end else 0 end,
      case when p_mode <> 'pure_random' then case when in_last_quiz then 1 else 0 end else 0 end,
      case when p_mode <> 'pure_random' then completed_count end asc,
      case when p_mode <> 'pure_random' then last_tested_at end asc nulls first,
      case when p_mode <> 'pure_random' then wrong_count::numeric / nullif(completed_count, 0) end desc,
      case when p_mode = 'pure_random' then random() else null end,
      md5(id::text || v_session_id::text)
    limit p_question_count
  loop
    select jsonb_agg(choice order by ordering) into v_choices
    from (
      select choice, ordering, is_correct from (
        select v_card.back as choice, md5(v_card.id::text || v_card.back) as ordering, true as is_correct
        union all
        select back, md5(v_card.id::text || id::text), false
        from (
          select distinct on (lower(regexp_replace(btrim(f.back), '\\s+', ' ', 'g'))) f.id, f.back
          from public.flashcards f
          where f.user_id = v_user_id and lower(regexp_replace(btrim(f.back), '\\s+', ' ', 'g')) <> lower(regexp_replace(btrim(v_card.back), '\\s+', ' ', 'g'))
            and (p_all or f.set_id = any(v_set_ids) or exists (select 1 from public.special_collection_items i where i.flashcard_id = f.id and i.user_id = v_user_id and i.collection_id = any(v_collection_ids)))
          order by lower(regexp_replace(btrim(f.back), '\\s+', ' ', 'g')), md5(f.id::text || v_session_id::text)
        ) distractors limit 3
      ) choices
    ) ordered;
    select ordinality - 1 into v_correct_index from jsonb_array_elements_text(v_choices) with ordinality where value = v_card.back limit 1;
    if jsonb_array_length(v_choices) < 2 then raise exception 'not enough choices' using errcode = '22023'; end if;
    insert into public.quiz_questions (session_id, user_id, position, flashcard_id, prompt, correct_answer, choices, correct_choice_index)
    values (v_session_id, v_user_id, v_position, v_card.id, v_card.front, v_card.back, v_choices, v_correct_index);
    v_position := v_position + 1;
  end loop;
  return v_session_id;
end;
$$;

create or replace function public.submit_quiz_answer(p_question_id uuid, p_selected_choice_index integer)
returns table(session_id uuid, is_correct boolean, completed boolean)
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_question public.quiz_questions; v_answered integer;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_question_id is null or p_selected_choice_index is null or p_selected_choice_index not between 0 and 3 then raise exception 'invalid answer' using errcode = '22023'; end if;
  select q.* into v_question from public.quiz_questions q join public.quiz_sessions s on s.id=q.session_id
  where q.id=p_question_id and q.user_id=v_user_id and s.user_id=v_user_id and s.completed_at is null for update of q, s;
  if not found or v_question.answered_at is not null or p_selected_choice_index >= jsonb_array_length(v_question.choices) then raise exception 'question not found' using errcode = '22023'; end if;
  update public.quiz_questions set selected_choice_index=p_selected_choice_index, is_correct=(p_selected_choice_index=v_question.correct_choice_index), answered_at=now() where id=v_question.id;
  select count(*) into v_answered from public.quiz_questions as remaining where remaining.session_id=v_question.session_id and remaining.answered_at is null;
  if v_answered = 0 then update public.quiz_sessions as target set completed_at=now(), correct_answer_count=(select count(*) from public.quiz_questions as answered where answered.session_id=v_question.session_id and answered.is_correct) where target.id=v_question.session_id; end if;
  return query select v_question.session_id, p_selected_choice_index=v_question.correct_choice_index, v_answered=0;
end;
$$;

revoke all on function public.create_quiz_session(text, uuid[], uuid[], boolean, integer) from public, anon;
revoke all on function public.submit_quiz_answer(uuid, integer) from public, anon;
grant execute on function public.create_quiz_session(text, uuid[], uuid[], boolean, integer) to authenticated;
grant execute on function public.submit_quiz_answer(uuid, integer) to authenticated;
