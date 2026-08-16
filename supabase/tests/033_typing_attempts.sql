begin;
select plan(64);

-- ---------------------------------------------------------------------------
-- Setup: users A and B; A owns a set with 3 flashcards used for event rows and
-- coverage sessions. B is used for RLS isolation.
-- ---------------------------------------------------------------------------

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-6666-6666-6666-666666666666', 'authenticated', 'authenticated', 'typing.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-6666-6666-6666-666666666666', 'authenticated', 'authenticated', 'typing.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.flashcard_sets (id, user_id, name) values
  ('a1a1a1a1-6666-6666-6666-666666666666', 'aaaaaaaa-6666-6666-6666-666666666666', 'Typing A');

insert into public.flashcards (id, user_id, set_id, front, back, position) values
  ('ca000001-6666-4000-8000-000000000001', 'aaaaaaaa-6666-6666-6666-666666666666', 'a1a1a1a1-6666-6666-6666-666666666666', 'QA1', 'AA1', 1),
  ('ca000002-6666-4000-8000-000000000002', 'aaaaaaaa-6666-6666-6666-666666666666', 'a1a1a1a1-6666-6666-6666-666666666666', 'QA2', 'AA2', 2),
  ('ca000003-6666-4000-8000-000000000003', 'aaaaaaaa-6666-6666-6666-666666666666', 'a1a1a1a1-6666-6666-6666-666666666666', 'QA3', 'AA3', 3);

-- ---------------------------------------------------------------------------
-- 1. Security boundary: SECURITY DEFINER, empty search_path, service_role only
--    for both RPCs.
-- ---------------------------------------------------------------------------

select ok(
  (select prosecdef from pg_proc where oid = 'public.save_typing_attempt(uuid,uuid[],uuid[],boolean,integer,integer,integer)'::regprocedure),
  'save_typing_attempt is SECURITY DEFINER'
);
select ok(
  (select proconfig[1] = 'search_path=""' from pg_proc where oid = 'public.save_typing_attempt(uuid,uuid[],uuid[],boolean,integer,integer,integer)'::regprocedure),
  'save_typing_attempt has empty search_path'
);
select is(
  has_function_privilege('authenticated', 'public.save_typing_attempt(uuid,uuid[],uuid[],boolean,integer,integer,integer)', 'execute'),
  false,
  'authenticated cannot execute save_typing_attempt'
);
select is(
  has_function_privilege('anon', 'public.save_typing_attempt(uuid,uuid[],uuid[],boolean,integer,integer,integer)', 'execute'),
  false,
  'anon cannot execute save_typing_attempt'
);
select is(
  has_function_privilege('service_role', 'public.save_typing_attempt(uuid,uuid[],uuid[],boolean,integer,integer,integer)', 'execute'),
  true,
  'service_role can execute save_typing_attempt'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.record_mode_answers(uuid,text,jsonb)'::regprocedure),
  'record_mode_answers is SECURITY DEFINER'
);
select ok(
  (select proconfig[1] = 'search_path=""' from pg_proc where oid = 'public.record_mode_answers(uuid,text,jsonb)'::regprocedure),
  'record_mode_answers has empty search_path'
);
select is(
  has_function_privilege('authenticated', 'public.record_mode_answers(uuid,text,jsonb)', 'execute'),
  false,
  'authenticated cannot execute record_mode_answers'
);
select is(
  has_function_privilege('anon', 'public.record_mode_answers(uuid,text,jsonb)', 'execute'),
  false,
  'anon cannot execute record_mode_answers'
);
select is(
  has_function_privilege('service_role', 'public.record_mode_answers(uuid,text,jsonb)', 'execute'),
  true,
  'service_role can execute record_mode_answers'
);

-- ---------------------------------------------------------------------------
-- 2. typing_attempts table: RLS on, select_own policy, select-only for
--    authenticated, all for service_role.
-- ---------------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = 'public.typing_attempts'::regclass),
  'typing_attempts has RLS enabled'
);
select is(
  (select count(*) from pg_policies
   where schemaname = 'public' and tablename = 'typing_attempts'
     and policyname = 'typing_attempts_select_own' and cmd = 'SELECT'
     and roles = '{authenticated}'::name[]),
  1::bigint,
  'typing_attempts_select_own policy exists for authenticated select'
);
select is(
  has_table_privilege('authenticated', 'public.typing_attempts', 'select'),
  true,
  'authenticated can select typing_attempts'
);
select is(
  has_table_privilege('authenticated', 'public.typing_attempts', 'insert'),
  false,
  'authenticated cannot insert typing_attempts directly'
);
select is(
  has_table_privilege('authenticated', 'public.typing_attempts', 'update'),
  false,
  'authenticated cannot update typing_attempts directly'
);
select is(
  has_table_privilege('authenticated', 'public.typing_attempts', 'delete'),
  false,
  'authenticated cannot delete typing_attempts directly'
);
select is(
  has_table_privilege('service_role', 'public.typing_attempts', 'select'),
  true,
  'service_role can select typing_attempts'
);
select is(
  has_table_privilege('service_role', 'public.typing_attempts', 'insert'),
  true,
  'service_role can insert typing_attempts'
);
select is(
  has_table_privilege('service_role', 'public.typing_attempts', 'update'),
  true,
  'service_role can update typing_attempts'
);
select is(
  has_table_privilege('service_role', 'public.typing_attempts', 'delete'),
  true,
  'service_role can delete typing_attempts'
);

-- ---------------------------------------------------------------------------
-- 3. Valid insert: returns an id, stores user + counts + elapsed, completed_at
--    is set at or after started_at.
-- ---------------------------------------------------------------------------

select set_config('typing.attempt_id', (
  select public.save_typing_attempt(
    'aaaaaaaa-6666-6666-6666-666666666666',
    array['11111111-6666-6666-6666-666666666666']::uuid[],
    '{}'::uuid[],
    false,
    12,
    9,
    45000
  )::text
), false);
select is(
  (select user_id::text from public.typing_attempts where id = current_setting('typing.attempt_id')::uuid),
  'aaaaaaaa-6666-6666-6666-666666666666',
  'attempt stores the given user_id'
);
select is(
  (select total_questions from public.typing_attempts where id = current_setting('typing.attempt_id')::uuid),
  12,
  'attempt stores total_questions'
);
select is(
  (select correct_questions from public.typing_attempts where id = current_setting('typing.attempt_id')::uuid),
  9,
  'attempt stores correct_questions'
);
select is(
  (select elapsed_ms from public.typing_attempts where id = current_setting('typing.attempt_id')::uuid),
  45000,
  'attempt stores elapsed_ms'
);
select ok(
  (select completed_at is not null from public.typing_attempts where id = current_setting('typing.attempt_id')::uuid),
  'attempt records completed_at on save'
);
select ok(
  (select completed_at >= started_at from public.typing_attempts where id = current_setting('typing.attempt_id')::uuid),
  'completed_at is not before started_at'
);
select is(
  (select source_all from public.typing_attempts where id = current_setting('typing.attempt_id')::uuid),
  false,
  'attempt stores source_all'
);

-- ---------------------------------------------------------------------------
-- 4. Input validation for save_typing_attempt.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.save_typing_attempt(NULL, '{}'::uuid[], '{}'::uuid[], false, 12, 12, 1000)$$,
  '42501', NULL,
  'null user raises 42501'
);
select throws_ok(
  $$select public.save_typing_attempt('aaaaaaaa-6666-6666-6666-666666666666', '{}'::uuid[], '{}'::uuid[], false, 0, 0, 1000)$$,
  '22023', 'invalid typing attempt',
  'total_questions = 0 raises 22023'
);
select throws_ok(
  $$select public.save_typing_attempt('aaaaaaaa-6666-6666-6666-666666666666', '{}'::uuid[], '{}'::uuid[], false, 10, 11, 1000)$$,
  '22023', 'invalid typing attempt',
  'correct_questions > total_questions raises 22023'
);
select throws_ok(
  $$select public.save_typing_attempt('aaaaaaaa-6666-6666-6666-666666666666', '{}'::uuid[], '{}'::uuid[], false, 10, 5, -1)$$,
  '22023', 'invalid typing attempt',
  'elapsed_ms < 0 raises 22023'
);
select throws_ok(
  $$select public.save_typing_attempt('aaaaaaaa-6666-6666-6666-666666666666', array[NULL::uuid], '{}'::uuid[], false, 10, 5, 1000)$$,
  '22023', 'invalid typing attempt',
  'null element in source arrays raises 22023'
);
select lives_ok(
  $$select public.save_typing_attempt('aaaaaaaa-6666-6666-6666-666666666666', NULL, NULL, false, 6, 6, 2000)$$,
  'null source arrays are accepted'
);
select is(
  (select count(*)::integer from public.typing_attempts
   where user_id = 'aaaaaaaa-6666-6666-6666-666666666666'
     and source_set_ids = '{}'::uuid[] and source_collection_ids = '{}'::uuid[] and total_questions = 6),
  1,
  'null source arrays coerce to empty arrays'
);

-- ---------------------------------------------------------------------------
-- 5. mode_answer_events table: RLS on, select_own policy, select-only for
--    authenticated, all for service_role.
-- ---------------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = 'public.mode_answer_events'::regclass),
  'mode_answer_events has RLS enabled'
);
select is(
  (select count(*) from pg_policies
   where schemaname = 'public' and tablename = 'mode_answer_events'
     and policyname = 'mode_answer_events_select_own' and cmd = 'SELECT'
     and roles = '{authenticated}'::name[]),
  1::bigint,
  'mode_answer_events_select_own policy exists for authenticated select'
);
select is(
  has_table_privilege('authenticated', 'public.mode_answer_events', 'select'),
  true,
  'authenticated can select mode_answer_events'
);
select is(
  has_table_privilege('authenticated', 'public.mode_answer_events', 'insert'),
  false,
  'authenticated cannot insert mode_answer_events directly'
);
select is(
  has_table_privilege('authenticated', 'public.mode_answer_events', 'update'),
  false,
  'authenticated cannot update mode_answer_events directly'
);
select is(
  has_table_privilege('authenticated', 'public.mode_answer_events', 'delete'),
  false,
  'authenticated cannot delete mode_answer_events directly'
);
select is(
  has_table_privilege('service_role', 'public.mode_answer_events', 'select'),
  true,
  'service_role can select mode_answer_events'
);
select is(
  has_table_privilege('service_role', 'public.mode_answer_events', 'insert'),
  true,
  'service_role can insert mode_answer_events'
);
select is(
  has_table_privilege('service_role', 'public.mode_answer_events', 'update'),
  true,
  'service_role can update mode_answer_events'
);
select is(
  has_table_privilege('service_role', 'public.mode_answer_events', 'delete'),
  true,
  'service_role can delete mode_answer_events'
);

-- ---------------------------------------------------------------------------
-- 6. record_mode_answers: valid batches, mode/format/limit validation.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.record_mode_answers(
    'aaaaaaaa-6666-6666-6666-666666666666',
    'typing',
    jsonb_build_array(
      jsonb_build_object('flashcard_id', 'ca000001-6666-4000-8000-000000000001', 'is_correct', true),
      jsonb_build_object('flashcard_id', 'ca000002-6666-4000-8000-000000000002', 'is_correct', false)
    )
  )$$,
  'records a valid typing batch'
);
select is(
  (select count(*)::integer from public.mode_answer_events
   where user_id = 'aaaaaaaa-6666-6666-6666-666666666666' and mode = 'typing'),
  2,
  'typing batch inserts one row per entry'
);
select is(
  (select is_correct from public.mode_answer_events
   where user_id = 'aaaaaaaa-6666-6666-6666-666666666666' and mode = 'typing'
     and flashcard_id = 'ca000002-6666-4000-8000-000000000002'),
  false,
  'entry stores its is_correct value'
);
select lives_ok(
  $$select public.record_mode_answers(
    'aaaaaaaa-6666-6666-6666-666666666666',
    'match',
    jsonb_build_array(
      jsonb_build_object('flashcard_id', 'ca000003-6666-4000-8000-000000000003', 'is_correct', true)
    )
  )$$,
  'records a valid match batch'
);
select is(
  (select count(*)::integer from public.mode_answer_events
   where user_id = 'aaaaaaaa-6666-6666-6666-666666666666' and mode = 'match'),
  1,
  'match batch inserts one row per entry'
);
select throws_ok(
  $$select public.record_mode_answers(NULL, 'typing', '[]'::jsonb)$$,
  '42501', NULL,
  'null user raises 42501'
);
select throws_ok(
  $$select public.record_mode_answers('aaaaaaaa-6666-6666-6666-666666666666', 'quiz', '[]'::jsonb)$$,
  '22023', 'invalid mode',
  'mode outside match/typing raises 22023'
);
select throws_ok(
  $$select public.record_mode_answers('aaaaaaaa-6666-6666-6666-666666666666', 'typing', '{"a":1}'::jsonb)$$,
  '22023', 'invalid answers payload',
  'non-array payload raises 22023'
);
select throws_ok(
  $$select public.record_mode_answers('aaaaaaaa-6666-6666-6666-666666666666', 'typing', '[{"flashcard_id": "ca000001-6666-4000-8000-000000000001"}]'::jsonb)$$,
  '22023', 'invalid answer entry',
  'entry missing is_correct raises 22023'
);
select throws_ok(
  $$select public.record_mode_answers('aaaaaaaa-6666-6666-6666-666666666666', 'typing', '[{"flashcard_id": "not-a-uuid", "is_correct": true}]'::jsonb)$$,
  '22023', 'invalid answer entry',
  'non-uuid flashcard_id raises 22023'
);
select throws_ok(
  $$select public.record_mode_answers('aaaaaaaa-6666-6666-6666-666666666666', 'typing',
    (select jsonb_agg(jsonb_build_object('flashcard_id', 'ca000001-6666-4000-8000-000000000001', 'is_correct', true))
     from generate_series(1, 201)))$$,
  '22023', 'too many answers',
  'more than 200 entries raises 22023'
);

-- ---------------------------------------------------------------------------
-- 7. Coverage mode typing: sessions and per-card coverage accept the typing
--    mode; unknown modes stay rejected.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.create_learning_coverage_session(
    'aaaaaaaa-6666-6666-6666-666666666666',
    'typing',
    array['ca000001-6666-4000-8000-000000000001','ca000002-6666-4000-8000-000000000002']::uuid[],
    array['ca000001-6666-4000-8000-000000000001','ca000002-6666-4000-8000-000000000002','ca000003-6666-4000-8000-000000000003']::uuid[]
  )$$,
  'creates a typing coverage session'
);
select is(
  (select mode from public.learning_coverage_sessions
   where user_id = 'aaaaaaaa-6666-6666-6666-666666666666' and mode = 'typing'),
  'typing',
  'typing coverage session is stored with typing mode'
);
select lives_ok(
  $$insert into public.flashcard_coverage (user_id, mode, flashcard_id)
    values ('aaaaaaaa-6666-6666-6666-666666666666', 'typing', 'ca000001-6666-4000-8000-000000000001')$$,
  'flashcard_coverage accepts mode typing'
);
select throws_ok(
  $$select public.create_learning_coverage_session(
    'aaaaaaaa-6666-6666-6666-666666666666',
    'bogus',
    array['ca000001-6666-4000-8000-000000000001']::uuid[],
    array['ca000001-6666-4000-8000-000000000001']::uuid[]
  )$$,
  '22023', 'invalid coverage session',
  'create_learning_coverage_session still rejects unknown modes'
);
select throws_ok(
  $$insert into public.learning_coverage_sessions (user_id, mode, session_card_ids, scope_card_ids)
    values ('aaaaaaaa-6666-6666-6666-666666666666', 'bogus',
            array['ca000001-6666-4000-8000-000000000001']::uuid[],
            array['ca000001-6666-4000-8000-000000000001']::uuid[])$$,
  '23514', NULL,
  'learning_coverage_sessions constraint rejects unknown modes'
);

-- ---------------------------------------------------------------------------
-- 8. Isolation: B cannot read A rows through RLS; B can read its own rows.
-- ---------------------------------------------------------------------------

select set_config('typing.b_attempt_id', (
  select public.save_typing_attempt(
    'bbbbbbbb-6666-6666-6666-666666666666',
    '{}'::uuid[],
    '{}'::uuid[],
    true,
    12,
    8,
    60000
  )::text
), false);

select public.record_mode_answers(
  'bbbbbbbb-6666-6666-6666-666666666666',
  'typing',
  jsonb_build_array(
    jsonb_build_object('flashcard_id', 'ca000001-6666-4000-8000-000000000001', 'is_correct', true)
  )
);

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-6666-6666-6666-666666666666';
select is(
  (select count(*)::integer from public.typing_attempts where user_id = 'aaaaaaaa-6666-6666-6666-666666666666'),
  0,
  'RLS hides another user''s typing attempts'
);
select is(
  (select count(*)::integer from public.typing_attempts where user_id = 'bbbbbbbb-6666-6666-6666-666666666666'),
  1,
  'authenticated can read own typing attempts'
);
select is(
  (select count(*)::integer from public.mode_answer_events where user_id = 'aaaaaaaa-6666-6666-6666-666666666666'),
  0,
  'RLS hides another user''s mode answer events'
);
select is(
  (select count(*)::integer from public.mode_answer_events where user_id = 'bbbbbbbb-6666-6666-6666-666666666666'),
  1,
  'authenticated can read own mode answer events'
);
reset role;

select * from finish();
rollback;
