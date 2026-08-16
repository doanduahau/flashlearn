begin;
select plan(34);

-- ---------------------------------------------------------------------------
-- Setup: users A and B. A saves a valid attempt; B is used for RLS isolation.
-- ---------------------------------------------------------------------------

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'match.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'match.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

-- ---------------------------------------------------------------------------
-- 1. Security boundary: SECURITY DEFINER, empty search_path, service_role only.
-- ---------------------------------------------------------------------------

select ok(
  (select prosecdef from pg_proc where oid = 'public.save_match_attempt(uuid,uuid[],uuid[],boolean,integer,integer,integer,integer)'::regprocedure),
  'save_match_attempt is SECURITY DEFINER'
);
select ok(
  (select proconfig[1] = 'search_path=""' from pg_proc where oid = 'public.save_match_attempt(uuid,uuid[],uuid[],boolean,integer,integer,integer,integer)'::regprocedure),
  'save_match_attempt has empty search_path'
);
select is(
  has_function_privilege('authenticated', 'public.save_match_attempt(uuid,uuid[],uuid[],boolean,integer,integer,integer,integer)', 'execute'),
  false,
  'authenticated cannot execute save_match_attempt'
);
select is(
  has_function_privilege('anon', 'public.save_match_attempt(uuid,uuid[],uuid[],boolean,integer,integer,integer,integer)', 'execute'),
  false,
  'anon cannot execute save_match_attempt'
);
select is(
  has_function_privilege('service_role', 'public.save_match_attempt(uuid,uuid[],uuid[],boolean,integer,integer,integer,integer)', 'execute'),
  true,
  'service_role can execute save_match_attempt'
);

-- ---------------------------------------------------------------------------
-- 2. Table: RLS on, select_own policy, select-only for authenticated, all for
--    service_role (mirrors quiz_sessions).
-- ---------------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = 'public.match_attempts'::regclass),
  'match_attempts has RLS enabled'
);
select is(
  (select count(*) from pg_policies
   where schemaname = 'public' and tablename = 'match_attempts'
     and policyname = 'match_attempts_select_own' and cmd = 'SELECT'
     and roles = '{authenticated}'::name[]),
  1::bigint,
  'match_attempts_select_own policy exists for authenticated select'
);
select is(
  has_table_privilege('authenticated', 'public.match_attempts', 'select'),
  true,
  'authenticated can select match_attempts'
);
select is(
  has_table_privilege('authenticated', 'public.match_attempts', 'insert'),
  false,
  'authenticated cannot insert match_attempts directly'
);
select is(
  has_table_privilege('authenticated', 'public.match_attempts', 'update'),
  false,
  'authenticated cannot update match_attempts directly'
);
select is(
  has_table_privilege('authenticated', 'public.match_attempts', 'delete'),
  false,
  'authenticated cannot delete match_attempts directly'
);
select is(
  has_table_privilege('service_role', 'public.match_attempts', 'select'),
  true,
  'service_role can select match_attempts'
);
select is(
  has_table_privilege('service_role', 'public.match_attempts', 'insert'),
  true,
  'service_role can insert match_attempts'
);
select is(
  has_table_privilege('service_role', 'public.match_attempts', 'update'),
  true,
  'service_role can update match_attempts'
);
select is(
  has_table_privilege('service_role', 'public.match_attempts', 'delete'),
  true,
  'service_role can delete match_attempts'
);

-- ---------------------------------------------------------------------------
-- 3. Valid insert: returns an id, stores user + counts + elapsed, completed_at
--    is set at or after started_at.
-- ---------------------------------------------------------------------------

select set_config('match.attempt_id', (
  select public.save_match_attempt(
    'aaaaaaaa-5555-5555-5555-555555555555',
    array['11111111-5555-5555-5555-555555555555']::uuid[],
    '{}'::uuid[],
    false,
    12,
    10,
    3,
    45000
  )::text
), false);
select is(
  (select user_id::text from public.match_attempts where id = current_setting('match.attempt_id')::uuid),
  'aaaaaaaa-5555-5555-5555-555555555555',
  'attempt stores the given user_id'
);
select is(
  (select total_pairs from public.match_attempts where id = current_setting('match.attempt_id')::uuid),
  12,
  'attempt stores total_pairs'
);
select is(
  (select correct_pair_count from public.match_attempts where id = current_setting('match.attempt_id')::uuid),
  10,
  'attempt stores correct_pair_count'
);
select is(
  (select incorrect_attempt_count from public.match_attempts where id = current_setting('match.attempt_id')::uuid),
  3,
  'attempt stores incorrect_attempt_count'
);
select is(
  (select elapsed_ms from public.match_attempts where id = current_setting('match.attempt_id')::uuid),
  45000,
  'attempt stores elapsed_ms'
);
select ok(
  (select completed_at is not null from public.match_attempts where id = current_setting('match.attempt_id')::uuid),
  'attempt records completed_at on save'
);
select ok(
  (select completed_at >= started_at from public.match_attempts where id = current_setting('match.attempt_id')::uuid),
  'completed_at is not before started_at'
);
select is(
  (select source_all from public.match_attempts where id = current_setting('match.attempt_id')::uuid),
  false,
  'attempt stores source_all'
);

-- ---------------------------------------------------------------------------
-- 4. Input validation.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.save_match_attempt(NULL, '{}'::uuid[], '{}'::uuid[], false, 12, 12, 0, 1000)$$,
  '42501', NULL,
  'null user raises 42501'
);
select throws_ok(
  $$select public.save_match_attempt('aaaaaaaa-5555-5555-5555-555555555555', '{}'::uuid[], '{}'::uuid[], false, 0, 0, 0, 1000)$$,
  '22023', 'invalid match attempt',
  'total_pairs = 0 raises 22023'
);
select throws_ok(
  $$select public.save_match_attempt('aaaaaaaa-5555-5555-5555-555555555555', '{}'::uuid[], '{}'::uuid[], false, 10, 11, 0, 1000)$$,
  '22023', 'invalid match attempt',
  'correct_pair_count > total_pairs raises 22023'
);
select throws_ok(
  $$select public.save_match_attempt('aaaaaaaa-5555-5555-5555-555555555555', '{}'::uuid[], '{}'::uuid[], false, 10, 5, -1, 1000)$$,
  '22023', 'invalid match attempt',
  'incorrect_attempt_count < 0 raises 22023'
);
select throws_ok(
  $$select public.save_match_attempt('aaaaaaaa-5555-5555-5555-555555555555', '{}'::uuid[], '{}'::uuid[], false, 10, 5, 1, -1)$$,
  '22023', 'invalid match attempt',
  'elapsed_ms < 0 raises 22023'
);
select throws_ok(
  $$select public.save_match_attempt('aaaaaaaa-5555-5555-5555-555555555555', array[NULL::uuid], '{}'::uuid[], false, 10, 5, 1, 1000)$$,
  '22023', 'invalid match attempt',
  'null element in source arrays raises 22023'
);
select lives_ok(
  $$select public.save_match_attempt('aaaaaaaa-5555-5555-5555-555555555555', NULL, NULL, false, 6, 6, 0, 2000)$$,
  'null source arrays are accepted'
);
select is(
  (select count(*)::integer from public.match_attempts
   where user_id = 'aaaaaaaa-5555-5555-5555-555555555555'
     and source_set_ids = '{}'::uuid[] and source_collection_ids = '{}'::uuid[] and total_pairs = 6),
  1,
  'null source arrays coerce to empty arrays'
);

-- ---------------------------------------------------------------------------
-- 5. Isolation: B cannot read A rows through RLS; B can read its own row.
-- ---------------------------------------------------------------------------

select set_config('match.b_attempt_id', (
  select public.save_match_attempt(
    'bbbbbbbb-5555-5555-5555-555555555555',
    '{}'::uuid[],
    '{}'::uuid[],
    true,
    12,
    9,
    4,
    60000
  )::text
), false);

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-5555-5555-5555-555555555555';
select is(
  (select count(*)::integer from public.match_attempts where user_id = 'aaaaaaaa-5555-5555-5555-555555555555'),
  0,
  'RLS hides another user''s match attempts'
);
select is(
  (select count(*)::integer from public.match_attempts where user_id = 'bbbbbbbb-5555-5555-5555-555555555555'),
  1,
  'authenticated can read own match attempts'
);
select is(
  (select correct_pair_count from public.match_attempts where id = current_setting('match.b_attempt_id')::uuid),
  9,
  'own row is readable through RLS'
);
reset role;

select * from finish();
rollback;