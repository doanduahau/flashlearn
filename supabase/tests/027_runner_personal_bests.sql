begin;
select plan(25);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'authenticated', 'authenticated', 'runner-best.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'authenticated', 'authenticated', 'runner-best.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

-- Direct browser writes are forbidden; only the scoped RPC may mutate bests.
select ok(not has_table_privilege('authenticated', 'public.runner_personal_bests', 'INSERT'), 'authenticated cannot insert bests directly');
select ok(not has_table_privilege('authenticated', 'public.runner_personal_bests', 'UPDATE'), 'authenticated cannot update bests directly');
select ok(not has_table_privilege('authenticated', 'public.runner_personal_bests', 'DELETE'), 'authenticated cannot delete bests directly');

-- Anonymous mutation is denied.
set local role anon;
select throws_ok(
  $$select * from public.submit_runner_best_time('e2000001-d2d2-4000-8000-000000000001', 5000)$$,
  '42501', NULL,
  'anonymous best submission is denied'
);

reset role;

-- Coverage sessions (completed/incomplete/foreign/wrong-mode) and their 1:1
-- trusted runner sessions.
insert into public.learning_coverage_sessions (id, user_id, mode, session_card_ids, scope_card_ids, completed_at) values
  ('d2000001-d2d2-4000-8000-000000000001', 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'runner',
    array['e0000001-d2d2-4000-8000-000000000001'::uuid, 'e0000002-d2d2-4000-8000-000000000002'::uuid, 'e0000003-d2d2-4000-8000-000000000003'::uuid],
    array['e0000001-d2d2-4000-8000-000000000001'::uuid, 'e0000002-d2d2-4000-8000-000000000002'::uuid, 'e0000003-d2d2-4000-8000-000000000003'::uuid],
    now()),
  ('d2000002-d2d2-4000-8000-000000000002', 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'runner',
    array['e0000001-d2d2-4000-8000-000000000001'::uuid, 'e0000002-d2d2-4000-8000-000000000002'::uuid, 'e0000003-d2d2-4000-8000-000000000003'::uuid],
    array['e0000001-d2d2-4000-8000-000000000001'::uuid, 'e0000002-d2d2-4000-8000-000000000002'::uuid, 'e0000003-d2d2-4000-8000-000000000003'::uuid],
    now()),
  ('d2000003-d2d2-4000-8000-000000000003', 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'runner',
    array['e0000001-d2d2-4000-8000-000000000001'::uuid, 'e0000002-d2d2-4000-8000-000000000002'::uuid],
    array['e0000001-d2d2-4000-8000-000000000001'::uuid, 'e0000002-d2d2-4000-8000-000000000002'::uuid],
    now()),
  ('d2000004-d2d2-4000-8000-000000000004', 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'runner',
    array['e0000001-d2d2-4000-8000-000000000001'::uuid, 'e0000002-d2d2-4000-8000-000000000002'::uuid, 'e0000003-d2d2-4000-8000-000000000003'::uuid],
    array['e0000001-d2d2-4000-8000-000000000001'::uuid, 'e0000002-d2d2-4000-8000-000000000002'::uuid, 'e0000003-d2d2-4000-8000-000000000003'::uuid],
    NULL),
  ('d2000005-d2d2-4000-8000-000000000005', 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'match',
    array['e0000001-d2d2-4000-8000-000000000001'::uuid],
    array['e0000001-d2d2-4000-8000-000000000001'::uuid],
    now()),
  ('d2000006-d2d2-4000-8000-000000000006', 'bbbbbbbb-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'runner',
    array['e0000004-d2d2-4000-8000-000000000004'::uuid],
    array['e0000004-d2d2-4000-8000-000000000004'::uuid],
    now());

insert into public.runner_sessions (id, user_id, coverage_session_id, difficulty) values
  ('e2000001-d2d2-4000-8000-000000000001', 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'd2000001-d2d2-4000-8000-000000000001', 'easy'),
  ('e2000002-d2d2-4000-8000-000000000002', 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'd2000002-d2d2-4000-8000-000000000002', 'hard'),
  ('e2000003-d2d2-4000-8000-000000000003', 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'd2000003-d2d2-4000-8000-000000000003', 'medium'),
  ('e2000004-d2d2-4000-8000-000000000004', 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'd2000004-d2d2-4000-8000-000000000004', 'easy'),
  ('e2000005-d2d2-4000-8000-000000000005', 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'd2000005-d2d2-4000-8000-000000000005', 'easy'),
  ('e2000006-d2d2-4000-8000-000000000006', 'bbbbbbbb-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'd2000006-d2d2-4000-8000-000000000006', 'easy');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2';

-- First completion creates the record; difficulty and question count are derived
-- from trusted DB state (no caller-supplied difficulty/count).
create temp table _first as
select * from public.submit_runner_best_time('e2000001-d2d2-4000-8000-000000000001', 5000);
select is((select result_best_ms from _first), 5000, 'first completion returns its own time');
select is((select result_question_count from _first), 3, 'question count is derived from the linked snapshot');
select is((select is_new_best from _first), true, 'first completion is a new best');
select is(
  (select best_ms from public.runner_personal_bests where user_id = 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2' and difficulty = 'easy' and question_count = 3),
  5000,
  'easy session stores under the easy key'
);

-- Faster improves; slower and equal never worsen.
create temp table _faster as
select * from public.submit_runner_best_time('e2000001-d2d2-4000-8000-000000000001', 3000);
select is((select result_best_ms from _faster), 3000, 'faster completion replaces the best');
select is((select is_new_best from _faster), true, 'faster completion is a new best');

create temp table _slower as
select * from public.submit_runner_best_time('e2000001-d2d2-4000-8000-000000000001', 9000);
select is((select result_best_ms from _slower), 3000, 'slower completion keeps the stored best');
select is((select is_new_best from _slower), false, 'slower completion is not a new best');

create temp table _equal as
select * from public.submit_runner_best_time('e2000001-d2d2-4000-8000-000000000001', 3000);
select is((select result_best_ms from _equal), 3000, 'equal completion keeps the stored best');
select is((select is_new_best from _equal), false, 'equal completion is not a new best');

-- Difficulty integrity: a hard session can only write a hard record; it cannot
-- relabel the easy record because the RPC has no difficulty parameter.
create temp table _hard as
select * from public.submit_runner_best_time('e2000002-d2d2-4000-8000-000000000002', 2000);
select is((select result_best_ms from _hard), 2000, 'hard completion returns its own time');
select is(
  (select best_ms from public.runner_personal_bests where difficulty = 'hard' and question_count = 3),
  2000,
  'hard session stores under the hard key'
);
select is(
  (select best_ms from public.runner_personal_bests where difficulty = 'easy' and question_count = 3),
  3000,
  'easy record is unaffected by the hard submission'
);

-- Question count is derived from the immutable coverage snapshot.
create temp table _medium as
select * from public.submit_runner_best_time('e2000003-d2d2-4000-8000-000000000003', 1000);
select is((select result_question_count from _medium), 2, 'question count follows the two-card snapshot');

-- Invalid time, incomplete, wrong-mode, and foreign sessions are rejected.
select throws_ok($$select * from public.submit_runner_best_time('e2000001-d2d2-4000-8000-000000000001', 0)$$, '22023', NULL, 'zero elapsed time is rejected');
select throws_ok($$select * from public.submit_runner_best_time('e2000001-d2d2-4000-8000-000000000001', -5)$$, '22023', NULL, 'negative elapsed time is rejected');
select throws_ok($$select * from public.submit_runner_best_time('e2000004-d2d2-4000-8000-000000000004', 5000)$$, '22023', NULL, 'incomplete runner session cannot establish a best');
select throws_ok($$select * from public.submit_runner_best_time('e2000005-d2d2-4000-8000-000000000005', 5000)$$, '22023', NULL, 'non-runner coverage cannot establish a best');
set local request.jwt.claim.sub = 'bbbbbbbb-d2d2-d2d2-d2d2-d2d2d2d2d2d2';
select throws_ok($$select * from public.submit_runner_best_time('e2000001-d2d2-4000-8000-000000000001', 5000)$$, '22023', NULL, 'foreign runner session cannot establish a best');

-- RLS: read own only.
set local request.jwt.claim.sub = 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2';
select is(
  (select count(*)::integer from public.runner_personal_bests),
  3,
  'user reads their own bests (easy, hard, medium)'
);
set local request.jwt.claim.sub = 'bbbbbbbb-d2d2-d2d2-d2d2-d2d2d2d2d2d2';
select is(
  (select count(*)::integer from public.runner_personal_bests),
  0,
  'user cannot read another user''s bests'
);

reset role;
select * from finish();
rollback;
