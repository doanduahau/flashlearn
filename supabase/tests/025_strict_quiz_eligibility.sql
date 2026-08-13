begin;
select plan(18);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'strict-quiz@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.flashcard_sets (id, user_id, name) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'BIG'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SMALL7'),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TINY2'),
  ('bbbbbbbb-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ZERO');

-- BIG: 30 cards. Wrong = positions 1..7, covered = positions 1..10.
insert into public.flashcards (id, user_id, set_id, front, back, position)
select ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-0000-4000-8000-000000000001', 'Q ' || n, 'A ' || n, n from generate_series(1, 30) n;
insert into public.flashcards (id, user_id, set_id, front, back, position)
select ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-0000-4000-8000-000000000002', 'Q ' || n, 'A ' || n, n from generate_series(1, 7) n;
insert into public.flashcards (id, user_id, set_id, front, back, position)
select ('30000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-0000-4000-8000-000000000003', 'Q ' || n, 'A ' || n, n from generate_series(1, 2) n;
insert into public.flashcards (id, user_id, set_id, front, back, position)
select ('40000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-0000-4000-8000-000000000004', 'Q ' || n, 'A ' || n, n from generate_series(1, 2) n;

-- Canonical wrong history: BIG positions 1..7 answered wrong in a completed Quiz.
insert into public.quiz_sessions (id, user_id, mode, requested_question_count, actual_question_count, completed_at)
values ('dddddddd-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'balanced', 7, 7, now());
insert into public.quiz_questions (session_id, user_id, position, flashcard_id, source_flashcard_id, prompt, correct_answer, choices, correct_choice_index, selected_choice_index, is_correct, answered_at)
select
  'dddddddd-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', position,
  id, id, front, back, jsonb_build_array(back, 'other'), 0, 1, false, now()
from public.flashcards
where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and set_id = 'bbbbbbbb-0000-4000-8000-000000000001' and position <= 7;

-- Quiz coverage: BIG 1..10 covered; TINY2 position 2 covered; ZERO all covered.
insert into public.flashcard_coverage (user_id, mode, flashcard_id)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'quiz', id
from public.flashcards
where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and set_id = 'bbbbbbbb-0000-4000-8000-000000000001' and position <= 10;
insert into public.flashcard_coverage (user_id, mode, flashcard_id)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'quiz', id
from public.flashcards
where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and set_id = 'bbbbbbbb-0000-4000-8000-000000000003' and position = 2;
insert into public.flashcard_coverage (user_id, mode, flashcard_id)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'quiz', id
from public.flashcards
where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and set_id = 'bbbbbbbb-0000-4000-8000-000000000004';

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- A. Câu sai is strict: only wrong-history cards.
select lives_ok(
  $$select set_config('test.wrong_session', public.create_quiz_session('wrong_answers', array['bbbbbbbb-0000-4000-8000-000000000001']::uuid[], '{}'::uuid[], false, 7)::text, true)$$,
  'Câu sai creates a session from the wrong pool'
);
select is(
  (select count(*)::integer from public.quiz_questions where session_id = current_setting('test.wrong_session')::uuid),
  7,
  'Câu sai 7 creates exactly 7 questions'
);
select is(
  (select count(*)::integer from public.quiz_questions q
   where q.session_id = current_setting('test.wrong_session')::uuid
     and q.flashcard_id = any(array(
       select f.id from public.flashcards f
       where f.user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and f.set_id = 'bbbbbbbb-0000-4000-8000-000000000001' and f.position <= 7
     ))),
  7,
  'all Câu sai questions come from the canonical wrong history'
);

-- B. No strict backfill: 7 wrong cards cannot produce 10.
select throws_ok(
  $$select public.create_quiz_session('wrong_answers', array['bbbbbbbb-0000-4000-8000-000000000001']::uuid[], '{}'::uuid[], false, 10)$$,
  '22023', 'not enough eligible cards', 'Câu sai never backfills never-wrong cards'
);

-- C. Chưa làm is strict: only uncovered cards (BIG uncovered = positions 11..30).
select lives_ok(
  $$select set_config('test.unseen_session', public.create_quiz_session('never_tested', array['bbbbbbbb-0000-4000-8000-000000000001']::uuid[], '{}'::uuid[], false, 20)::text, true)$$,
  'Chưa làm creates a session from the uncovered pool'
);
select is(
  (select count(*)::integer from public.quiz_questions where session_id = current_setting('test.unseen_session')::uuid),
  20,
  'Chưa làm 20 creates exactly 20 questions'
);
select is(
  (select count(*)::integer from public.quiz_questions q
   where q.session_id = current_setting('test.unseen_session')::uuid
     and not exists (
       select 1 from public.flashcard_coverage c
       where c.user_id = q.user_id and c.mode = 'quiz' and c.flashcard_id = q.source_flashcard_id
     )),
  20,
  'all Chưa làm questions are uncovered'
);
select throws_ok(
  $$select public.create_quiz_session('never_tested', array['bbbbbbbb-0000-4000-8000-000000000001']::uuid[], '{}'::uuid[], false, 25)$$,
  '22023', 'not enough eligible cards', 'Chưa làm never backfills covered cards'
);

-- D. Sub-10 manual Quiz: 7 eligible cards -> Tất cả 7.
select lives_ok(
  $$select set_config('test.sub10_session', public.create_quiz_session('never_tested', array['bbbbbbbb-0000-4000-8000-000000000002']::uuid[], '{}'::uuid[], false, 7)::text, true)$$,
  'sub-10 Chưa làm (7) creates a session'
);
select is(
  (select count(*)::integer from public.quiz_questions where session_id = current_setting('test.sub10_session')::uuid),
  7,
  'sub-10 creates exactly 7 questions'
);

-- E. Very small: one uncovered card.
select lives_ok(
  $$select set_config('test.one_session', public.create_quiz_session('never_tested', array['bbbbbbbb-0000-4000-8000-000000000003']::uuid[], '{}'::uuid[], false, 1)::text, true)$$,
  'one uncovered card creates a 1-question session'
);
select is(
  (select count(*)::integer from public.quiz_questions where session_id = current_setting('test.one_session')::uuid),
  1,
  'Tất cả 1 creates exactly 1 question'
);

-- F. Zero eligible: all cards covered.
select throws_ok(
  $$select public.create_quiz_session('never_tested', array['bbbbbbbb-0000-4000-8000-000000000004']::uuid[], '{}'::uuid[], false, 1)$$,
  '22023', 'not enough eligible cards', 'zero uncovered cards cannot start'
);

-- G. Random keeps the whole pool and is not restricted to uncovered/wrong.
select lives_ok(
  $$select set_config('test.random_session', public.create_quiz_session('pure_random', array['bbbbbbbb-0000-4000-8000-000000000001']::uuid[], '{}'::uuid[], false, 30)::text, true)$$,
  'Ngẫu nhiên uses the whole valid pool'
);
select is(
  (select count(*)::integer from public.quiz_questions where session_id = current_setting('test.random_session')::uuid),
  30,
  'Ngẫu nhiên creates all 30 questions'
);

-- I. No duplicate cards within a session.
select is(
  (select count(distinct flashcard_id)::integer from public.quiz_questions where session_id = current_setting('test.random_session')::uuid),
  30,
  'no duplicate card within one session'
);

-- H. Source scoping: cards outside the selected source never appear.
select is(
  (select count(*)::integer from public.quiz_questions q
   where q.session_id = current_setting('test.wrong_session')::uuid
     and q.flashcard_id = any(array(
       select f.id from public.flashcards f
       where f.user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and f.set_id <> 'bbbbbbbb-0000-4000-8000-000000000001'
     ))),
  0,
  'cards outside the selected source never appear'
);

-- J. Authorization behavior remains intact.
reset role;
set local role anon;
select throws_ok(
  $$select public.create_quiz_session('balanced', '{}'::uuid[], '{}'::uuid[], true, 10)$$,
  '42501', 'permission denied for function create_quiz_session', 'anonymous session creation is denied'
);

reset role;
select * from finish();
rollback;
