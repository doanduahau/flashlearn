-- Task D: real submit_quiz_answer coverage for immutable FSRS shadow facts.

begin;

select plan(23);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-2020-2020-2020-202020202020', 'authenticated', 'authenticated', 'shadow.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-2020-2020-2020-202020202020', 'authenticated', 'authenticated', 'shadow.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.flashcard_sets (id, user_id, name) values
  ('11111111-2020-2020-2020-202020202020', 'aaaaaaaa-2020-2020-2020-202020202020', 'Shadow A'),
  ('22222222-2020-2020-2020-202020202020', 'bbbbbbbb-2020-2020-2020-202020202020', 'Shadow B');

insert into public.flashcards (id, user_id, set_id, front, back) values
  ('aaaaaaaa-0000-4000-8000-000000002001', 'aaaaaaaa-2020-2020-2020-202020202020', '11111111-2020-2020-2020-202020202020', 'Correct front', 'Correct back'),
  ('aaaaaaaa-0000-4000-8000-000000002002', 'aaaaaaaa-2020-2020-2020-202020202020', '11111111-2020-2020-2020-202020202020', 'Incorrect front', 'Incorrect back'),
  ('bbbbbbbb-0000-4000-8000-000000002001', 'bbbbbbbb-2020-2020-2020-202020202020', '22222222-2020-2020-2020-202020202020', 'Foreign front', 'Foreign back');

insert into public.quiz_sessions (id, user_id, mode, requested_question_count, actual_question_count, source_set_ids, source_collection_ids, source_all)
values
  ('aaaaaaaa-0000-4000-8000-000000002101', 'aaaaaaaa-2020-2020-2020-202020202020', 'balanced', 1, 1, '{}'::uuid[], '{}'::uuid[], true),
  ('aaaaaaaa-0000-4000-8000-000000002102', 'aaaaaaaa-2020-2020-2020-202020202020', 'balanced', 1, 1, '{}'::uuid[], '{}'::uuid[], true),
  ('bbbbbbbb-0000-4000-8000-000000002101', 'bbbbbbbb-2020-2020-2020-202020202020', 'balanced', 1, 1, '{}'::uuid[], '{}'::uuid[], true);

insert into public.quiz_questions (id, session_id, user_id, position, flashcard_id, source_flashcard_id, prompt, correct_answer, choices, correct_choice_index)
values
  ('aaaaaaaa-0000-4000-8000-000000002201', 'aaaaaaaa-0000-4000-8000-000000002101', 'aaaaaaaa-2020-2020-2020-202020202020', 0, 'aaaaaaaa-0000-4000-8000-000000002001', 'aaaaaaaa-0000-4000-8000-000000002001', 'Correct front', 'Correct back', '["Correct back", "Wrong"]'::jsonb, 0),
  ('aaaaaaaa-0000-4000-8000-000000002202', 'aaaaaaaa-0000-4000-8000-000000002102', 'aaaaaaaa-2020-2020-2020-202020202020', 0, 'aaaaaaaa-0000-4000-8000-000000002002', 'aaaaaaaa-0000-4000-8000-000000002002', 'Incorrect front', 'Incorrect back', '["Wrong", "Incorrect back"]'::jsonb, 1),
  ('bbbbbbbb-0000-4000-8000-000000002201', 'bbbbbbbb-0000-4000-8000-000000002101', 'bbbbbbbb-2020-2020-2020-202020202020', 0, 'bbbbbbbb-0000-4000-8000-000000002001', 'bbbbbbbb-0000-4000-8000-000000002001', 'Foreign front', 'Foreign back', '["Foreign back", "Wrong"]'::jsonb, 0);

select ok((select prosecdef from pg_proc where oid = 'public.submit_quiz_answer(uuid,integer)'::regprocedure), 'recreated submit function remains SECURITY DEFINER');
select ok((select proconfig[1] = 'search_path=""' from pg_proc where oid = 'public.submit_quiz_answer(uuid,integer)'::regprocedure), 'recreated submit function has empty search_path');
select is(has_function_privilege('authenticated', 'public.submit_quiz_answer(uuid,integer)', 'execute'), true, 'authenticated can submit answers');
select is(has_function_privilege('anon', 'public.submit_quiz_answer(uuid,integer)', 'execute'), false, 'anon cannot submit answers');
select is(has_function_privilege('service_role', 'public.submit_quiz_answer(uuid,integer)', 'execute'), false, 'service_role has no direct answer RPC grant');
select is((select count(*) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl where p.oid = 'public.submit_quiz_answer(uuid,integer)'::regprocedure and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'), 0::bigint, 'PUBLIC has no submit RPC execute privilege');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-2020-2020-2020-202020202020';

select set_config('shadow.correct_event', (select review_event_id::text from public.submit_quiz_answer('aaaaaaaa-0000-4000-8000-000000002201'::uuid, 0)), false);
select is((select is_correct from public.quiz_questions where id = 'aaaaaaaa-0000-4000-8000-000000002201'), true, 'correct answer writes trusted correctness');
select is((select fsrs_rating from public.card_review_events where id = current_setting('shadow.correct_event')::uuid), 3::smallint, 'correct answer derives Good rating 3');
select is((select flashcard_id from public.card_review_events where id = current_setting('shadow.correct_event')::uuid), 'aaaaaaaa-0000-4000-8000-000000002001'::uuid, 'returned event is tied to the question source flashcard');
select is((select review_event_id from public.submit_quiz_answer('aaaaaaaa-0000-4000-8000-000000002201'::uuid, 0)), current_setting('shadow.correct_event')::uuid, 'retry returns the authoritative existing event id');
select is((select count(*) from public.card_review_events where quiz_question_id = 'aaaaaaaa-0000-4000-8000-000000002201'), 1::bigint, 'retry creates no second review event');
select is((select completed from public.submit_quiz_answer('aaaaaaaa-0000-4000-8000-000000002201'::uuid, 0)), true, 'retry reports already-completed session from database state');
select is((select completed_quiz_count from public.daily_learning_records where user_id = 'aaaaaaaa-2020-2020-2020-202020202020'), 1, 'retry does not double-count daily completion');
select is((select count(*) from public.quiz_sessions where id = 'aaaaaaaa-0000-4000-8000-000000002101' and completed_at is not null), 1::bigint, 'retry does not reopen or re-complete the quiz');

reset role;
update public.card_review_events set fsrs_rating = 1 where id = current_setting('shadow.correct_event')::uuid;
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-2020-2020-2020-202020202020';
select is((select review_event_id from public.submit_quiz_answer('aaaaaaaa-0000-4000-8000-000000002201'::uuid, 0)), current_setting('shadow.correct_event')::uuid, 'retry still returns the existing immutable event');
select is((select fsrs_rating from public.card_review_events where id = current_setting('shadow.correct_event')::uuid), 1::smallint, 'retry never rewrites an existing rating');
select is((select is_correct from public.card_review_events where id = current_setting('shadow.correct_event')::uuid), true, 'retry never rewrites historical correctness');
select throws_ok($$select public.submit_quiz_answer('aaaaaaaa-0000-4000-8000-000000002201'::uuid, 1)$$, '22023', 'question not found', 'a retry cannot change the selected answer');

select set_config('shadow.incorrect_event', (select review_event_id::text from public.submit_quiz_answer('aaaaaaaa-0000-4000-8000-000000002202'::uuid, 0)), false);
select is((select is_correct from public.quiz_questions where id = 'aaaaaaaa-0000-4000-8000-000000002202'), false, 'incorrect answer writes trusted correctness');
select is((select fsrs_rating from public.card_review_events where id = current_setting('shadow.incorrect_event')::uuid), 1::smallint, 'incorrect answer derives Again rating 1');
select throws_ok($$select public.submit_quiz_answer('aaaaaaaa-0000-4000-8000-000000002201'::uuid, 0, 4)$$, '42883', NULL, 'caller cannot supply an fsrs rating argument');
select throws_ok($$update public.card_review_events set fsrs_rating = 4$$, '42501', NULL, 'authenticated clients cannot mutate event ratings');

set local request.jwt.claim.sub = 'bbbbbbbb-2020-2020-2020-202020202020';
select throws_ok($$select public.submit_quiz_answer('aaaaaaaa-0000-4000-8000-000000002202'::uuid, 0)$$, '22023', 'question not found', 'foreign user cannot answer another user question');

select * from finish();
rollback;
