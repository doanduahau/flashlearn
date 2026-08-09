begin;
select plan(16);

insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'explicit.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'explicit.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.flashcard_sets (id, user_id, name) values
  ('11111111-5555-5555-5555-555555555555', 'aaaaaaaa-5555-5555-5555-555555555555', 'Explicit A1'),
  ('22222222-5555-5555-5555-555555555555', 'aaaaaaaa-5555-5555-5555-555555555555', 'Explicit A2'),
  ('33333333-5555-5555-5555-555555555555', 'bbbbbbbb-5555-5555-5555-555555555555', 'Explicit B');

insert into public.flashcards (id, user_id, set_id, front, back, position)
select
  ('00000000-5555-5555-5555-' || lpad(n::text, 12, '0'))::uuid,
  'aaaaaaaa-5555-5555-5555-555555555555',
  case when n <= 4 then '11111111-5555-5555-5555-555555555555'::uuid else '22222222-5555-5555-5555-555555555555'::uuid end,
  'Prompt ' || n,
  'Answer ' || n,
  n - 1
from generate_series(1, 8) n;

insert into public.flashcards (id, user_id, set_id, front, back, position)
values ('00000000-5555-5555-5555-999999999999', 'bbbbbbbb-5555-5555-5555-555555555555', '33333333-5555-5555-5555-555555555555', 'Foreign prompt', 'Foreign answer', 0);

set local role service_role;

select lives_ok(
  $$select public.create_owned_quiz_session_from_card_ids('aaaaaaaa-5555-5555-5555-555555555555'::uuid, array[
    '00000000-5555-5555-5555-000000000006'::uuid,
    '00000000-5555-5555-5555-000000000001'::uuid,
    '00000000-5555-5555-5555-000000000005'::uuid,
    '00000000-5555-5555-5555-000000000003'::uuid,
    '00000000-5555-5555-5555-000000000007'::uuid,
    '00000000-5555-5555-5555-000000000002'::uuid
  ])$$,
  'creates an explicit multi-set quiz session'
);
select set_config('explicit.session_id', (select id::text from public.quiz_sessions limit 1), false);
select is((select actual_question_count from public.quiz_sessions where id = current_setting('explicit.session_id')::uuid), 6, 'six explicit target cards create six questions');
select is((select count(*) from public.quiz_questions where session_id = current_setting('explicit.session_id')::uuid), 6::bigint, 'only target cards become questions');
select is(
  (select array_agg(source_flashcard_id order by position) from public.quiz_questions where session_id = current_setting('explicit.session_id')::uuid),
  array[
    '00000000-5555-5555-5555-000000000006'::uuid,
    '00000000-5555-5555-5555-000000000001'::uuid,
    '00000000-5555-5555-5555-000000000005'::uuid,
    '00000000-5555-5555-5555-000000000003'::uuid,
    '00000000-5555-5555-5555-000000000007'::uuid,
    '00000000-5555-5555-5555-000000000002'::uuid
  ],
  'question order preserves the explicit target order across sets'
);
select is((select count(*) from public.quiz_questions where session_id = current_setting('explicit.session_id')::uuid and source_flashcard_id in ('00000000-5555-5555-5555-000000000004'::uuid, '00000000-5555-5555-5555-000000000008'::uuid)), 0::bigint, 'distractor-only cards do not become questions');
select ok((select bool_and(jsonb_array_length(choices) between 2 and 4) from public.quiz_questions where session_id = current_setting('explicit.session_id')::uuid), 'existing choice validation is reused');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-5555-5555-5555-555555555555';
select set_config('explicit.first_question_id', (select id::text from public.quiz_questions where session_id = current_setting('explicit.session_id')::uuid order by position limit 1), false);
select lives_ok(
  $$select public.submit_quiz_answer(current_setting('explicit.first_question_id')::uuid, (select correct_choice_index from public.quiz_questions where id = current_setting('explicit.first_question_id')::uuid))$$,
  'an explicit target answer uses the normal answer RPC'
);
select is((select count(*) from public.card_review_events where quiz_question_id = current_setting('explicit.first_question_id')::uuid), 1::bigint, 'a target answer records exactly one review event');
select is((select source from public.card_review_events where quiz_question_id = current_setting('explicit.first_question_id')::uuid), 'quiz', 'the event keeps the normal quiz source');
select lives_ok(
  $$select answer.* from public.quiz_questions q cross join lateral public.submit_quiz_answer(q.id, q.correct_choice_index) answer where q.session_id = current_setting('explicit.session_id')::uuid and q.answered_at is null$$,
  'remaining answers complete the explicit quiz'
);
select ok((select completed_at is not null from public.quiz_sessions where id = current_setting('explicit.session_id')::uuid), 'completion preserves normal quiz behavior');
select is((select completed_quiz_count from public.daily_learning_records where user_id = 'aaaaaaaa-5555-5555-5555-555555555555'), 1, 'completion preserves daily learning activity');

reset role;
delete from public.flashcards where id = '00000000-5555-5555-5555-000000000003';
set local role service_role;
select lives_ok(
  $$select set_config('explicit.revalidated_session_id', public.create_owned_quiz_session_from_card_ids('aaaaaaaa-5555-5555-5555-555555555555'::uuid, array['00000000-5555-5555-5555-000000000003'::uuid, '00000000-5555-5555-5555-000000000004'::uuid])::text, false)$$,
  'a deleted target is revalidated and excluded at creation time'
);
select is((select actual_question_count from public.quiz_sessions where id = current_setting('explicit.revalidated_session_id')::uuid), 1, 'remaining active target still starts a short quiz');

select throws_ok(
  $$select public.create_owned_quiz_session_from_card_ids('bbbbbbbb-5555-5555-5555-555555555555'::uuid, array['00000000-5555-5555-5555-000000000001'::uuid])$$,
  '22023',
  'no active explicit quiz cards',
  'a User B-scoped server call cannot use User A cards as explicit targets'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-5555-5555-5555-555555555555';
select throws_ok(
  $$select public.create_owned_quiz_session_from_card_ids('bbbbbbbb-5555-5555-5555-555555555555'::uuid, array['00000000-5555-5555-5555-000000000001'::uuid])$$,
  '42501',
  'permission denied for function create_owned_quiz_session_from_card_ids',
  'a normal client cannot submit explicit target card IDs'
);

select * from finish();
rollback;
