begin;
select plan(15);

insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'authenticated', 'authenticated', 'coverage.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'authenticated', 'authenticated', 'coverage.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.flashcard_sets (id, user_id, name) values
  ('a1a1a1a1-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'aaaaaaaa-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'Coverage A'),
  ('b1b1b1b1-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'bbbbbbbb-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'Coverage B');

insert into public.flashcards (id, user_id, set_id, front, back) values
  ('cacacaca-0000-4000-8000-000000000001', 'aaaaaaaa-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'a1a1a1a1-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'A1', 'A1'),
  ('cacacaca-0000-4000-8000-000000000002', 'aaaaaaaa-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'a1a1a1a1-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'A2', 'A2'),
  ('cbcbcbcb-0000-4000-8000-000000000001', 'bbbbbbbb-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'b1b1b1b1-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'B1', 'B1');

-- Own coverage: insert select delete
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-c0c0-c0c0-c0c0-c0c0c0c0c0c0';

select lives_ok(
  $$insert into public.flashcard_coverage (user_id, mode, flashcard_id) values ('aaaaaaaa-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'match', 'cacacaca-0000-4000-8000-000000000001')$$,
  'own user can insert coverage'
);

select is(
  (select count(*)::integer from public.flashcard_coverage where user_id = 'aaaaaaaa-c0c0-c0c0-c0c0-c0c0c0c0c0c0'),
  1,
  'own coverage row is visible'
);

select lives_ok(
  $$delete from public.flashcard_coverage where user_id = 'aaaaaaaa-c0c0-c0c0-c0c0-c0c0c0c0c0c0'$$,
  'own user can delete coverage'
);

-- Foreign coverage: cannot insert or see
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-c0c0-c0c0-c0c0-c0c0c0c0c0c0';

select throws_ok(
  $$insert into public.flashcard_coverage (user_id, mode, flashcard_id) values ('aaaaaaaa-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'match', 'cacacaca-0000-4000-8000-000000000001')$$,
  '42501',
  NULL,
  'foreign user cannot insert coverage for another user'
);

select is(
  (select count(*)::integer from public.flashcard_coverage where user_id = 'aaaaaaaa-c0c0-c0c0-c0c0-c0c0c0c0c0c0'),
  0,
  'foreign user sees zero of another users coverage rows'
);

-- Cannot reference foreign flashcard
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-c0c0-c0c0-c0c0-c0c0c0c0c0c0';

select throws_ok(
  $$insert into public.flashcard_coverage (user_id, mode, flashcard_id) values ('bbbbbbbb-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'match', 'cacacaca-0000-4000-8000-000000000001')$$,
  '42501',
  NULL,
  'cannot cover a card owned by another user'
);

-- Mode separation
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-c0c0-c0c0-c0c0-c0c0c0c0c0c0';

insert into public.flashcard_coverage (user_id, mode, flashcard_id) values
  ('bbbbbbbb-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'match', 'cbcbcbcb-0000-4000-8000-000000000001');

select is(
  (select count(*)::integer from public.flashcard_coverage where user_id = 'bbbbbbbb-c0c0-c0c0-c0c0-c0c0c0c0c0c0' and mode = 'match'),
  1,
  'match coverage exists'
);

select is(
  (select count(*)::integer from public.flashcard_coverage where user_id = 'bbbbbbbb-c0c0-c0c0-c0c0-c0c0c0c0c0c0' and mode = 'quiz'),
  0,
  'quiz coverage is independent of match coverage'
);

-- On-conflict upsert is idempotent
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-c0c0-c0c0-c0c0-c0c0c0c0c0c0';

insert into public.flashcard_coverage (user_id, mode, flashcard_id) values
  ('bbbbbbbb-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'match', 'cbcbcbcb-0000-4000-8000-000000000001')
on conflict (user_id, mode, flashcard_id) do nothing;

select is(
  (select count(*)::integer from public.flashcard_coverage where user_id = 'bbbbbbbb-c0c0-c0c0-c0c0-c0c0c0c0c0c0' and mode = 'match'),
  1,
  'upsert is idempotent'
);

-- Cascade delete
reset role;
delete from public.flashcards where id = 'cbcbcbcb-0000-4000-8000-000000000001';
select is(
  (select count(*)::integer from public.flashcard_coverage where flashcard_id = 'cbcbcbcb-0000-4000-8000-000000000001'),
  0,
  'coverage is cascade-deleted with flashcard'
);

-- Invalid mode rejected by check constraint
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-c0c0-c0c0-c0c0-c0c0c0c0c0c0';

select throws_ok(
  $$insert into public.flashcard_coverage (user_id, mode, flashcard_id) values ('aaaaaaaa-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'study', 'cacacaca-0000-4000-8000-000000000002')$$,
  '23514',
  NULL,
  'non-coverage mode is rejected'
);

-- Verify valid modes are accepted
select lives_ok($$insert into public.flashcard_coverage (user_id, mode, flashcard_id) values ('aaaaaaaa-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'quiz', 'cacacaca-0000-4000-8000-000000000001')$$, 'quiz mode accepted');
select lives_ok($$insert into public.flashcard_coverage (user_id, mode, flashcard_id) values ('aaaaaaaa-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'match', 'cacacaca-0000-4000-8000-000000000002')$$, 'match mode accepted');
select lives_ok($$insert into public.flashcard_coverage (user_id, mode, flashcard_id) values ('aaaaaaaa-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'memory', 'cacacaca-0000-4000-8000-000000000001')$$, 'memory mode accepted');
select lives_ok($$insert into public.flashcard_coverage (user_id, mode, flashcard_id) values ('aaaaaaaa-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'runner', 'cacacaca-0000-4000-8000-000000000002')$$, 'runner mode accepted');

reset role;
select * from finish();
rollback;
