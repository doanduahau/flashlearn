begin;
select plan(17);

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

-- A complete scope resets exactly once. Repeating the opaque session is a no-op.
insert into public.learning_coverage_sessions (id, user_id, mode, session_card_ids, scope_card_ids)
values ('d1000001-c3c0-4000-8000-000000000001', 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'match',
  array['ca000001-c3c0-4000-8000-000000000001'::uuid, 'ca000002-c3c0-4000-8000-000000000002'::uuid],
  array['ca000001-c3c0-4000-8000-000000000001'::uuid, 'ca000002-c3c0-4000-8000-000000000002'::uuid]);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0';

select is((select did_reset from public.complete_learning_coverage_session('d1000001-c3c0-4000-8000-000000000001')), true, 'first completion resets a fully covered snapshot scope');
select is((select count(*)::integer from public.flashcard_coverage where user_id = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0' and mode = 'match'), 0, 'reset leaves no old-cycle rows in its scope');
select is((select did_reset from public.complete_learning_coverage_session('d1000001-c3c0-4000-8000-000000000001')), true, 'duplicate completion returns stored result');
select is((select count(*)::integer from public.flashcard_coverage where user_id = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0' and mode = 'match'), 0, 'duplicate completion cannot pollute the new cycle');

-- An A+B snapshot reset does not delete C, and A alone sees the reset state.
reset role;
insert into public.flashcard_coverage (user_id, mode, flashcard_id) values
  ('aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'memory', 'ca000003-c3c0-4000-8000-000000000003');
insert into public.learning_coverage_sessions (id, user_id, mode, session_card_ids, scope_card_ids)
values ('d1000002-c3c0-4000-8000-000000000002', 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'memory',
  array['ca000001-c3c0-4000-8000-000000000001'::uuid, 'ca000002-c3c0-4000-8000-000000000002'::uuid],
  array['ca000001-c3c0-4000-8000-000000000001'::uuid, 'ca000002-c3c0-4000-8000-000000000002'::uuid]);
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0';
select is((select did_reset from public.complete_learning_coverage_session('d1000002-c3c0-4000-8000-000000000002')), true, 'A+B session resets its snapshotted scope');
select is((select count(*)::integer from public.flashcard_coverage where user_id = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0' and mode = 'memory' and flashcard_id in ('ca000001-c3c0-4000-8000-000000000001', 'ca000002-c3c0-4000-8000-000000000002')), 0, 'A-only selection observes reset rows as uncovered');
select is((select count(*)::integer from public.flashcard_coverage where user_id = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0' and mode = 'memory' and flashcard_id = 'ca000003-c3c0-4000-8000-000000000003'), 1, 'unrelated C coverage remains unchanged');

-- Browser callers cannot create a ledger session, mutate coverage rows, or complete a foreign session.
select ok(not has_table_privilege('authenticated', 'public.learning_coverage_sessions', 'INSERT'), 'authenticated cannot create trusted coverage sessions');
select ok(not has_table_privilege('authenticated', 'public.flashcard_coverage', 'INSERT'), 'authenticated cannot forge coverage state');
select ok(not has_table_privilege('authenticated', 'public.flashcard_coverage', 'DELETE'), 'authenticated cannot delete coverage state');

reset role;
insert into public.learning_coverage_sessions (id, user_id, mode, session_card_ids, scope_card_ids)
values ('d1000003-c3c0-4000-8000-000000000003', 'bbbbbbbb-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'match',
  array['cb000001-c3c0-4000-8000-000000000001'::uuid],
  array['cb000001-c3c0-4000-8000-000000000001'::uuid]);
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0';
select throws_ok($$select * from public.complete_learning_coverage_session('d1000003-c3c0-4000-8000-000000000003')$$, '42501', NULL, 'foreign coverage session completion is denied');
select is((select count(*)::integer from public.learning_coverage_sessions where user_id = 'bbbbbbbb-c3c0-c0c0-c0c0-c0c0c0c0c0c0'), 0, 'foreign coverage session is filtered by RLS');

-- A snapshot remains completable after a card is deleted; live surviving cards determine reset.
reset role;
insert into public.learning_coverage_sessions (id, user_id, mode, session_card_ids, scope_card_ids)
values ('d1000004-c3c0-4000-8000-000000000004', 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'runner',
  array['ca000001-c3c0-4000-8000-000000000001'::uuid],
  array['ca000001-c3c0-4000-8000-000000000001'::uuid]);
delete from public.flashcards where id = 'ca000001-c3c0-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0';
select is((select did_reset from public.complete_learning_coverage_session('d1000004-c3c0-4000-8000-000000000004')), false, 'deleted snapshot card does not make completion fail or reset an empty live scope');

-- Overlapping scopes B+C and C+D share card C.  Each session's reset is bound
-- to its own snapshot: resetting B+C must not touch D, and resetting C+D must
-- not resurrect B.
reset role;
insert into public.flashcard_coverage (user_id, mode, flashcard_id) values
  ('aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'runner', 'ca000002-c3c0-4000-8000-000000000002'),
  ('aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'runner', 'ca000003-c3c0-4000-8000-000000000003'),
  ('aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'runner', 'ca000004-c3c0-4000-8000-000000000004');
insert into public.learning_coverage_sessions (id, user_id, mode, session_card_ids, scope_card_ids) values
  ('d1000005-c3c0-4000-8000-000000000005', 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'runner',
    array['ca000002-c3c0-4000-8000-000000000002'::uuid, 'ca000003-c3c0-4000-8000-000000000003'::uuid],
    array['ca000002-c3c0-4000-8000-000000000002'::uuid, 'ca000003-c3c0-4000-8000-000000000003'::uuid]),
  ('d1000006-c3c0-4000-8000-000000000006', 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0', 'runner',
    array['ca000003-c3c0-4000-8000-000000000003'::uuid, 'ca000004-c3c0-4000-8000-000000000004'::uuid],
    array['ca000003-c3c0-4000-8000-000000000003'::uuid, 'ca000004-c3c0-4000-8000-000000000004'::uuid]);
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0';
select is((select did_reset from public.complete_learning_coverage_session('d1000005-c3c0-4000-8000-000000000005')), true, 'session B+C resets its own scope');
select is((select count(*)::integer from public.flashcard_coverage where user_id = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0' and mode = 'runner' and flashcard_id = 'ca000004-c3c0-4000-8000-000000000004'), 1, 'B+C reset leaves unrelated card D covered');
select is((select did_reset from public.complete_learning_coverage_session('d1000006-c3c0-4000-8000-000000000006')), true, 'session C+D resets its own scope');
select is((select count(*)::integer from public.flashcard_coverage where user_id = 'aaaaaaaa-c3c0-c0c0-c0c0-c0c0c0c0c0c0' and mode = 'runner'), 0, 'overlapping sessions reset cleanly without leaking coverage');

reset role;
select * from finish();
rollback;
