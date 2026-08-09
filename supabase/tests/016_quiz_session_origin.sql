begin;
select plan(9);

insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-6666-6666-6666-666666666666', 'authenticated', 'authenticated', 'origin.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.flashcard_sets (id, user_id, name)
values ('11111111-6666-6666-6666-666666666666', 'aaaaaaaa-6666-6666-6666-666666666666', 'Origin A');

insert into public.flashcards (id, user_id, set_id, front, back, position)
select
  ('00000000-6666-6666-6666-' || lpad(n::text, 12, '0'))::uuid,
  'aaaaaaaa-6666-6666-6666-666666666666',
  '11111111-6666-6666-6666-666666666666',
  'Prompt ' || n,
  'Answer ' || n,
  n - 1
from generate_series(1, 10) n;

set local role service_role;
insert into public.quiz_sessions (id, user_id, mode, requested_question_count, actual_question_count)
values ('11111111-6666-6666-6666-000000000001', 'aaaaaaaa-6666-6666-6666-666666666666', 'balanced', 1, 1);
select is((select origin from public.quiz_sessions where id = '11111111-6666-6666-6666-000000000001'), 'manual', 'rows that omit origin, including historical-compatible rows, resolve to manual');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-6666-6666-6666-666666666666';
select lives_ok(
  $$select public.create_quiz_session('balanced', array['11111111-6666-6666-6666-666666666666']::uuid[], '{}'::uuid[], false, 10)$$,
  'normal quiz creation succeeds without an origin parameter'
);
select is(
  (select origin from public.quiz_sessions where user_id = 'aaaaaaaa-6666-6666-6666-666666666666' and id <> '11111111-6666-6666-6666-000000000001'),
  'manual',
  'normal quiz creation persists the manual origin'
);
select throws_ok(
  $$update public.quiz_sessions set origin = 'smart_review' where id = '11111111-6666-6666-6666-000000000001'$$,
  '42501',
  'permission denied for table quiz_sessions',
  'a browser role cannot forge Smart Review origin through a session update'
);
select throws_ok(
  $$select public.create_owned_quiz_session_from_card_ids('aaaaaaaa-6666-6666-6666-666666666666'::uuid, array['00000000-6666-6666-6666-000000000001'::uuid])$$,
  '42501',
  'permission denied for function create_owned_quiz_session_from_card_ids',
  'a browser role cannot call the private Smart Review wrapper'
);

reset role;
set local role service_role;
select throws_ok(
  $$update public.quiz_sessions set origin = 'smart_review' where id = '11111111-6666-6666-6666-000000000001'$$,
  '22023',
  'quiz session origin is immutable',
  'even privileged session updates cannot change an existing origin'
);
select is((select origin from public.quiz_sessions where id = '11111111-6666-6666-6666-000000000001'), 'manual', 'a rejected origin mutation leaves the durable origin unchanged');

select is(
  has_function_privilege('authenticated', 'public.create_owned_quiz_session_from_card_ids(uuid,uuid[])', 'execute'),
  false,
  'the replacement wrapper remains unavailable to authenticated clients'
);
select is(
  has_function_privilege('service_role', 'public.create_owned_quiz_session_from_card_ids(uuid,uuid[])', 'execute'),
  true,
  'the replacement wrapper remains available only to service_role'
);

reset role;
select * from finish();
rollback;
