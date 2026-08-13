begin;
select plan(24);

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
  $$select * from public.submit_runner_best_time('d2000001-d2d2-4000-8000-000000000001', 'easy', 5000)$$,
  '42501',
  NULL,
  'anonymous best submission is denied'
);

reset role;

-- Coverage sessions: one completed Runner session for A (3 question cards), one
-- incomplete Runner session for A, one completed Match session for A, and one
-- completed Runner session for B.
insert into public.learning_coverage_sessions (id, user_id, mode, session_card_ids, scope_card_ids, completed_at) values
  ('d2000001-d2d2-4000-8000-000000000001', 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'runner',
    array['e0000001-d2d2-4000-8000-000000000001'::uuid, 'e0000002-d2d2-4000-8000-000000000002'::uuid, 'e0000003-d2d2-4000-8000-000000000003'::uuid],
    array['e0000001-d2d2-4000-8000-000000000001'::uuid, 'e0000002-d2d2-4000-8000-000000000002'::uuid, 'e0000003-d2d2-4000-8000-000000000003'::uuid],
    now()),
  ('d2000002-d2d2-4000-8000-000000000002', 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'runner',
    array['e0000001-d2d2-4000-8000-000000000001'::uuid, 'e0000002-d2d2-4000-8000-000000000002'::uuid, 'e0000003-d2d2-4000-8000-000000000003'::uuid],
    array['e0000001-d2d2-4000-8000-000000000001'::uuid, 'e0000002-d2d2-4000-8000-000000000002'::uuid, 'e0000003-d2d2-4000-8000-000000000003'::uuid],
    NULL),
  ('d2000003-d2d2-4000-8000-000000000003', 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'match',
    array['e0000001-d2d2-4000-8000-000000000001'::uuid],
    array['e0000001-d2d2-4000-8000-000000000001'::uuid],
    now()),
  ('d2000004-d2d2-4000-8000-000000000004', 'bbbbbbbb-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'runner',
    array['e0000004-d2d2-4000-8000-000000000004'::uuid],
    array['e0000004-d2d2-4000-8000-000000000004'::uuid],
    now());

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2';

-- First valid completion creates the record, deriving question count from the
-- immutable session snapshot.
create temp table _first as
select * from public.submit_runner_best_time('d2000001-d2d2-4000-8000-000000000001', 'easy', 5000);
select is((select result_best_ms from _first), 5000, 'first completion returns its own time');
select is((select result_question_count from _first), 3, 'question count is derived from the session snapshot');
select is((select is_new_best from _first), true, 'first completion is a new best');

-- Faster replaces; slower and equal never worsen.
create temp table _faster as
select * from public.submit_runner_best_time('d2000001-d2d2-4000-8000-000000000001', 'easy', 3000);
select is((select result_best_ms from _faster), 3000, 'faster completion replaces the best');
select is((select is_new_best from _faster), true, 'faster completion is a new best');

create temp table _slower as
select * from public.submit_runner_best_time('d2000001-d2d2-4000-8000-000000000001', 'easy', 9000);
select is((select result_best_ms from _slower), 3000, 'slower completion keeps the stored best');
select is((select is_new_best from _slower), false, 'slower completion is not a new best');

create temp table _equal as
select * from public.submit_runner_best_time('d2000001-d2d2-4000-8000-000000000001', 'easy', 3000);
select is((select result_best_ms from _equal), 3000, 'equal completion keeps the stored best');
select is((select is_new_best from _equal), false, 'equal completion is not a new best');

select is(
  (select best_ms from public.runner_personal_bests where user_id = 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2' and difficulty = 'easy' and question_count = 3),
  3000,
  'stored best converges to the minimum time'
);

-- Invalid difficulty and non-positive time are rejected.
select throws_ok($$select * from public.submit_runner_best_time('d2000001-d2d2-4000-8000-000000000001', 'nightmare', 5000)$$, '22023', NULL, 'invalid difficulty is rejected');
select throws_ok($$select * from public.submit_runner_best_time('d2000001-d2d2-4000-8000-000000000001', 'easy', 0)$$, '22023', NULL, 'zero elapsed time is rejected');
select throws_ok($$select * from public.submit_runner_best_time('d2000001-d2d2-4000-8000-000000000001', 'easy', -5)$$, '22023', NULL, 'negative elapsed time is rejected');

-- Cross-user, wrong-mode, and incomplete sessions cannot establish a best.
set local request.jwt.claim.sub = 'bbbbbbbb-d2d2-d2d2-d2d2-d2d2d2d2d2d2';
select throws_ok($$select * from public.submit_runner_best_time('d2000001-d2d2-4000-8000-000000000001', 'easy', 5000)$$, '22023', NULL, 'foreign session cannot establish a best');
set local request.jwt.claim.sub = 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2';
select throws_ok($$select * from public.submit_runner_best_time('d2000003-d2d2-4000-8000-000000000003', 'easy', 5000)$$, '22023', NULL, 'non-runner session cannot establish a best');
select throws_ok($$select * from public.submit_runner_best_time('d2000002-d2d2-4000-8000-000000000002', 'easy', 5000)$$, '22023', NULL, 'incomplete runner session cannot establish a best');

-- RLS: read own only.
select is(
  (select count(*)::integer from public.runner_personal_bests),
  1,
  'user reads their own best'
);
set local request.jwt.claim.sub = 'bbbbbbbb-d2d2-d2d2-d2d2-d2d2d2d2d2d2';
select is(
  (select count(*)::integer from public.runner_personal_bests),
  0,
  'user cannot read another user''s best'
);

-- Difficulty is part of the record identity.
set local request.jwt.claim.sub = 'aaaaaaaa-d2d2-d2d2-d2d2-d2d2d2d2d2d2';
create temp table _medium as
select * from public.submit_runner_best_time('d2000001-d2d2-4000-8000-000000000001', 'medium', 4000);
select is((select result_best_ms from _medium), 4000, 'a different difficulty creates an independent record');
select is(
  (select best_ms from public.runner_personal_bests where difficulty = 'easy' and question_count = 3),
  3000,
  'easy record is unaffected by the medium submission'
);

reset role;
select * from finish();
rollback;
