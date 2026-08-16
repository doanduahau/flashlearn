begin;
select plan(29);

-- ---------------------------------------------------------------------------
-- Setup: teacher T owns the shared set; students A, B, C are members.
--   A: 10 quiz questions answered on its clone set (8 correct) + an answered
--      session on an UNRELATED set (excluded) + a non-completed session
--      (excluded) + a completed match on the clone set (5 correct / 3 wrong)
--      + a completed "all cards" match that does NOT list the clone set
--      (excluded).
--   B: 6 quiz questions answered on its clone set (4 correct), no match.
--   C: no activity at all.
-- Expected:
--   A: total 18 (10 quiz + 8 match), correct 13 (8 + 5), accuracy 72.2,
--      last_activity = match completion, rank 1.
--   B: total 6, correct 4, accuracy 66.7, last_activity = quiz completion,
--      rank 2.
--   C: total 0, correct 0, accuracy NULL, last_activity NULL, rank 3.
-- ---------------------------------------------------------------------------

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-6666-6666-6666-666666666666', 'authenticated', 'authenticated', 'stats.teacher@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-6666-6666-6666-666666666666', 'authenticated', 'authenticated', 'stats.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-6666-6666-6666-666666666666', 'authenticated', 'authenticated', 'stats.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-6666-6666-6666-666666666666', 'authenticated', 'authenticated', 'stats.c@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update public.profiles set display_name = 'Student A' where id = 'aaaaaaaa-6666-6666-6666-666666666666';
update public.profiles set display_name = 'Student B' where id = 'bbbbbbbb-6666-6666-6666-666666666666';
update public.profiles set display_name = 'Student C' where id = 'cccccccc-6666-6666-6666-666666666666';

insert into public.flashcard_sets (id, user_id, name) values
  ('11111111-6666-6666-6666-111111111111', 'dddddddd-6666-6666-6666-666666666666', 'Classroom set'),
  ('22222222-6666-6666-6666-222222222222', 'aaaaaaaa-6666-6666-6666-666666666666', 'A clone'),
  ('33333333-6666-6666-6666-333333333333', 'bbbbbbbb-6666-6666-6666-666666666666', 'B clone'),
  ('44444444-6666-6666-6666-444444444444', 'cccccccc-6666-6666-6666-666666666666', 'C clone'),
  ('55555555-6666-6666-6666-555555555555', 'aaaaaaaa-6666-6666-6666-666666666666', 'A unrelated');

-- A's clone set: 10 cards.
insert into public.flashcards (id, user_id, set_id, front, back, position)
select ('ac0000' || lpad(g::text, 2, '0') || '-6666-4000-8000-000000000001')::uuid, 'aaaaaaaa-6666-6666-6666-666666666666', '22222222-6666-6666-6666-222222222222', 'AF' || g, 'AB' || g, g - 1
from generate_series(1, 10) as g;

-- A's unrelated set: 2 cards (must never count for classroom stats).
insert into public.flashcards (id, user_id, set_id, front, back, position) values
  ('a0000001-6666-4000-8000-000000000001', 'aaaaaaaa-6666-6666-6666-666666666666', '55555555-6666-6666-6666-555555555555', 'U1', 'U1', 0),
  ('a0000002-6666-4000-8000-000000000002', 'aaaaaaaa-6666-6666-6666-666666666666', '55555555-6666-6666-6666-555555555555', 'U2', 'U2', 1);

-- B's clone set: 6 cards.
insert into public.flashcards (id, user_id, set_id, front, back, position)
select ('bc0000' || lpad(g::text, 2, '0') || '-6666-4000-8000-000000000002')::uuid, 'bbbbbbbb-6666-6666-6666-666666666666', '33333333-6666-6666-6666-333333333333', 'BF' || g, 'BB' || g, g - 1
from generate_series(1, 6) as g;

-- Memberships. A joined first, C last.
insert into public.shared_set_memberships (set_id, member_user_id, clone_set_id, joined_at) values
  ('11111111-6666-6666-6666-111111111111', 'aaaaaaaa-6666-6666-6666-666666666666', '22222222-6666-6666-6666-222222222222', '2026-08-01 08:00:00+00'),
  ('11111111-6666-6666-6666-111111111111', 'bbbbbbbb-6666-6666-6666-666666666666', '33333333-6666-6666-6666-333333333333', '2026-08-02 08:00:00+00'),
  ('11111111-6666-6666-6666-111111111111', 'cccccccc-6666-6666-6666-666666666666', '44444444-6666-6666-6666-444444444444', '2026-08-03 08:00:00+00');

-- Quiz sessions for A.
insert into public.quiz_sessions (id, user_id, mode, requested_question_count, actual_question_count, source_set_ids, source_collection_ids, source_all, started_at, completed_at, correct_answer_count) values
  ('a1000000-6666-4000-8000-000000000001', 'aaaaaaaa-6666-6666-6666-666666666666', 'balanced', 10, 10, array['22222222-6666-6666-6666-222222222222']::uuid[], '{}'::uuid[], false, '2026-08-10 09:00:00+00', '2026-08-10 10:00:00+00', 8),
  ('a1000000-6666-4000-8000-000000000002', 'aaaaaaaa-6666-6666-6666-666666666666', 'balanced', 10, 10, array['55555555-6666-6666-6666-555555555555']::uuid[], '{}'::uuid[], false, '2026-08-10 11:00:00+00', '2026-08-10 12:00:00+00', 1),
  ('a1000000-6666-4000-8000-000000000003', 'aaaaaaaa-6666-6666-6666-666666666666', 'balanced', 10, 10, array['22222222-6666-6666-6666-222222222222']::uuid[], '{}'::uuid[], false, '2026-08-11 09:00:00+00', NULL, 0);

-- S1 answers: 10 questions on clone cards, positions 0-9, first 8 correct.
insert into public.quiz_questions (id, session_id, user_id, position, flashcard_id, prompt, correct_answer, choices, correct_choice_index, selected_choice_index, is_correct, answered_at)
select ('ac00' || lpad(g::text, 4, '0') || '-6666-4000-8000-000000000010')::uuid, 'a1000000-6666-4000-8000-000000000001', 'aaaaaaaa-6666-6666-6666-666666666666', g - 1, ('ac0000' || lpad(g::text, 2, '0') || '-6666-4000-8000-000000000001')::uuid, 'AF' || g, 'AB' || g, jsonb_build_array('AB' || g, 'X', 'Y'), 0, case when g <= 8 then 0 else 1 end, g <= 8, '2026-08-10 09:05:00+00'
from generate_series(1, 10) as g;

-- S2 answers: 2 questions on A's unrelated set.
insert into public.quiz_questions (id, session_id, user_id, position, flashcard_id, prompt, correct_answer, choices, correct_choice_index, selected_choice_index, is_correct, answered_at) values
  ('ac0a0001-6666-4000-8000-000000000011', 'a1000000-6666-4000-8000-000000000002', 'aaaaaaaa-6666-6666-6666-666666666666', 0, 'a0000001-6666-4000-8000-000000000001', 'U1', 'U1', jsonb_build_array('U1', 'X', 'Y'), 0, 0, true, '2026-08-10 11:05:00+00'),
  ('ac0a0002-6666-4000-8000-000000000012', 'a1000000-6666-4000-8000-000000000002', 'aaaaaaaa-6666-6666-6666-666666666666', 1, 'a0000002-6666-4000-8000-000000000002', 'U2', 'U2', jsonb_build_array('U2', 'X', 'Y'), 0, 1, false, '2026-08-10 11:06:00+00');

-- S3 answer: 1 answered question but the session is never completed.
insert into public.quiz_questions (id, session_id, user_id, position, flashcard_id, prompt, correct_answer, choices, correct_choice_index, selected_choice_index, is_correct, answered_at) values
  ('ac0a0003-6666-4000-8000-000000000013', 'a1000000-6666-4000-8000-000000000003', 'aaaaaaaa-6666-6666-6666-666666666666', 0, 'ac000001-6666-4000-8000-000000000001', 'AF1', 'AB1', jsonb_build_array('AB1', 'X', 'Y'), 0, 0, true, '2026-08-11 09:05:00+00');

-- Quiz session for B.
insert into public.quiz_sessions (id, user_id, mode, requested_question_count, actual_question_count, source_set_ids, source_collection_ids, source_all, started_at, completed_at, correct_answer_count) values
  ('b1000000-6666-4000-8000-000000000001', 'bbbbbbbb-6666-6666-6666-666666666666', 'balanced', 10, 10, array['33333333-6666-6666-6666-333333333333']::uuid[], '{}'::uuid[], false, '2026-08-12 09:00:00+00', '2026-08-12 10:00:00+00', 4);

-- B answers: 6 questions on clone cards, first 4 correct.
insert into public.quiz_questions (id, session_id, user_id, position, flashcard_id, prompt, correct_answer, choices, correct_choice_index, selected_choice_index, is_correct, answered_at)
select ('bc00' || lpad(g::text, 4, '0') || '-6666-4000-8000-000000000020')::uuid, 'b1000000-6666-4000-8000-000000000001', 'bbbbbbbb-6666-6666-6666-666666666666', g - 1, ('bc0000' || lpad(g::text, 2, '0') || '-6666-4000-8000-000000000002')::uuid, 'BF' || g, 'BB' || g, jsonb_build_array('BB' || g, 'X', 'Y'), 0, case when g <= 4 then 0 else 1 end, g <= 4, '2026-08-12 09:05:00+00'
from generate_series(1, 6) as g;

-- Matches for A: one scoped to the clone set (counts), one "all cards"
-- without the clone set in source_set_ids (does NOT count).
insert into public.match_attempts (id, user_id, source_set_ids, source_collection_ids, source_all, total_pairs, correct_pair_count, incorrect_attempt_count, elapsed_ms, started_at, completed_at) values
  ('aa000001-6666-4000-8000-000000000001', 'aaaaaaaa-6666-6666-6666-666666666666', array['22222222-6666-6666-6666-222222222222']::uuid[], '{}'::uuid[], false, 6, 5, 3, 120000, '2026-08-11 11:00:00+00', '2026-08-11 12:00:00+00'),
  ('aa000002-6666-4000-8000-000000000002', 'aaaaaaaa-6666-6666-6666-666666666666', '{}'::uuid[], '{}'::uuid[], true, 12, 10, 2, 240000, '2026-08-11 13:00:00+00', '2026-08-11 14:00:00+00');

-- ---------------------------------------------------------------------------
-- 1. Security boundary: SECURITY DEFINER, empty search_path, no anon access.
-- ---------------------------------------------------------------------------

select ok(
  (select prosecdef from pg_proc where oid = 'public.get_set_members_with_stats(uuid,uuid)'::regprocedure),
  'get_set_members_with_stats is SECURITY DEFINER'
);
select ok(
  (select proconfig[1] = 'search_path=""' from pg_proc where oid = 'public.get_set_members_with_stats(uuid,uuid)'::regprocedure),
  'get_set_members_with_stats has empty search_path'
);
select is(
  has_function_privilege('anon', 'public.get_set_members_with_stats(uuid,uuid)', 'execute'),
  false,
  'anon cannot execute get_set_members_with_stats'
);
select is(
  has_function_privilege('authenticated', 'public.get_set_members_with_stats(uuid,uuid)', 'execute'),
  true,
  'authenticated can execute get_set_members_with_stats'
);
select is(
  has_function_privilege('service_role', 'public.get_set_members_with_stats(uuid,uuid)', 'execute'),
  true,
  'service_role can execute get_set_members_with_stats'
);

-- ---------------------------------------------------------------------------
-- 2. Owner-only validation.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.get_set_members_with_stats(NULL, '11111111-6666-6666-6666-111111111111')$$,
  '42501', NULL,
  'null user raises 42501'
);
select throws_ok(
  $$select public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', NULL)$$,
  '22023', NULL,
  'null set id raises 22023'
);
select throws_ok(
  $$select public.get_set_members_with_stats('bbbbbbbb-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')$$,
  '42501', 'not found or not owner',
  'non-owner cannot read the set''s stats'
);
select throws_ok(
  $$select public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '99999999-6666-6666-6666-999999999999')$$,
  '42501', 'not found or not owner',
  'unknown set raises a generic 42501'
);

-- ---------------------------------------------------------------------------
-- 3. Results.
-- ---------------------------------------------------------------------------

select set_config('stats.count', (
  select count(*)::text
  from public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')
), false);
select is(current_setting('stats.count'), '3', 'one row per member is returned');

-- A (rank 1, total 18, correct 13, accuracy 72.2, last = match completion).
select set_config('stats.a_rank', (
  select rank::text
  from public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')
  where member_user_id = 'aaaaaaaa-6666-6666-6666-666666666666'
), false);
select is(current_setting('stats.a_rank'), '1', 'A ranks first');
select set_config('stats.a_total', (
  select total_questions::text
  from public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')
  where member_user_id = 'aaaaaaaa-6666-6666-6666-666666666666'
), false);
select is(current_setting('stats.a_total'), '18', 'A total = 10 quiz + 8 match = 18');
select set_config('stats.a_correct', (
  select correct_questions::text
  from public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')
  where member_user_id = 'aaaaaaaa-6666-6666-6666-666666666666'
), false);
select is(current_setting('stats.a_correct'), '13', 'A correct = 8 quiz + 5 match = 13');
select set_config('stats.a_accuracy', (
  select accuracy::text
  from public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')
  where member_user_id = 'aaaaaaaa-6666-6666-6666-666666666666'
), false);
select is(current_setting('stats.a_accuracy'), '72.2', 'A accuracy = 72.2%');
select set_config('stats.a_name', (
  select display_name
  from public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')
  where member_user_id = 'aaaaaaaa-6666-6666-6666-666666666666'
), false);
select is(current_setting('stats.a_name'), 'Student A', 'A display name comes from profiles');
select set_config('stats.a_last', (
  select last_activity_at::text
  from public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')
  where member_user_id = 'aaaaaaaa-6666-6666-6666-666666666666'
), false);
select is(current_setting('stats.a_last'), '2026-08-11 12:00:00+00', 'A last_activity is the later of quiz and match completion');
select is(
  (select avatar_url
   from public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')
   where member_user_id = 'aaaaaaaa-6666-6666-6666-666666666666'),
  NULL,
  'A avatar url is NULL when profiles.avatar_url is NULL'
);
select set_config('stats.a_joined', (
  select joined_at::text
  from public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')
  where member_user_id = 'aaaaaaaa-6666-6666-6666-666666666666'
), false);
select is(current_setting('stats.a_joined'), '2026-08-01 08:00:00+00', 'A joined_at is preserved');

-- B (rank 2, total 6, correct 4, accuracy 66.7).
select set_config('stats.b_rank', (
  select rank::text
  from public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')
  where member_user_id = 'bbbbbbbb-6666-6666-6666-666666666666'
), false);
select is(current_setting('stats.b_rank'), '2', 'B ranks second');
select set_config('stats.b_total', (
  select total_questions::text
  from public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')
  where member_user_id = 'bbbbbbbb-6666-6666-6666-666666666666'
), false);
select is(current_setting('stats.b_total'), '6', 'B total = 6 quiz questions');
select set_config('stats.b_correct', (
  select correct_questions::text
  from public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')
  where member_user_id = 'bbbbbbbb-6666-6666-6666-666666666666'
), false);
select is(current_setting('stats.b_correct'), '4', 'B correct = 4');
select set_config('stats.b_accuracy', (
  select accuracy::text
  from public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')
  where member_user_id = 'bbbbbbbb-6666-6666-6666-666666666666'
), false);
select is(current_setting('stats.b_accuracy'), '66.7', 'B accuracy = 66.7%');
select set_config('stats.b_last', (
  select last_activity_at::text
  from public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')
  where member_user_id = 'bbbbbbbb-6666-6666-6666-666666666666'
), false);
select is(current_setting('stats.b_last'), '2026-08-12 10:00:00+00', 'B last_activity is its quiz completion');

-- C (rank 3, no activity, accuracy NULL).
select set_config('stats.c_rank', (
  select rank::text
  from public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')
  where member_user_id = 'cccccccc-6666-6666-6666-666666666666'
), false);
select is(current_setting('stats.c_rank'), '3', 'C ranks last');
select set_config('stats.c_total', (
  select total_questions::text
  from public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')
  where member_user_id = 'cccccccc-6666-6666-6666-666666666666'
), false);
select is(current_setting('stats.c_total'), '0', 'C total = 0');
select set_config('stats.c_correct', (
  select correct_questions::text
  from public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')
  where member_user_id = 'cccccccc-6666-6666-6666-666666666666'
), false);
select is(current_setting('stats.c_correct'), '0', 'C correct = 0');
select is(
  (select accuracy
   from public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')
   where member_user_id = 'cccccccc-6666-6666-6666-666666666666'),
  NULL,
  'C accuracy is NULL when there is no activity'
);
select is(
  (select last_activity_at
   from public.get_set_members_with_stats('dddddddd-6666-6666-6666-666666666666', '11111111-6666-6666-6666-111111111111')
   where member_user_id = 'cccccccc-6666-6666-6666-666666666666'),
  NULL,
  'C last_activity is NULL when there is no activity'
);

-- ---------------------------------------------------------------------------
-- 4. RLS and grants are untouched: direct table reads stay restricted.
-- ---------------------------------------------------------------------------

select is(
  has_table_privilege('anon', 'public.shared_set_memberships', 'select'),
  false,
  'anon cannot select from shared_set_memberships directly'
);

select * from finish();
rollback;