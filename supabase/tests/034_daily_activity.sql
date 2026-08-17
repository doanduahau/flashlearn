begin;
select plan(53);

-- ---------------------------------------------------------------------------
-- Setup: user A (owns a profile with a fixed timezone) and user B for RLS
-- isolation. The local date is computed from the profile timezone, so the
-- fixture pins Asia/Ho_Chi_Minh and asserts against that date.
-- ---------------------------------------------------------------------------

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-7777-7777-7777-777777777777', 'authenticated', 'authenticated', 'daily.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-7777-7777-7777-777777777777', 'authenticated', 'authenticated', 'daily.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

-- The handle_new_user trigger creates the profile row; only the timezone is
-- pinned so the local-date assertions are deterministic.
update public.profiles set timezone = 'Asia/Ho_Chi_Minh'
where id in ('aaaaaaaa-7777-7777-7777-777777777777', 'bbbbbbbb-7777-7777-7777-777777777777');

-- ---------------------------------------------------------------------------
-- 1. Security boundary: SECURITY DEFINER, empty search_path, service_role
--    only (never authenticated/anon — client calls go through the server).
-- ---------------------------------------------------------------------------

select ok(
  (select prosecdef from pg_proc where oid = 'public.record_daily_activity(uuid,text,integer,integer)'::regprocedure),
  'record_daily_activity is SECURITY DEFINER'
);
select ok(
  (select proconfig[1] = 'search_path=""' from pg_proc where oid = 'public.record_daily_activity(uuid,text,integer,integer)'::regprocedure),
  'record_daily_activity has empty search_path'
);
select is(
  has_function_privilege('authenticated', 'public.record_daily_activity(uuid,text,integer,integer)', 'execute'),
  false,
  'authenticated cannot execute record_daily_activity'
);
select is(
  has_function_privilege('anon', 'public.record_daily_activity(uuid,text,integer,integer)', 'execute'),
  false,
  'anon cannot execute record_daily_activity'
);
select is(
  has_function_privilege('service_role', 'public.record_daily_activity(uuid,text,integer,integer)', 'execute'),
  true,
  'service_role can execute record_daily_activity'
);

-- ---------------------------------------------------------------------------
-- 2. Input validation: null user, invalid mode, negative counts coerce to 0.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.record_daily_activity(NULL, 'quiz', 10, 8)$$,
  '42501', NULL,
  'null user raises 42501'
);
select throws_ok(
  $$select public.record_daily_activity('aaaaaaaa-7777-7777-7777-777777777777', 'bogus', 10, 8)$$,
  '22023', 'invalid mode',
  'unknown mode raises 22023'
);
select throws_ok(
  $$select public.record_daily_activity('aaaaaaaa-7777-7777-7777-777777777777', NULL, 10, 8)$$,
  '22023', 'invalid mode',
  'null mode raises 22023'
);

-- ---------------------------------------------------------------------------
-- 3. quiz/match/typing modes: upsert the daily record and add counts.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.record_daily_activity('aaaaaaaa-7777-7777-7777-777777777777', 'quiz', 10, 8)$$,
  'records a quiz completion'
);
select is(
  (select count(*)::integer from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  1,
  'quiz completion creates exactly one daily record'
);
select is(
  (select completed_quiz_count from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  1,
  'quiz completion increments completed_quiz_count to 1'
);
select is(
  (select questions_answered from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  10,
  'quiz completion adds questions_answered'
);
select is(
  (select correct_answers from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  8,
  'quiz completion adds correct_answers'
);
select is(
  (select timezone from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  'Asia/Ho_Chi_Minh',
  'record snapshots the profile timezone'
);
select is(
  (select local_date::text from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  (select (now() at time zone 'Asia/Ho_Chi_Minh')::date::text),
  'record uses the local date in the profile timezone'
);
select ok(
  (select first_completed_at is not null and last_completed_at is not null
   from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  'record stores completion timestamps'
);
select ok(
  (select last_completed_at >= first_completed_at
   from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  'last_completed_at is not before first_completed_at'
);

select lives_ok(
  $$select public.record_daily_activity('aaaaaaaa-7777-7777-7777-777777777777', 'match', 12, 9)$$,
  'records a match completion on the same day'
);
select is(
  (select count(*)::integer from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  1,
  'same-day match completion upserts, no duplicate row'
);
select is(
  (select completed_quiz_count from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  2,
  'match completion increments completed_quiz_count'
);
select is(
  (select questions_answered from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  22,
  'match completion adds its questions'
);
select is(
  (select correct_answers from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  17,
  'match completion adds its correct answers'
);

select lives_ok(
  $$select public.record_daily_activity('aaaaaaaa-7777-7777-7777-777777777777', 'typing', 6, 6)$$,
  'records a typing completion on the same day'
);
select is(
  (select completed_quiz_count from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  3,
  'typing completion increments completed_quiz_count'
);
select is(
  (select questions_answered from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  28,
  'typing completion adds its questions'
);
select is(
  (select correct_answers from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  23,
  'typing completion adds its correct answers'
);

-- ---------------------------------------------------------------------------
-- 4. memory/runner/study modes: the day stays active (streak) but the quiz
--    counts must NOT change.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.record_daily_activity('aaaaaaaa-7777-7777-7777-777777777777', 'memory', 0, 0)$$,
  'records a memory completion'
);
select is(
  (select count(*)::integer from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  1,
  'memory completion does not create a duplicate row'
);
select is(
  (select completed_quiz_count from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  3,
  'memory completion does not change completed_quiz_count'
);
select is(
  (select questions_answered from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  28,
  'memory completion does not change questions_answered'
);
select is(
  (select correct_answers from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  23,
  'memory completion does not change correct_answers'
);

select lives_ok(
  $$select public.record_daily_activity('aaaaaaaa-7777-7777-7777-777777777777', 'runner', 0, 0)$$,
  'records a runner completion'
);
select is(
  (select completed_quiz_count from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  3,
  'runner completion does not change completed_quiz_count'
);
select lives_ok(
  $$select public.record_daily_activity('aaaaaaaa-7777-7777-7777-777777777777', 'study', 0, 0)$$,
  'records a study completion'
);
select is(
  (select completed_quiz_count from public.daily_learning_records
   where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  3,
  'study completion does not change completed_quiz_count'
);

-- ---------------------------------------------------------------------------
-- 5. A day that is ONLY active through non-quiz modes stores 0 quiz count.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.record_daily_activity('bbbbbbbb-7777-7777-7777-777777777777', 'study', 0, 0)$$,
  'B records a study-only day'
);
select is(
  (select completed_quiz_count from public.daily_learning_records
   where user_id = 'bbbbbbbb-7777-7777-7777-777777777777'),
  0,
  'study-only day stores completed_quiz_count = 0'
);
select is(
  (select questions_answered from public.daily_learning_records
   where user_id = 'bbbbbbbb-7777-7777-7777-777777777777'),
  0,
  'study-only day stores questions_answered = 0'
);
select is(
  (select correct_answers from public.daily_learning_records
   where user_id = 'bbbbbbbb-7777-7777-7777-777777777777'),
  0,
  'study-only day stores correct_answers = 0'
);

-- ---------------------------------------------------------------------------
-- 6. Count coercion and clamping: negative / null counts become 0, and
--    correct_answers never exceeds questions_answered.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.record_daily_activity('bbbbbbbb-7777-7777-7777-777777777777', 'quiz', -5, -3)$$,
  'negative counts are accepted and coerced to 0'
);
select is(
  (select completed_quiz_count from public.daily_learning_records
   where user_id = 'bbbbbbbb-7777-7777-7777-777777777777'),
  1,
  'negative-coerced quiz still increments completed_quiz_count'
);
select is(
  (select questions_answered from public.daily_learning_records
   where user_id = 'bbbbbbbb-7777-7777-7777-777777777777'),
  0,
  'negative questions coerce to 0'
);
select is(
  (select correct_answers from public.daily_learning_records
   where user_id = 'bbbbbbbb-7777-7777-7777-777777777777'),
  0,
  'negative correct answers coerce to 0'
);

select lives_ok(
  $$select public.record_daily_activity('bbbbbbbb-7777-7777-7777-777777777777', 'quiz', 10, 99)$$,
  'correct_answers above questions_answered is accepted'
);
select is(
  (select questions_answered from public.daily_learning_records
   where user_id = 'bbbbbbbb-7777-7777-7777-777777777777'),
  10,
  'questions_answered stays 10 after clamp'
);
select is(
  (select correct_answers from public.daily_learning_records
   where user_id = 'bbbbbbbb-7777-7777-7777-777777777777'),
  10,
  'correct_answers clamps to questions_answered'
);

select lives_ok(
  $$select public.record_daily_activity('bbbbbbbb-7777-7777-7777-777777777777', 'quiz', NULL, NULL)$$,
  'null counts are accepted and coerced to 0'
);
select is(
  (select questions_answered from public.daily_learning_records
   where user_id = 'bbbbbbbb-7777-7777-7777-777777777777'),
  10,
  'null questions leave the running total unchanged'
);
select is(
  (select correct_answers from public.daily_learning_records
   where user_id = 'bbbbbbbb-7777-7777-7777-777777777777'),
  10,
  'null correct answers leave the running total unchanged'
);
select ok(
  (select correct_answers <= questions_answered
   from public.daily_learning_records
   where user_id = 'bbbbbbbb-7777-7777-7777-777777777777'),
  'correct_answers never exceeds questions_answered'
);

-- ---------------------------------------------------------------------------
-- 7. RLS: the daily record is still select-only for authenticated and hidden
--    from other users.
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-7777-7777-7777-777777777777';
select is(
  (select count(*)::integer from public.daily_learning_records where user_id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  1,
  'authenticated can read own daily records'
);
select is(
  (select count(*)::integer from public.daily_learning_records where user_id = 'bbbbbbbb-7777-7777-7777-777777777777'),
  0,
  'RLS hides another user''s daily records'
);
select is(
  has_table_privilege('authenticated', 'public.daily_learning_records', 'insert'),
  false,
  'authenticated cannot insert daily records directly'
);
reset role;

select * from finish();
rollback;
