begin;
select plan(24);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'review.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'review.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.flashcard_sets (id, user_id, name)
values ('11111111-3333-3333-3333-333333333333', 'aaaaaaaa-3333-3333-3333-333333333333', 'Review A');

insert into public.flashcards (id, user_id, set_id, front, back, position)
select
  ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'aaaaaaaa-3333-3333-3333-333333333333',
  '11111111-3333-3333-3333-333333333333',
  'Prompt ' || n,
  'Answer ' || n,
  n - 1
from generate_series(1, 12) n;

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-3333-3333-3333-333333333333';

select lives_ok(
  $$select public.create_quiz_session('balanced', array['11111111-3333-3333-3333-333333333333']::uuid[], '{}'::uuid[], false, 10)$$,
  'creates a quiz session for event recording'
);

select set_config('review.correct_question_id', (select id::text from public.quiz_questions order by position limit 1), false);
select set_config('review.incorrect_question_id', (select id::text from public.quiz_questions order by position offset 1 limit 1), false);

select lives_ok(
  $$select public.submit_quiz_answer(current_setting('review.correct_question_id')::uuid, (select correct_choice_index from public.quiz_questions where id = current_setting('review.correct_question_id')::uuid))$$,
  'correct answer is accepted'
);
select is(
  (select count(*) from public.card_review_events where quiz_question_id = current_setting('review.correct_question_id')::uuid),
  1::bigint,
  'a correct answer records exactly one event'
);
select is(
  (select is_correct from public.card_review_events where quiz_question_id = current_setting('review.correct_question_id')::uuid),
  true,
  'the correct result is recorded'
);

select lives_ok(
  $$select public.submit_quiz_answer(current_setting('review.incorrect_question_id')::uuid, (select case when correct_choice_index = 0 then 1 else 0 end from public.quiz_questions where id = current_setting('review.incorrect_question_id')::uuid))$$,
  'incorrect answer is accepted'
);
select is(
  (select count(*) from public.card_review_events where quiz_question_id = current_setting('review.incorrect_question_id')::uuid),
  1::bigint,
  'an incorrect answer records exactly one event'
);
select is(
  (select is_correct from public.card_review_events where quiz_question_id = current_setting('review.incorrect_question_id')::uuid),
  false,
  'the incorrect result is recorded'
);
select lives_ok(
  $$select public.submit_quiz_answer(current_setting('review.correct_question_id')::uuid, 0)$$,
  'an exact answer retry returns the immutable existing answer'
);
select is(
  (select count(*) from public.card_review_events where quiz_question_id = current_setting('review.correct_question_id')::uuid),
  1::bigint,
  'a retry cannot duplicate an event'
);

select set_config('review.deleted_question_id', (select id::text from public.quiz_questions order by position offset 2 limit 1), false);
select set_config('review.deleted_card_id', (select source_flashcard_id::text from public.quiz_questions where id = current_setting('review.deleted_question_id')::uuid), false);
reset role;
delete from public.flashcards where id = current_setting('review.deleted_card_id')::uuid;
select is(
  (select flashcard_id from public.quiz_questions where id = current_setting('review.deleted_question_id')::uuid),
  null::uuid,
  'existing quiz snapshots still tolerate deleted source cards'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-3333-3333-3333-333333333333';
select lives_ok(
  $$select public.submit_quiz_answer(current_setting('review.deleted_question_id')::uuid, (select correct_choice_index from public.quiz_questions where id = current_setting('review.deleted_question_id')::uuid))$$,
  'a snapshot remains answerable after its source card is deleted'
);
select is(
  (select flashcard_id::text from public.card_review_events where quiz_question_id = current_setting('review.deleted_question_id')::uuid),
  current_setting('review.deleted_card_id'),
  'the event retains the deleted source card identity'
);
select lives_ok(
  $$select answer.* from public.quiz_questions q cross join lateral public.submit_quiz_answer(q.id, q.correct_choice_index) answer where q.answered_at is null$$,
  'remaining answers complete the existing quiz flow'
);
select ok(
  (select completed_at is not null from public.quiz_sessions limit 1),
  'the quiz session still completes'
);
select is(
  (select correct_answer_count from public.quiz_sessions limit 1),
  9,
  'the existing quiz score remains correct'
);
select is(
  (select completed_quiz_count from public.daily_learning_records limit 1),
  1,
  'completion still records daily learning activity'
);
select is(
  (select questions_answered from public.daily_learning_records limit 1),
  10,
  'daily learning activity retains its question total'
);

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-3333-3333-3333-333333333333';
select is((select count(*) from public.card_review_events), 0::bigint, 'RLS hides another user events');
select throws_ok(
  $$insert into public.card_review_events (user_id, flashcard_id, source, is_correct, reviewed_at) values ('aaaaaaaa-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000002', 'study_recall', true, now())$$,
  '42501',
  'permission denied for table card_review_events',
  'a user cannot forge another user event'
);
select throws_ok(
  $$update public.card_review_events set is_correct = false$$,
  '42501',
  'permission denied for table card_review_events',
  'a normal client cannot mutate historical events'
);
select throws_ok(
  $$delete from public.card_review_events$$,
  '42501',
  'permission denied for table card_review_events',
  'a normal client cannot delete historical events'
);
reset role;
select is((select has_table_privilege('authenticated', 'public.card_review_events', 'insert')), false, 'direct event inserts are denied');
select is((select has_table_privilege('authenticated', 'public.card_review_events', 'update')), false, 'direct event updates are denied');
select is((select has_table_privilege('authenticated', 'public.card_review_events', 'delete')), false, 'direct event deletes are denied');

select * from finish();
rollback;
