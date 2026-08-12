begin;
select plan(6);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-c4c0-c0c0-c0c0-c0c0c0c0c0c0', 'authenticated', 'authenticated', 'quiz-coverage@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
insert into public.flashcard_sets (id, user_id, name) values ('a1a1a1a1-c4c0-c0c0-c0c0-c0c0c0c0c0c0', 'aaaaaaaa-c4c0-c0c0-c0c0-c0c0c0c0c0c0', 'Quiz coverage');

insert into public.flashcards (id, user_id, set_id, front, back, position)
select
  ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'aaaaaaaa-c4c0-c0c0-c0c0-c0c0c0c0c0c0',
  'a1a1a1a1-c4c0-c0c0-c0c0-c0c0c0c0c0c0',
  'Question ' || n,
  'Answer ' || n,
  n
from generate_series(1, 15) as n;

-- Give every card historical completed Quiz data. Coverage must still be the
-- priority source, not the old completed_count=0 heuristic.
insert into public.quiz_sessions (id, user_id, mode, requested_question_count, actual_question_count, completed_at)
values ('d4000000-c4c0-4000-8000-000000000000', 'aaaaaaaa-c4c0-c0c0-c0c0-c0c0c0c0c0c0', 'balanced', 15, 15, now());
insert into public.quiz_questions (session_id, user_id, position, flashcard_id, source_flashcard_id, prompt, correct_answer, choices, correct_choice_index, selected_choice_index, is_correct, answered_at)
select
  'd4000000-c4c0-4000-8000-000000000000',
  'aaaaaaaa-c4c0-c0c0-c0c0-c0c0c0c0c0c0',
  position,
  id, id, front, back, jsonb_build_array(back, 'other'), 0, 0, true, now()
from public.flashcards where user_id = 'aaaaaaaa-c4c0-c0c0-c0c0-c0c0c0c0c0c0';

insert into public.flashcard_coverage (user_id, mode, flashcard_id)
select 'aaaaaaaa-c4c0-c0c0-c0c0-c0c0c0c0c0c0', 'quiz', id
from public.flashcards
where user_id = 'aaaaaaaa-c4c0-c0c0-c0c0-c0c0c0c0c0c0' and position <= 12;

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-c4c0-c0c0-c0c0-c0c0c0c0c0c0';
select lives_ok(
  $$select set_config('test.quiz_coverage_session', public.create_quiz_session('balanced', array[]::uuid[], array[]::uuid[], true, 12)::text, true)$$,
  'traditional Quiz creates a coverage-aware session'
);

select is(
  (select count(*)::integer from public.quiz_questions where session_id = current_setting('test.quiz_coverage_session')::uuid),
  12,
  '15-card scope creates the requested 12-question Quiz'
);
select is(
  (select count(*)::integer
   from public.quiz_questions q
   where q.session_id = current_setting('test.quiz_coverage_session')::uuid
     and not exists (
       select 1 from public.flashcard_coverage c
       where c.user_id = q.user_id and c.mode = 'quiz' and c.flashcard_id = q.source_flashcard_id
     )),
  3,
  'all three coverage-unseen cards are selected despite historical completed_count'
);
select is(
  (select count(*)::integer
   from public.quiz_questions q
   join public.flashcard_coverage c
     on c.user_id = q.user_id and c.mode = 'quiz' and c.flashcard_id = q.source_flashcard_id
   where q.session_id = current_setting('test.quiz_coverage_session')::uuid),
  9,
  'the remaining nine positions may use covered cards without replacement'
);
select is(
  (select count(*)::integer from public.learning_coverage_sessions
   where quiz_session_id = current_setting('test.quiz_coverage_session')::uuid
     and mode = 'quiz'),
  1,
  'manual Quiz persists exactly one durable quiz coverage session'
);
select is(
  (select cardinality(scope_card_ids) from public.learning_coverage_sessions
   where quiz_session_id = current_setting('test.quiz_coverage_session')::uuid),
  15,
  'manual Quiz ledger snapshots the entire selected eligible scope'
);

reset role;
select * from finish();
rollback;
