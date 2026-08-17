begin;
select plan(30);

-- ---------------------------------------------------------------------------
-- Setup: user A owns 8 flashcards (c1..c8). Answers exercise the latest-answer
-- rule and the untouched rule. User B owns one card to prove isolation.
-- ---------------------------------------------------------------------------

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-7777-7777-7777-777777777777', 'authenticated', 'authenticated', 'dash.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-7777-7777-7777-777777777777', 'authenticated', 'authenticated', 'dash.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.flashcard_sets (id, user_id, name) values
  ('a1a1a1a1-7777-7777-7777-777777777777', 'aaaaaaaa-7777-7777-7777-777777777777', 'Dash A'),
  ('b1b1b1b1-7777-7777-7777-777777777777', 'bbbbbbbb-7777-7777-7777-777777777777', 'Dash B');

insert into public.flashcards (id, user_id, set_id, front, back, position)
select ('ca0000' || lpad(g::text, 2, '0') || '-7777-4000-8000-000000000001')::uuid,
       'aaaaaaaa-7777-7777-7777-777777777777',
       'a1a1a1a1-7777-7777-7777-777777777777',
       'F' || g, 'B' || g, g - 1
from generate_series(1, 8) as g;

insert into public.flashcards (id, user_id, set_id, front, back, position)
values ('cb000001-7777-4000-8000-000000000001', 'bbbbbbbb-7777-7777-7777-777777777777',
        'b1b1b1b1-7777-7777-7777-777777777777', 'FB', 'BB', 0);

-- A special collection covering c5 + c6 (for scope-by-collection + dedupe).
insert into public.special_collections (id, user_id, name) values
  ('d0d0d0d0-7777-7777-7777-777777777777', 'aaaaaaaa-7777-7777-7777-777777777777', 'Dash coll');
insert into public.special_collection_items (user_id, collection_id, flashcard_id) values
  ('aaaaaaaa-7777-7777-7777-777777777777', 'd0d0d0d0-7777-7777-7777-777777777777', 'ca000005-7777-4000-8000-000000000001'),
  ('aaaaaaaa-7777-7777-7777-777777777777', 'd0d0d0d0-7777-7777-7777-777777777777', 'ca000006-7777-4000-8000-000000000001');

-- Completed quiz session: c1, c2 WRONG; c3 correct. All answered at t1.
insert into public.quiz_sessions (id, user_id, mode, requested_question_count, actual_question_count, started_at, completed_at, correct_answer_count)
values ('e0000000-7777-4000-8000-000000000000', 'aaaaaaaa-7777-7777-7777-777777777777', 'balanced', 3, 3, '2026-08-16 09:00:00+00', '2026-08-16 10:00:00+00', 1);

insert into public.quiz_questions (id, session_id, user_id, position, flashcard_id, prompt, correct_answer, choices, correct_choice_index, selected_choice_index, is_correct, answered_at)
select ('ca00' || lpad(g::text, 4, '0') || '-7777-4000-8000-000000000010')::uuid,
       'e0000000-7777-4000-8000-000000000000',
       'aaaaaaaa-7777-7777-7777-777777777777',
       g - 1,
       ('ca0000' || lpad(g::text, 2, '0') || '-7777-4000-8000-000000000001')::uuid,
       'F' || g, 'B' || g, jsonb_build_array('B' || g, 'X'), 0,
       case when g <= 2 then 1 else 0 end,
       g > 2,
       '2026-08-16 09:05:00+00'
from generate_series(1, 3) as g;

-- c4 answered in a NON-completed session -> its quiz answer must not count.
insert into public.quiz_sessions (id, user_id, mode, requested_question_count, actual_question_count, started_at, correct_answer_count)
values ('e1000000-7777-4000-8000-000000000000', 'aaaaaaaa-7777-7777-7777-777777777777', 'balanced', 1, 1, '2026-08-16 09:00:00+00', 0);
insert into public.quiz_questions (id, session_id, user_id, position, flashcard_id, prompt, correct_answer, choices, correct_choice_index, selected_choice_index, is_correct, answered_at)
values ('cb000004-7777-4000-8000-000000000010', 'e1000000-7777-4000-8000-000000000000',
        'aaaaaaaa-7777-7777-7777-777777777777', 0,
        'ca000004-7777-4000-8000-000000000001', 'F4', 'B4', jsonb_build_array('B4','X'), 0, 1, false, '2026-08-16 09:05:00+00');

-- Mode events AFTER the quiz: c1 answered CORRECT (latest correct -> not due),
-- c3 answered WRONG (latest wrong -> due). c2 stays due from the quiz.
insert into public.mode_answer_events (user_id, flashcard_id, mode, is_correct, answered_at) values
  ('aaaaaaaa-7777-7777-7777-777777777777', 'ca000001-7777-4000-8000-000000000001', 'match', true, '2026-08-16 11:00:00+00'),
  ('aaaaaaaa-7777-7777-7777-777777777777', 'ca000003-7777-4000-8000-000000000001', 'typing', false, '2026-08-16 11:05:00+00');

-- c1, c2 covered in flashcard_coverage mode='quiz' (for uncovered test).
insert into public.flashcard_coverage (user_id, mode, flashcard_id) values
  ('aaaaaaaa-7777-7777-7777-777777777777', 'quiz', 'ca000001-7777-4000-8000-000000000001'),
  ('aaaaaaaa-7777-7777-7777-777777777777', 'quiz', 'ca000002-7777-4000-8000-000000000001');

-- c7 has a card_review_event (so it is NOT untouched).
insert into public.card_review_events (user_id, flashcard_id, source, is_correct, reviewed_at) values
  ('aaaaaaaa-7777-7777-7777-777777777777', 'ca000007-7777-4000-8000-000000000001', 'study_recall', true, '2026-08-16 09:00:00+00');

-- ---------------------------------------------------------------------------
-- 1. Security boundary: grants + invoker/search_path.
-- ---------------------------------------------------------------------------

select is(
  (select prosecdef from pg_proc where oid = 'public.get_dashboard_counts()'::regprocedure),
  false,
  'get_dashboard_counts is security invoker'
);
select is(
  (select proconfig[1] = 'search_path=""' from pg_proc where oid = 'public.get_dashboard_counts()'::regprocedure),
  true,
  'get_dashboard_counts uses an empty, safe search_path'
);
select is(
  has_function_privilege('authenticated', 'public.get_dashboard_counts()', 'execute'),
  true,
  'authenticated can execute get_dashboard_counts'
);
select is(
  has_function_privilege('service_role', 'public.get_dashboard_counts()', 'execute'),
  true,
  'service_role can execute get_dashboard_counts'
);
select is(
  has_function_privilege('anon', 'public.get_dashboard_counts()', 'execute'),
  false,
  'anon cannot execute get_dashboard_counts'
);
select is(
  has_function_privilege('authenticated', 'public.get_quiz_scope_sets(uuid[], uuid[], boolean)', 'execute'),
  true,
  'authenticated can execute get_quiz_scope_sets'
);
select is(
  has_function_privilege('service_role', 'public.get_quiz_scope_sets(uuid[], uuid[], boolean)', 'execute'),
  true,
  'service_role can execute get_quiz_scope_sets'
);
select is(
  has_function_privilege('anon', 'public.get_quiz_scope_sets(uuid[], uuid[], boolean)', 'execute'),
  false,
  'anon cannot execute get_quiz_scope_sets'
);

-- ---------------------------------------------------------------------------
-- 2. get_dashboard_counts behavior (as user A).
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-7777-7777-7777-777777777777';

select is(
  (select due_count from public.get_dashboard_counts()),
  2,
  'due = quiz-wrong c2 + mode-wrong c3 (c1 latest correct excluded)'
);
select is(
  (select untouched_count from public.get_dashboard_counts()),
  4,
  'untouched = c4 (uncompleted quiz) + c5 + c6 + c8 (coverage-only)'
);

-- ---------------------------------------------------------------------------
-- 3. RLS isolation: user B sees only their own counts.
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = 'bbbbbbbb-7777-7777-7777-777777777777';
select is(
  (select due_count from public.get_dashboard_counts()),
  0,
  'user B has no due cards'
);
select is(
  (select untouched_count from public.get_dashboard_counts()),
  1,
  'user B has one untouched card (own card only)'
);

-- ---------------------------------------------------------------------------
-- 4. get_quiz_scope_sets — scope resolution.
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = 'aaaaaaaa-7777-7777-7777-777777777777';

-- all=true -> all 8 cards of user A.
select is(
  (select total from public.get_quiz_scope_sets('{}'::uuid[], '{}'::uuid[], true)),
  8,
  'all scope resolves to every user card'
);

-- By set id -> 8 cards (the whole set).
select is(
  (select total from public.get_quiz_scope_sets(array['a1a1a1a1-7777-7777-7777-777777777777']::uuid[], '{}'::uuid[], false)),
  8,
  'set scope resolves to the set cards'
);

-- By collection id -> 2 cards (c5, c6).
select is(
  (select total from public.get_quiz_scope_sets('{}'::uuid[], array['d0d0d0d0-7777-7777-7777-777777777777']::uuid[], false)),
  2,
  'collection scope resolves to its member cards'
);

-- Set + collection with overlap -> deduped (c1..c8 set + c5,c6 collection = 8).
select is(
  (select total from public.get_quiz_scope_sets(array['a1a1a1a1-7777-7777-7777-777777777777']::uuid[], array['d0d0d0d0-7777-7777-7777-777777777777']::uuid[], false)),
  8,
  'set + collection scope dedupes overlapping cards'
);

-- Unknown set -> 0.
select is(
  (select total from public.get_quiz_scope_sets(array['ffffffff-ffff-ffff-ffff-ffffffffffff']::uuid[], '{}'::uuid[], false)),
  0,
  'unknown set id yields zero scope'
);

-- ---------------------------------------------------------------------------
-- 5. get_quiz_scope_sets — appearance counts (mode=quiz) and wrong (latest answer).
-- ---------------------------------------------------------------------------

-- all scope: c1,c2 covered once (appearance_count=1), the rest 0.
select is(
  (select (appearance_counts->>'ca000001-7777-4000-8000-000000000001')::integer
   from public.get_quiz_scope_sets('{}'::uuid[], '{}'::uuid[], true)),
  1,
  'appearance_counts reports c1 covered once'
);
select is(
  (select (appearance_counts->>'ca000002-7777-4000-8000-000000000001')::integer
   from public.get_quiz_scope_sets('{}'::uuid[], '{}'::uuid[], true)),
  1,
  'appearance_counts reports c2 covered once'
);
select is(
  (select (appearance_counts->>'ca000003-7777-4000-8000-000000000001')::integer
   from public.get_quiz_scope_sets('{}'::uuid[], '{}'::uuid[], true)),
  0,
  'appearance_counts reports c3 never covered'
);
select is(
  (select (appearance_counts->>'ca000004-7777-4000-8000-000000000001')::integer
   from public.get_quiz_scope_sets('{}'::uuid[], '{}'::uuid[], true)),
  0,
  'appearance_counts reports c4 never covered'
);
select is(
  (select cardinality(wrong_ids) from public.get_quiz_scope_sets('{}'::uuid[], '{}'::uuid[], true)),
  2,
  'wrong = c2 + c3 by latest-answer rule'
);
select ok(
  (select array['ca000002-7777-4000-8000-000000000001'::uuid] <@ wrong_ids
   from public.get_quiz_scope_sets('{}'::uuid[], '{}'::uuid[], true)),
  'wrong_ids include the quiz-wrong card c2'
);
select ok(
  (select array['ca000003-7777-4000-8000-000000000001'::uuid] <@ wrong_ids
   from public.get_quiz_scope_sets('{}'::uuid[], '{}'::uuid[], true)),
  'wrong_ids include the mode-wrong card c3'
);
select ok(
  not (select array['ca000001-7777-4000-8000-000000000001'::uuid] <@ wrong_ids
   from public.get_quiz_scope_sets('{}'::uuid[], '{}'::uuid[], true)),
  'wrong_ids exclude c1 whose latest answer is correct'
);

-- Collection scope (c5,c6): both never covered (appearance 0), wrong = 0.
select is(
  (select (appearance_counts->>'ca000005-7777-4000-8000-000000000001')::integer
   from public.get_quiz_scope_sets('{}'::uuid[], array['d0d0d0d0-7777-7777-7777-777777777777']::uuid[], false)),
  0,
  'collection scope member c5 has zero appearance'
);
select is(
  (select (appearance_counts->>'ca000006-7777-4000-8000-000000000001')::integer
   from public.get_quiz_scope_sets('{}'::uuid[], array['d0d0d0d0-7777-7777-7777-777777777777']::uuid[], false)),
  0,
  'collection scope member c6 has zero appearance'
);
select is(
  (select cardinality(wrong_ids) from public.get_quiz_scope_sets('{}'::uuid[], array['d0d0d0d0-7777-7777-7777-777777777777']::uuid[], false)),
  0,
  'collection scope has no wrong cards'
);

-- ---------------------------------------------------------------------------
-- 6. Unauthenticated access is denied.
-- ---------------------------------------------------------------------------

reset role;
set local role anon;
select throws_ok(
  $$select public.get_dashboard_counts()$$,
  '42501', NULL,
  'anon calling get_dashboard_counts is denied'
);
select throws_ok(
  $$select public.get_quiz_scope_sets('{}'::uuid[], '{}'::uuid[], true)$$,
  '42501', NULL,
  'anon calling get_quiz_scope_sets is denied'
);
reset role;

select * from finish();
rollback;
