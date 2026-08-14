begin;
select plan(38);

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
  ('ca000002-c2c2-4000-8000-000000000002', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'a1a1a1a1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'F2', 'Epsilon'),
  ('ca000003-c2c2-4000-8000-000000000003', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'a2a2a2a2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'F3', 'Beta'),
  ('ca000004-c2c2-4000-8000-000000000004', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'a2a2a2a2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'F4', 'GAMMA'),
  ('ca000005-c2c2-4000-8000-000000000005', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'a2a2a2a2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'F5', 'delta'),
  ('cb000001-c2c2-4000-8000-000000000001', 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'b1b1b1b1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'BF1', 'Only'),
  ('cb000002-c2c2-4000-8000-000000000002', 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'b1b1b1b1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'BF2', 'Other'),
  ('cb000003-c2c2-4000-8000-000000000003', 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'b1b1b1b1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'BF3', '  ONLY '),
  ('cb000004-c2c2-4000-8000-000000000004', 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'b1b1b1b1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'BF4', 'Alpha  Beta'),
  ('cb000005-c2c2-4000-8000-000000000005', 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'b1b1b1b1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'BF5', 'alpha beta'),
  ('cb000006-c2c2-4000-8000-000000000006', 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'b1b1b1b1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'BF6', 'Gamma');

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
  array['ca000001-c2c2-4000-8000-000000000001'::uuid, 'ca000003-c2c2-4000-8000-000000000003'::uuid, 'ca000004-c2c2-4000-8000-000000000004'::uuid],
  array['ca000001-c2c2-4000-8000-000000000001'::uuid, 'ca000003-c2c2-4000-8000-000000000003'::uuid, 'ca000004-c2c2-4000-8000-000000000004'::uuid],
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

select throws_ok(
  $$select public.create_runner_session(
    'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2',
    array['cb000001-c2c2-4000-8000-000000000001'::uuid],
    array['cb000001-c2c2-4000-8000-000000000001'::uuid],
    'easy'
  )$$,
  '22023', NULL,
  'ineligible selected card rejects runner session creation'
);
select is(
  (select count(*)::integer from public.runner_sessions where user_id = 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2'),
  0,
  'ineligible creation leaves no partial runner session'
);
select is(
  (select count(*)::integer from public.learning_coverage_sessions where user_id = 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2' and mode = 'runner'),
  0,
  'ineligible creation leaves no partial coverage session'
);

select throws_ok(
  $$select public.create_runner_session(
    'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2',
    array['ca000001-c2c2-4000-8000-000000000001'::uuid, 'ca000003-c2c2-4000-8000-000000000003'::uuid],
    array['ca000001-c2c2-4000-8000-000000000001'::uuid, 'ca000003-c2c2-4000-8000-000000000003'::uuid],
    'easy'
  )$$,
  '22023', NULL,
  'whole-library distractors cannot make an undersized Runner session eligible'
);
select is(
  (select count(*)::integer from public.runner_sessions where user_id = 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2'),
  1,
  'session-scoped eligibility rejection leaves no partial Runner session'
);

-- One-to-one: the same coverage session cannot be linked to a second runner config.
select throws_ok(
  format($$insert into public.runner_sessions (user_id, coverage_session_id, difficulty) values ('aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', '%s', 'easy')$$,
    (select coverage_session_id from public.runner_sessions where id = current_setting('runner.test_sid')::uuid)),
  '23505', NULL,
  'a coverage session can be linked to only one runner session'
);
select throws_ok(
  format($$insert into public.runner_sessions (user_id, coverage_session_id, difficulty) values ('bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2', '%s', 'easy')$$,
    (select coverage_session_id from public.runner_sessions where id = current_setting('runner.test_sid')::uuid)),
  '22023', NULL,
  'a runner session cannot link another user''s coverage snapshot'
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

-- Eligibility: supplied scope only, side-effect free, no seed.
set local request.jwt.claim.sub = 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2';
select is(
  (select cardinality(lcs.session_card_ids) from public.learning_coverage_sessions lcs join public.runner_sessions rs on rs.coverage_session_id = lcs.id where rs.id = current_setting('runner.test_sid')::uuid),
  (select count(*)::integer from public.load_runner_session_questions(current_setting('runner.test_sid')::uuid)),
  'every trusted session card produces exactly one Runner question'
);
select is(
  (select eligible from public.load_runner_candidate_eligibility(array[
    'ca000001-c2c2-4000-8000-000000000001'::uuid,
    'ca000003-c2c2-4000-8000-000000000003'::uuid,
    'ca000004-c2c2-4000-8000-000000000004'::uuid
  ]) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'),
  true,
  'card with two distinct in-scope wrong answers is eligible'
);
select is(
  (select eligible from public.load_runner_candidate_eligibility(array['ca000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'),
  false,
  'card with fewer than two in-scope wrong answers is ineligible'
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

-- Session-seeded question generation: questions and distractors come only from
-- the immutable session snapshot.
set local request.jwt.claim.sub = 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2';
select is(
  (select count(*)::integer from public.load_runner_session_questions(current_setting('runner.test_sid')::uuid)),
  3,
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
  array['ca000001-c2c2-4000-8000-000000000001'::uuid, 'ca000003-c2c2-4000-8000-000000000003'::uuid, 'ca000004-c2c2-4000-8000-000000000004'::uuid],
  'outside cards never become questions'
);
select is(
  (select bool_and(
    lower(regexp_replace(btrim(choice), '\s+', ' ', 'g')) = any (array['solo', 'beta', 'gamma'])
  )
   from public.load_runner_session_questions(current_setting('runner.test_sid')::uuid) q
   cross join lateral jsonb_array_elements_text(q.choices) as choice),
  true,
  'every correct answer and distractor comes from the Runner session snapshot'
);
select isnt(
  (select array_agg(lower(regexp_replace(btrim(choice), '\s+', ' ', 'g')) order by lower(regexp_replace(btrim(choice), '\s+', ' ', 'g')))
   from public.load_runner_session_questions(current_setting('runner.test_sid')::uuid) q
   cross join lateral jsonb_array_elements_text(q.choices) as choice
   where q.flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'::uuid
     and lower(regexp_replace(btrim(choice), '\s+', ' ', 'g')) <> lower(regexp_replace(btrim(q.correct_answer), '\s+', ' ', 'g'))),
  (select array_agg(lower(regexp_replace(btrim(choice), '\s+', ' ', 'g')) order by lower(regexp_replace(btrim(choice), '\s+', ' ', 'g')))
   from public.load_runner_session_questions(current_setting('runner.test_sid')::uuid) q
   cross join lateral jsonb_array_elements_text(q.choices) as choice
   where q.flashcard_id = 'ca000003-c2c2-4000-8000-000000000003'::uuid
     and lower(regexp_replace(btrim(choice), '\s+', ' ', 'g')) <> lower(regexp_replace(btrim(q.correct_answer), '\s+', ' ', 'g'))),
  'different questions in one session use different distractor sets'
);
set local request.jwt.claim.sub = 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2';
select is(
  (select eligible from public.load_runner_candidate_eligibility(array[
    'cb000004-c2c2-4000-8000-000000000004'::uuid,
    'cb000005-c2c2-4000-8000-000000000005'::uuid,
    'cb000006-c2c2-4000-8000-000000000006'::uuid
  ]) where flashcard_id = 'cb000004-c2c2-4000-8000-000000000004'),
  false,
  'internal whitespace variants are one normalized answer for eligibility'
);
reset role;
select throws_ok(
  $$select public.create_runner_session(
    'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2',
    array[
      'cb000004-c2c2-4000-8000-000000000004'::uuid,
      'cb000005-c2c2-4000-8000-000000000005'::uuid,
      'cb000006-c2c2-4000-8000-000000000006'::uuid
    ],
    array[
      'cb000004-c2c2-4000-8000-000000000004'::uuid,
      'cb000005-c2c2-4000-8000-000000000005'::uuid,
      'cb000006-c2c2-4000-8000-000000000006'::uuid
    ],
    'easy'
  )$$,
  '22023', NULL,
  'creation revalidates internal-whitespace normalization in its own session scope'
);
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2';
select is(
  (select choices from public.load_runner_session_questions(current_setting('runner.test_sid')::uuid) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'),
  (select choices from public.load_runner_session_questions(current_setting('runner.test_sid')::uuid) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'),
  'same session produces identical deterministic choices'
);

-- A later content change must fail the complete session load rather than
-- silently dropping one snapshotted question.
update public.flashcards
set back = 'Solo'
where id in (
  'ca000003-c2c2-4000-8000-000000000003'::uuid,
  'ca000004-c2c2-4000-8000-000000000004'::uuid,
  'ca000005-c2c2-4000-8000-000000000005'::uuid
);
select throws_ok(
  $$select * from public.load_runner_session_questions(current_setting('runner.test_sid')::uuid)$$,
  '22023', NULL,
  'later eligibility drift rejects the whole session load instead of skipping a card'
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
