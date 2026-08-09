-- card_learning_schedule table, RLS and deletion tests.

begin;

select plan(14);

-- fixtures ------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'authenticated', 'authenticated', 's16.a@example.com', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

insert into public.flashcard_sets (id, user_id, name)
values ('16111111-1111-1111-1111-1611111111aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Set A');

insert into public.flashcards (id, user_id, set_id, front, back)
values ('16222222-2222-2222-2222-1622222222aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '16111111-1111-1111-1111-1611111111aa', 'A front', 'A back');

insert into public.card_review_events (id, user_id, flashcard_id, source, is_correct, reviewed_at)
values ('16000000-0000-4000-8000-160000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '16222222-2222-2222-2222-1622222222aa', 'smart_review', true, '2026-08-09 12:00:00+00');

-- table exists ----------------------------------------------------------------
select ok(exists (select 1 from pg_class where relname = 'card_learning_schedule' and relkind = 'r'));

-- RLS enabled -----------------------------------------------------------------
select is((select relrowsecurity from pg_class where relname = 'card_learning_schedule'), true);

-- fsrs_rating nullable + check ------------------------------------------------
select is((select is_nullable from information_schema.columns where table_schema='public' and table_name='card_review_events' and column_name='fsrs_rating'), 'YES');

select throws_ok(
  $$insert into public.card_review_events (id, user_id, flashcard_id, source, is_correct, reviewed_at, fsrs_rating) values (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '16222222-2222-2222-2222-1622222222aa', 'smart_review', true, now(), 0)$$,
  '23514', NULL
);

select throws_ok(
  $$insert into public.card_review_events (id, user_id, flashcard_id, source, is_correct, reviewed_at, fsrs_rating) values (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '16222222-2222-2222-2222-1622222222aa', 'smart_review', true, now(), 5)$$,
  '23514', NULL
);

-- authenticated cannot direct INSERT ------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select throws_ok(
  $$insert into public.card_learning_schedule (user_id, flashcard_id, state, stability, difficulty, due, last_review, processed_event_count, last_processed_reviewed_at, last_processed_review_event_id, algorithm, implementation, parameter_set) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '16222222-2222-2222-2222-1622222222aa', 1, 2.3, 2.1, now(), now(), 2, now(), '16000000-0000-4000-8000-160000000001', 'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1')$$,
  '42501', NULL
);

select throws_ok('update public.card_learning_schedule set stability = 99', '42501', NULL);
select throws_ok('delete from public.card_learning_schedule', '42501', NULL);

reset role;

-- FK cascade: delete flashcard -------------------------------------------------

insert into public.card_learning_schedule (
  user_id, flashcard_id, state, stability, difficulty, due, scheduled_days, learning_steps, reps, lapses, last_review,
  projection_revision, processed_event_count, last_processed_reviewed_at, last_processed_review_event_id,
  algorithm, implementation, parameter_set
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '16222222-2222-2222-2222-1622222222aa',
  1, 2.3065, 2.1181, '2026-08-09 12:10:00+00', 0, 1, 1, 0, '2026-08-09 12:00:00+00',
  0, 1, '2026-08-09 12:00:00+00', '16000000-0000-4000-8000-160000000001',
  'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1'
);

select is(
  (select count(*) from public.card_learning_schedule where flashcard_id = '16222222-2222-2222-2222-1622222222aa'),
  1::bigint
);

delete from public.flashcards where id = '16222222-2222-2222-2222-1622222222aa';

select is(
  (select count(*) from public.card_learning_schedule where flashcard_id = '16222222-2222-2222-2222-1622222222aa'),
  0::bigint
);

-- CHECK constraints ------------------------------------------------------------

-- Re-insert flashcard for check tests
insert into public.flashcards (id, user_id, set_id, front, back)
values ('16222222-2222-2222-2222-1622222222aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '16111111-1111-1111-1111-1611111111aa', 'A front', 'A back');

select throws_ok(
  $$insert into public.card_learning_schedule (user_id, flashcard_id, state, stability, difficulty, due, last_review, processed_event_count, last_processed_reviewed_at, last_processed_review_event_id, algorithm, implementation, parameter_set) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '16222222-2222-2222-2222-1622222222aa', 5, 2.3, 2.1, now(), now(), 1, now(), '16000000-0000-4000-8000-160000000001', 'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1')$$,
  '23514', NULL
);

select throws_ok(
  $$insert into public.card_learning_schedule (user_id, flashcard_id, state, stability, difficulty, due, last_review, processed_event_count, last_processed_reviewed_at, last_processed_review_event_id, algorithm, implementation, parameter_set) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '16222222-2222-2222-2222-1622222222aa', 1, -1, 2.1, now(), now(), 1, now(), '16000000-0000-4000-8000-160000000001', 'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1')$$,
  '23514', NULL
);

select throws_ok(
  $$insert into public.card_learning_schedule (user_id, flashcard_id, state, stability, difficulty, due, last_review, processed_event_count, last_processed_reviewed_at, last_processed_review_event_id, algorithm, implementation, parameter_set) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '16222222-2222-2222-2222-1622222222aa', 1, 2.3, 2.1, now(), now(), 0, now(), '16000000-0000-4000-8000-160000000001', 'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1')$$,
  '23514', NULL
);

-- FK: nonexistent flashcard -------------------------------------------------
select throws_ok(
  $$insert into public.card_learning_schedule (user_id, flashcard_id, state, stability, difficulty, due, last_review, processed_event_count, last_processed_reviewed_at, last_processed_review_event_id, algorithm, implementation, parameter_set) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 1, 2.3, 2.1, now(), now(), 1, now(), '16000000-0000-4000-8000-160000000001', 'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1')$$,
  '23503', NULL
);

select * from finish();
rollback;
