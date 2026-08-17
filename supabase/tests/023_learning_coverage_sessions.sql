begin;
select plan(18);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'authenticated', 'authenticated', 'coverage-session-a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'authenticated', 'authenticated', 'coverage-session-b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.flashcard_sets (id, user_id, name) values
  ('a1a1a1a1-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'Coverage session A'),
  ('b1b1b1b1-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'bbbbbbbb-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'Coverage session B');

insert into public.flashcards (id, user_id, set_id, front, back) values
  ('ca000001-c3c0-4000-8000-000000000001', 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'a1a1a1a1-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'A1', 'B1'),
  ('ca000002-c3c0-4000-8000-000000000002', 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'a1a1a1a1-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'A2', 'B2'),
  ('ca000003-c3c0-4000-8000-000000000003', 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'a1a1a1a1-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'A3', 'B3'),
  ('ca000004-c3c0-4000-8000-000000000004', 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'a1a1a1a1-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'A4', 'B4'),
  ('cb000001-c3c0-4000-8000-000000000001', 'bbbbbbbb-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'b1b1b1b1-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'X1', 'Y1');

-- A completion increments the appearance count for each session card.
insert into public.learning_coverage_sessions (id, user_id, mode, session_card_ids, scope_card_ids)
values ('d1000001-c3c0-4000-8000-000000000001', 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'match',
  array['ca000001-c3c0-4000-8000-000000000001'::uuid, 'ca000002-c3c0-4000-8000-000000000002'::uuid],
  array['ca000001-c3c0-4000-8000-000000000001'::uuid, 'ca000002-c3c0-4000-8000-000000000002'::uuid]);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0';

select is((select did_reset from public.complete_learning_coverage_session('d1000001-c3c0-4000-8000-000000000001')), false, 'first completion no longer resets');
select is((select count(*)::integer from public.flashcard_coverage where user_id = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0' and mode = 'match'), 2, 'completion creates one coverage row per session card');
select is((select appearance_count from public.flashcard_coverage where user_id = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0' and mode = 'match' and flashcard_id = 'ca000001-c3c0-4000-8000-000000000001'), 1, 'first appearance has count 1');
select is((select did_reset from public.complete_learning_coverage_session('d1000001-c3c0-4000-8000-000000000001')), false, 'duplicate completion returns stored result');
select is((select appearance_count from public.flashcard_coverage where user_id = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0' and mode = 'match' and flashcard_id = 'ca000001-c3c0-4000-8000-000000000001'), 1, 'duplicate completion does not increment');

-- A second distinct session over the same cards increments their count.
reset role;
insert into public.learning_coverage_sessions (id, user_id, mode, session_card_ids, scope_card_ids)
values ('d1000002-c3c0-4000-8000-000000000002', 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'memory',
  array['ca000001-c3c0-4000-8000-000000000001'::uuid, 'ca000002-c3c0-4000-8000-000000000002'::uuid],
  array['ca000001-c3c0-4000-8000-000000000001'::uuid, 'ca000002-c3c0-4000-8000-000000000002'::uuid]);
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0';
select is((select did_reset from public.complete_learning_coverage_session('d1000002-c3c0-4000-8000-000000000002')), false, 'second session does not reset');
select is((select appearance_count from public.flashcard_coverage where user_id = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0' and mode = 'memory' and flashcard_id = 'ca000001-c3c0-4000-8000-000000000001'), 1, 'memory mode counts independently of match');
select is((select count(*)::integer from public.flashcard_coverage where user_id = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0' and mode = 'memory'), 2, 'memory session creates two memory coverage rows');

-- Same mode, second session: count increments from 1 to 2.
reset role;
insert into public.learning_coverage_sessions (id, user_id, mode, session_card_ids, scope_card_ids)
values ('d1000003-c3c0-4000-8000-000000000003', 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'match',
  array['ca000001-c3c0-4000-8000-000000000001'::uuid],
  array['ca000001-c3c0-4000-8000-000000000001'::uuid]);
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0';
select is((select appearance_count from public.flashcard_coverage where user_id = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0' and mode = 'match' and flashcard_id = 'ca000001-c3c0-4000-8000-000000000001'), 1, 'precondition: match count is 1 before second completion');
select is((select did_reset from public.complete_learning_coverage_session('d1000003-c3c0-4000-8000-000000000003')), false, 'third session does not reset');
select is((select appearance_count from public.flashcard_coverage where user_id = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0' and mode = 'match' and flashcard_id = 'ca000001-c3c0-4000-8000-000000000001'), 2, 'second same-mode completion increments to 2');

-- Browser callers cannot create a ledger session, mutate coverage rows, or complete a foreign session.
select ok(not has_table_privilege('authenticated', 'public.learning_coverage_sessions', 'INSERT'), 'authenticated cannot create trusted coverage sessions');
select ok(not has_table_privilege('authenticated', 'public.flashcard_coverage', 'INSERT'), 'authenticated cannot forge coverage state');
select ok(not has_table_privilege('authenticated', 'public.flashcard_coverage', 'DELETE'), 'authenticated cannot delete coverage state');

reset role;
insert into public.learning_coverage_sessions (id, user_id, mode, session_card_ids, scope_card_ids)
values ('d1000004-c3c0-4000-8000-000000000004', 'bbbbbbbb-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'match',
  array['cb000001-c3c0-4000-8000-000000000001'::uuid],
  array['cb000001-c3c0-4000-8000-000000000001'::uuid]);
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0';
select throws_ok($$select * from public.complete_learning_coverage_session('d1000004-c3c0-4000-8000-000000000004')$$, '42501', NULL, 'foreign coverage session completion is denied');
select is((select count(*)::integer from public.learning_coverage_sessions where user_id = 'bbbbbbbb-c3c0-c0c0-c0c0-c0c0c0c0c0c0'), 0, 'foreign coverage session is filtered by RLS');

-- A snapshot remains completable after a card is deleted; live surviving cards increment.
reset role;
insert into public.learning_coverage_sessions (id, user_id, mode, session_card_ids, scope_card_ids)
values ('d1000005-c3c0-4000-8000-000000000005', 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'runner',
  array['ca000001-c3c0-4000-8000-000000000001'::uuid],
  array['ca000001-c3c0-4000-8000-000000000001'::uuid]);
delete from public.flashcards where id = 'ca000001-c3c0-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0';
select is((select did_reset from public.complete_learning_coverage_session('d1000005-c3c0-4000-8000-000000000005')), false, 'deleted snapshot card does not fail completion');
select is((select count(*)::integer from public.flashcard_coverage where user_id = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0' and mode = 'runner'), 0, 'deleted card leaves no runner coverage');

reset role;
select * from finish();
rollback;
