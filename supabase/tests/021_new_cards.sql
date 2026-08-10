-- New Cards read model, origin, and private-session boundary.

begin;
select plan(14);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-2121-2121-2121-212121212121', 'authenticated', 'authenticated', 'new.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-2121-2121-2121-212121212121', 'authenticated', 'authenticated', 'new.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.flashcard_sets (id, user_id, name) values
  ('11111111-2121-2121-2121-212121212121', 'aaaaaaaa-2121-2121-2121-212121212121', 'New A'),
  ('22222222-2121-2121-2121-212121212121', 'bbbbbbbb-2121-2121-2121-212121212121', 'New B');

insert into public.flashcards (id, user_id, set_id, front, back, position, created_at) values
  ('aaaaaaaa-0000-4000-8000-000000002101', 'aaaaaaaa-2121-2121-2121-212121212121', '11111111-2121-2121-2121-212121212121', 'A oldest', 'A oldest answer', 0, '2026-01-01 00:00:00+00'),
  ('aaaaaaaa-0000-4000-8000-000000002102', 'aaaaaaaa-2121-2121-2121-212121212121', '11111111-2121-2121-2121-212121212121', 'A tie lower', 'A tie lower answer', 1, '2026-01-02 00:00:00+00'),
  ('aaaaaaaa-0000-4000-8000-000000002103', 'aaaaaaaa-2121-2121-2121-212121212121', '11111111-2121-2121-2121-212121212121', 'A scheduled', 'A scheduled answer', 2, '2026-01-03 00:00:00+00'),
  ('aaaaaaaa-0000-4000-8000-000000002104', 'aaaaaaaa-2121-2121-2121-212121212121', '11111111-2121-2121-2121-212121212121', 'A rated', 'A rated answer', 3, '2026-01-04 00:00:00+00'),
  ('aaaaaaaa-0000-4000-8000-000000002105', 'aaaaaaaa-2121-2121-2121-212121212121', '11111111-2121-2121-2121-212121212121', 'A boolean', 'A boolean answer', 4, '2026-01-05 00:00:00+00'),
  ('aaaaaaaa-0000-4000-8000-000000002106', 'aaaaaaaa-2121-2121-2121-212121212121', '11111111-2121-2121-2121-212121212121', 'A null', 'A null answer', 5, '2026-01-06 00:00:00+00'),
  ('bbbbbbbb-0000-4000-8000-000000002101', 'bbbbbbbb-2121-2121-2121-212121212121', '22222222-2121-2121-2121-212121212121', 'B new', 'B new answer', 0, '2026-01-01 00:00:00+00');

insert into public.card_learning_schedule (
  user_id, flashcard_id, state, stability, difficulty, due, scheduled_days, learning_steps, reps, lapses,
  last_review, projection_revision, processed_event_count, last_processed_reviewed_at, last_processed_review_event_id,
  algorithm, implementation, parameter_set
) values (
  'aaaaaaaa-2121-2121-2121-212121212121', 'aaaaaaaa-0000-4000-8000-000000002103', 1, 1, 1,
  now(), 0, 1, 1, 0, now(), 0, 1, now(), 'aaaaaaaa-0000-4000-8000-000000002199',
  'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1'
);

insert into public.card_review_events (user_id, flashcard_id, source, is_correct, fsrs_rating, reviewed_at) values
  ('aaaaaaaa-2121-2121-2121-212121212121', 'aaaaaaaa-0000-4000-8000-000000002104', 'study_recall', true, 4, now()),
  ('aaaaaaaa-2121-2121-2121-212121212121', 'aaaaaaaa-0000-4000-8000-000000002105', 'study_recall', false, null, now()),
  ('aaaaaaaa-2121-2121-2121-212121212121', 'aaaaaaaa-0000-4000-8000-000000002106', 'study_recall', null, null, now());

select is(
  has_function_privilege('authenticated', 'public.create_owned_quiz_session_from_card_ids_new_cards(uuid,uuid[])', 'execute'),
  false,
  'authenticated cannot call the private New Cards session wrapper'
);
select is(
  has_function_privilege('service_role', 'public.create_owned_quiz_session_from_card_ids_new_cards(uuid,uuid[])', 'execute'),
  true,
  'service_role can call the private New Cards session wrapper'
);
select is(
  has_function_privilege('anon', 'public.create_owned_quiz_session_from_card_ids_new_cards(uuid,uuid[])', 'execute'),
  false,
  'anon cannot call the private New Cards session wrapper'
);
select is(
  (select count(*) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
   where p.oid = 'public.create_owned_quiz_session_from_card_ids_new_cards(uuid,uuid[])'::regprocedure
     and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'),
  0::bigint,
  'PUBLIC has no execute privilege on the private New Cards session wrapper'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'public.load_new_card_candidates(integer)'::regprocedure),
  'New Cards read model is SECURITY INVOKER and therefore retains RLS'
);
select is(
  has_function_privilege('authenticated', 'public.load_new_card_candidates(integer)', 'execute'),
  true,
  'authenticated can read its own New Card candidates'
);
select is(
  has_function_privilege('anon', 'public.load_new_card_candidates(integer)', 'execute'),
  false,
  'anon cannot call the New Cards read model'
);
select is(
  (select count(*) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
   where p.oid = 'public.load_new_card_candidates(integer)'::regprocedure
     and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'),
  0::bigint,
  'PUBLIC has no execute privilege on the New Cards read model'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-2121-2121-2121-212121212121';

select is((select total from public.load_new_card_candidates(10) limit 1), 3::bigint, 'full count retains genuine New plus null/null-only history');
select is(
  (select array_agg(flashcard_id order by created_at, flashcard_id) from public.load_new_card_candidates(10) where flashcard_id is not null),
  array[
    'aaaaaaaa-0000-4000-8000-000000002101'::uuid,
    'aaaaaaaa-0000-4000-8000-000000002102'::uuid,
    'aaaaaaaa-0000-4000-8000-000000002106'::uuid
  ],
  'candidate order is created_at then flashcard id and schedule/schedulable history are excluded'
);
select throws_ok(
  $$select public.create_owned_quiz_session_from_card_ids_new_cards('aaaaaaaa-2121-2121-2121-212121212121'::uuid, array['aaaaaaaa-0000-4000-8000-000000002101'::uuid])$$,
  '42501', 'permission denied for function create_owned_quiz_session_from_card_ids_new_cards',
  'browser callers cannot forge a New Cards session origin'
);

reset role;
set local role service_role;
select set_config(
  'new.session_id',
  public.create_owned_quiz_session_from_card_ids_new_cards(
    'aaaaaaaa-2121-2121-2121-212121212121'::uuid,
    array['aaaaaaaa-0000-4000-8000-000000002102'::uuid, 'aaaaaaaa-0000-4000-8000-000000002101'::uuid]
  )::text,
  false
);
select is(
  (select origin from public.quiz_sessions where id = current_setting('new.session_id')::uuid),
  'new_cards',
  'trusted wrapper forces the immutable new_cards origin'
);
select is(
  (select array_agg(source_flashcard_id order by position) from public.quiz_questions where session_id = current_setting('new.session_id')::uuid),
  array['aaaaaaaa-0000-4000-8000-000000002102'::uuid, 'aaaaaaaa-0000-4000-8000-000000002101'::uuid],
  'wrapper preserves the server-provided target order'
);
select throws_ok(
  $$update public.quiz_sessions set origin = 'manual' where id = current_setting('new.session_id')::uuid$$,
  '22023', 'quiz session origin is immutable',
  'new_cards origin cannot be changed after creation'
);

reset role;
select * from finish();
rollback;
