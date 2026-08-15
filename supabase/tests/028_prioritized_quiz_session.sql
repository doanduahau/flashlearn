begin;
select plan(22);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'prio.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'prio.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.flashcard_sets (id, user_id, name) values
  ('a1a1a1a1-3333-3333-3333-333333333333', 'aaaaaaaa-3333-3333-3333-333333333333', 'Prio set'),
  ('b1b1b1b1-3333-3333-3333-333333333333', 'bbbbbbbb-3333-3333-3333-333333333333', 'Prio B set');

-- User A: 12 cards with distinct backs (distractor pool), ids c1..c12.
insert into public.flashcards (id, user_id, set_id, front, back, position)
select
  ('ca000001-3333-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'aaaaaaaa-3333-3333-3333-333333333333',
  'a1a1a1a1-3333-3333-3333-333333333333',
  'Q ' || n,
  'A ' || n,
  n
from generate_series(1, 12) n;

-- User B: one card that must never leak into user A's distractor/ownership set.
insert into public.flashcards (id, user_id, set_id, front, back, position)
values ('cb000001-3333-4000-8000-000000000001', 'bbbbbbbb-3333-3333-3333-333333333333', 'b1b1b1b1-3333-3333-3333-333333333333', 'BF', 'BA', 1);

-- Security boundary: the trusted creation entry point is service-role only.
select ok(
  (select prosecdef from pg_proc where oid = 'public.create_quiz_session_prioritized(uuid,uuid[],uuid[],integer)'::regprocedure),
  'prioritized Quiz RPC remains SECURITY DEFINER'
);
select ok(
  (select proconfig[1] = 'search_path=""' from pg_proc where oid = 'public.create_quiz_session_prioritized(uuid,uuid[],uuid[],integer)'::regprocedure),
  'prioritized Quiz RPC retains empty search_path'
);
select is(
  has_function_privilege('authenticated', 'public.create_quiz_session_prioritized(uuid,uuid[],uuid[],integer)', 'execute'),
  false,
  'authenticated cannot execute the prioritized Quiz RPC'
);
select is(
  has_function_privilege('anon', 'public.create_quiz_session_prioritized(uuid,uuid[],uuid[],integer)', 'execute'),
  false,
  'anon cannot execute the prioritized Quiz RPC'
);
select is(
  has_function_privilege('service_role', 'public.create_quiz_session_prioritized(uuid,uuid[],uuid[],integer)', 'execute'),
  true,
  'service_role can execute the prioritized Quiz RPC'
);

-- The prioritized RPC accepts a fixed ordered card list and produces exactly one
-- question per card, preserving the given order.
select set_config('prio.test_sid', public.create_quiz_session_prioritized(
  'aaaaaaaa-3333-3333-3333-333333333333',
  array[
    'ca000001-3333-4000-8000-000000000003'::uuid,
    'ca000001-3333-4000-8000-000000000007'::uuid,
    'ca000001-3333-4000-8000-000000000010'::uuid
  ],
  array[
    'ca000001-3333-4000-8000-000000000001'::uuid,
    'ca000001-3333-4000-8000-000000000002'::uuid,
    'ca000001-3333-4000-8000-000000000003'::uuid,
    'ca000001-3333-4000-8000-000000000004'::uuid,
    'ca000001-3333-4000-8000-000000000005'::uuid,
    'ca000001-3333-4000-8000-000000000006'::uuid,
    'ca000001-3333-4000-8000-000000000007'::uuid,
    'ca000001-3333-4000-8000-000000000008'::uuid,
    'ca000001-3333-4000-8000-000000000009'::uuid,
    'ca000001-3333-4000-8000-000000000010'::uuid,
    'ca000001-3333-4000-8000-000000000011'::uuid,
    'ca000001-3333-4000-8000-000000000012'::uuid
  ],
  3
)::text, false);

select is(
  (select count(*)::integer from public.quiz_questions where session_id = current_setting('prio.test_sid')::uuid),
  3,
  'prioritized RPC creates exactly one question per card'
);
select is(
  (select string_agg(source_flashcard_id::text, ',' order by position)
   from public.quiz_questions
   where session_id = current_setting('prio.test_sid')::uuid),
  'ca000001-3333-4000-8000-000000000003,ca000001-3333-4000-8000-000000000007,ca000001-3333-4000-8000-000000000010',
  'questions preserve the given prioritized card order'
);
select is(
  (select mode from public.quiz_sessions where id = current_setting('prio.test_sid')::uuid),
  'balanced',
  'prioritized session uses the balanced engine mode'
);
select is(
  (select origin from public.quiz_sessions where id = current_setting('prio.test_sid')::uuid),
  'manual',
  'prioritized session origin stays manual'
);
select is(
  (select count(*)::integer from public.learning_coverage_sessions
   where quiz_session_id = current_setting('prio.test_sid')::uuid and mode = 'quiz'),
  1,
  'prioritized session creates one quiz coverage snapshot'
);

-- Distractors come from the scope (user A's other cards) and never repeat.
select is(
  (select count(*)::integer
   from public.quiz_questions q, jsonb_array_elements_text(q.choices) choice
   where q.session_id = current_setting('prio.test_sid')::uuid
     and (choice.value = 'BA' or choice.value is null)),
  0,
  'distractors never come from another user or null choices'
);
select is(
  (select bool_and(jsonb_array_length(q.choices) = array_length(array(select distinct choice from jsonb_array_elements_text(q.choices) choice), 1))
   from public.quiz_questions q
   where q.session_id = current_setting('prio.test_sid')::uuid),
  true,
  'no duplicate choice within any question'
);
select is(
  (select count(distinct q.correct_answer)::integer
   from public.quiz_questions q
   where q.session_id = current_setting('prio.test_sid')::uuid),
  3,
  'each question keeps its own correct answer'
);

-- Ownership: a card from another user is rejected before any session is made.
select throws_ok(
  $$select public.create_quiz_session_prioritized(
    'aaaaaaaa-3333-3333-3333-333333333333',
    array['cb000001-3333-4000-8000-000000000001'::uuid],
    array['cb000001-3333-4000-8000-000000000001'::uuid],
    1
  )$$,
  '42501', NULL,
  'prioritized RPC rejects cards not owned by the user'
);

-- Scope membership: a selected card outside the scope is rejected.
select throws_ok(
  $$select public.create_quiz_session_prioritized(
    'aaaaaaaa-3333-3333-3333-333333333333',
    array['ca000001-3333-4000-8000-000000000001'::uuid],
    array['ca000001-3333-4000-8000-000000000002'::uuid, 'ca000001-3333-4000-8000-000000000003'::uuid],
    1
  )$$,
  '22023', NULL,
  'prioritized RPC rejects a card outside the given scope'
);

-- Duplicate card ids are rejected.
select throws_ok(
  $$select public.create_quiz_session_prioritized(
    'aaaaaaaa-3333-3333-3333-333333333333',
    array['ca000001-3333-4000-8000-000000000001'::uuid, 'ca000001-3333-4000-8000-000000000001'::uuid],
    array['ca000001-3333-4000-8000-000000000001'::uuid, 'ca000001-3333-4000-8000-000000000002'::uuid],
    2
  )$$,
  '22023', NULL,
  'prioritized RPC rejects duplicate card ids'
);

-- question_count must match the number of supplied cards.
select throws_ok(
  $$select public.create_quiz_session_prioritized(
    'aaaaaaaa-3333-3333-3333-333333333333',
    array['ca000001-3333-4000-8000-000000000001'::uuid, 'ca000001-3333-4000-8000-000000000002'::uuid],
    array['ca000001-3333-4000-8000-000000000001'::uuid, 'ca000001-3333-4000-8000-000000000002'::uuid],
    1
  )$$,
  '22023', NULL,
  'prioritized RPC rejects a count that does not match the card list'
);

-- A duplicate back in the scope (no eligible distractors) rolls back atomically
-- instead of leaving a partial session behind.
insert into public.flashcards (id, user_id, set_id, front, back, position)
values ('ca000013-3333-4000-8000-000000000013', 'aaaaaaaa-3333-3333-3333-333333333333', 'a1a1a1a1-3333-3333-3333-333333333333', 'Q 13', 'A 1', 13);
select throws_ok(
  $$select public.create_quiz_session_prioritized(
    'aaaaaaaa-3333-3333-3333-333333333333',
    array['ca000001-3333-4000-8000-000000000001'::uuid, 'ca000013-3333-4000-8000-000000000013'::uuid],
    array['ca000001-3333-4000-8000-000000000001'::uuid, 'ca000013-3333-4000-8000-000000000013'::uuid],
    2
  )$$,
  '22023', 'not enough choices',
  'prioritized RPC rolls back when a card cannot form enough choices'
);
select is(
  (select count(*)::integer from public.quiz_sessions
   where user_id = 'aaaaaaaa-3333-3333-3333-333333333333' and actual_question_count = 2),
  0,
  'failed prioritized session leaves no partial quiz session'
);

-- null/empty inputs are rejected.
select throws_ok(
  $$select public.create_quiz_session_prioritized(
    'aaaaaaaa-3333-3333-3333-333333333333',
    array[]::uuid[],
    array['ca000001-3333-4000-8000-000000000001'::uuid],
    1
  )$$,
  '22023', NULL,
  'prioritized RPC rejects an empty card list'
);
select throws_ok(
  $$select public.create_quiz_session_prioritized(
    null,
    array['ca000001-3333-4000-8000-000000000001'::uuid],
    array['ca000001-3333-4000-8000-000000000001'::uuid],
    1
  )$$,
  '42501', NULL,
  'prioritized RPC rejects a missing user id'
);

-- The atomic session insertion counts exactly the tests above.
select is(
  (select count(*)::integer from public.quiz_sessions
   where user_id = 'aaaaaaaa-3333-3333-3333-333333333333'),
  1,
  'only the single successful prioritized session exists'
);

select * from finish();
rollback;