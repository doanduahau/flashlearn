begin;
select plan(25);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'authenticated', 'authenticated', 'runner.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'authenticated', 'authenticated', 'runner.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.flashcard_sets (id, user_id, name) values
  ('a1a1a1a1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'Runner source set'),
  ('a2a2a2a2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'Runner other set'),
  ('b1b1b1b1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'Runner B set');

insert into public.flashcards (id, user_id, set_id, front, back) values
  ('ca000001-c2c2-4000-8000-000000000001', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'a1a1a1a1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'F1', '  Solo  '),
  ('ca000002-c2c2-4000-8000-000000000002', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'a1a1a1a1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'F2', 'SOLO'),
  ('ca000003-c2c2-4000-8000-000000000003', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'a2a2a2a2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'F3', 'Beta'),
  ('ca000004-c2c2-4000-8000-000000000004', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'a2a2a2a2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'F4', 'GAMMA'),
  ('ca000005-c2c2-4000-8000-000000000005', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'a2a2a2a2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'F5', 'delta'),
  ('cb000001-c2c2-4000-8000-000000000001', 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'b1b1b1b1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'BF1', 'Only'),
  ('cb000002-c2c2-4000-8000-000000000002', 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'b1b1b1b1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'BF2', 'Other'),
  ('cb000003-c2c2-4000-8000-000000000003', 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'b1b1b1b1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'BF3', '  ONLY ');

-- Trusted config is never created or mutated by a browser.
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2';
select throws_ok(
  $$select public.create_runner_session('aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', array['ca000001-c2c2-4000-8000-000000000001'::uuid], array['ca000001-c2c2-4000-8000-000000000001'::uuid], 'easy')$$,
  '42501', NULL,
  'authenticated cannot create a trusted runner session'
);
select ok(not has_table_privilege('authenticated', 'public.runner_sessions', 'INSERT'), 'authenticated cannot insert runner sessions');
select ok(not has_table_privilege('authenticated', 'public.runner_sessions', 'UPDATE'), 'authenticated cannot update runner sessions');
select ok(not has_table_privilege('authenticated', 'public.runner_sessions', 'DELETE'), 'authenticated cannot delete runner sessions');
reset role;

-- Trusted creation boundary (service-role) establishes the runner config and the
-- linked runner coverage snapshot atomically. Store the created id in a session
-- setting so it remains readable across the later role switches.
select set_config('runner.test_sid', public.create_runner_session(
  'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2',
  array['ca000001-c2c2-4000-8000-000000000001'::uuid, 'ca000003-c2c2-4000-8000-000000000003'::uuid],
  array['ca000001-c2c2-4000-8000-000000000001'::uuid, 'ca000003-c2c2-4000-8000-000000000003'::uuid],
  'easy'
)::text, false);

select is(
  (select count(*)::integer from public.runner_sessions where user_id = 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2'),
  1,
  'one runner session is created'
);
select is(
  (select difficulty from public.runner_sessions where id = current_setting('runner.test_sid')::uuid),
  'easy',
  'difficulty is stored on the trusted runner session'
);
select is(
  (select count(*)::integer from public.learning_coverage_sessions where user_id = 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2' and mode = 'runner'),
  1,
  'runner session creation creates one runner coverage snapshot'
);
select is(
  (select lcs.mode from public.learning_coverage_sessions lcs join public.runner_sessions rs on rs.coverage_session_id = lcs.id where rs.id = current_setting('runner.test_sid')::uuid),
  'runner',
  'linked coverage session is mode runner'
);

-- One-to-one: the same coverage session cannot be linked to a second runner config.
select throws_ok(
  format($$insert into public.runner_sessions (user_id, coverage_session_id, difficulty) values ('aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', '%s', 'easy')$$,
    (select coverage_session_id from public.runner_sessions where id = current_setting('runner.test_sid')::uuid)),
  '23505', NULL,
  'a coverage session can be linked to only one runner session'
);

-- Difficulty and ownership are immutable for the browser.
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2';
select throws_ok(
  $$update public.runner_sessions set difficulty = 'hard' where id = (select id from public.runner_sessions limit 1)$$,
  '42501', NULL,
  'authenticated cannot change a runner session difficulty'
);
set local request.jwt.claim.sub = 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2';
select is(
  (select count(*)::integer from public.runner_sessions),
  0,
  'foreign user cannot read runner sessions'
);

-- Eligibility: whole-library, side-effect free, no seed.
set local request.jwt.claim.sub = 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2';
select is(
  (select eligible from public.load_runner_candidate_eligibility(array['ca000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'),
  true,
  'card with two distinct wrong answers is eligible'
);

set local request.jwt.claim.sub = 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2';
select is(
  (select count(*)::integer from public.load_runner_candidate_eligibility(array['ca000001-c2c2-4000-8000-000000000001'::uuid])),
  0,
  'foreign card is not disclosed in eligibility'
);
select is(
  (select eligible from public.load_runner_candidate_eligibility(array['cb000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'cb000001-c2c2-4000-8000-000000000001'),
  false,
  'card with only one distinct wrong answer is ineligible'
);
select is(
  (select eligible from public.load_runner_candidate_eligibility(array['cb000002-c2c2-4000-8000-000000000002'::uuid]) where flashcard_id = 'cb000002-c2c2-4000-8000-000000000002'),
  false,
  'card whose only other answer normalizes to itself is ineligible'
);

-- Session-seeded question generation: questions come only from the immutable
-- session snapshot; distractors may come from the whole user library.
set local request.jwt.claim.sub = 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2';
select is(
  (select count(*)::integer from public.load_runner_session_questions(current_setting('runner.test_sid')::uuid)),
  2,
  'session questions come only from the session snapshot'
);
select is(
  (select bool_and(jsonb_array_length(choices) = 3) from public.load_runner_session_questions(current_setting('runner.test_sid')::uuid)),
  true,
  'every session question has exactly three choices'
);
select is(
  (select choices @> jsonb_build_array(correct_answer) from public.load_runner_session_questions(current_setting('runner.test_sid')::uuid) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'),
  true,
  'the correct answer is present among the choices'
);
select is(
  (select count(distinct lower(regexp_replace(btrim(elem), '\s+', ' ', 'g')))::integer
   from public.load_runner_session_questions(current_setting('runner.test_sid')::uuid) q
   cross join lateral jsonb_array_elements_text(q.choices) as elem
   where q.flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'),
  3,
  'the three choices are distinct after canonical normalization'
);
select is(
  (select array_agg(flashcard_id order by flashcard_id) from public.load_runner_session_questions(current_setting('runner.test_sid')::uuid)),
  array['ca000001-c2c2-4000-8000-000000000001'::uuid, 'ca000003-c2c2-4000-8000-000000000003'::uuid],
  'outside cards never become questions'
);
select is(
  (select choices from public.load_runner_session_questions(current_setting('runner.test_sid')::uuid) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'),
  (select choices from public.load_runner_session_questions(current_setting('runner.test_sid')::uuid) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'),
  'same session produces identical deterministic choices'
);

-- Foreign session is not disclosed.
set local request.jwt.claim.sub = 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2';
select throws_ok(
  format($$select * from public.load_runner_session_questions('%s')$$, current_setting('runner.test_sid')::uuid),
  '22023', NULL,
  'foreign runner session cannot be loaded'
);

-- Candidate/eligibility and session-question reads have zero write side effects
-- (scoped to the fixture user).
reset role;
select is((select count(*)::integer from public.quiz_sessions where user_id = 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2'), 0, 'runner reads create no quiz session for the user');
select is((select count(*)::integer from public.flashcard_coverage where user_id = 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2'), 0, 'runner reads write no coverage for the user');
select is((select count(*)::integer from public.learning_coverage_sessions where user_id = 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2'), 1, 'runner reads create no extra coverage session for the user');

select * from finish();
rollback;
