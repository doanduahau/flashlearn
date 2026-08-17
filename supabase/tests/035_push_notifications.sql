begin;
select plan(46);

-- ---------------------------------------------------------------------------
-- Setup: users A and B. A owns a set with 10 flashcards and one completed
-- quiz session; mode_answer_events provide match/typing answers. The due-
-- review fixtures exercise the latest-answer merge rule.
-- ---------------------------------------------------------------------------

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-9999-9999-9999-999999999999', 'authenticated', 'authenticated', 'push.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-9999-9999-9999-999999999999', 'authenticated', 'authenticated', 'push.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.flashcard_sets (id, user_id, name) values
  ('a1a1a1a1-9999-9999-9999-999999999999', 'aaaaaaaa-9999-9999-9999-999999999999', 'Push A');

insert into public.flashcards (id, user_id, set_id, front, back, position)
select ('ca0000' || lpad(g::text, 2, '0') || '-9999-4000-8000-000000000001')::uuid,
       'aaaaaaaa-9999-9999-9999-999999999999',
       'a1a1a1a1-9999-9999-9999-999999999999',
       'PF' || g, 'PB' || g, g - 1
from generate_series(1, 10) as g;

-- One completed quiz session: c1, c2 answered WRONG; the rest correct.
insert into public.quiz_sessions (id, user_id, mode, requested_question_count, actual_question_count, source_set_ids, source_collection_ids, source_all, started_at, completed_at, correct_answer_count) values
  ('a1000000-9999-4000-8000-000000000001', 'aaaaaaaa-9999-9999-9999-999999999999', 'balanced', 10, 10, array['a1a1a1a1-9999-9999-9999-999999999999']::uuid[], '{}'::uuid[], false, '2026-08-16 09:00:00+00', '2026-08-16 10:00:00+00', 8);

insert into public.quiz_questions (id, session_id, user_id, position, flashcard_id, prompt, correct_answer, choices, correct_choice_index, selected_choice_index, is_correct, answered_at)
select ('ca00' || lpad(g::text, 4, '0') || '-9999-4000-8000-000000000010')::uuid,
       'a1000000-9999-4000-8000-000000000001',
       'aaaaaaaa-9999-9999-9999-999999999999',
       g - 1,
       ('ca0000' || lpad(g::text, 2, '0') || '-9999-4000-8000-000000000001')::uuid,
       'PF' || g, 'PB' || g,
       jsonb_build_array('PB' || g, 'X', 'Y'),
       0,
       case when g <= 2 then 1 else 0 end,
       g > 2,
       '2026-08-16 09:05:00+00'
from generate_series(1, 10) as g;

-- Mode events AFTER the quiz: c2 answered CORRECT (latest correct -> not
-- due), c3 answered WRONG (latest wrong -> due). c1 stays due from the quiz.
insert into public.mode_answer_events (user_id, flashcard_id, mode, is_correct, answered_at) values
  ('aaaaaaaa-9999-9999-9999-999999999999', 'ca000002-9999-4000-8000-000000000001', 'match', true, '2026-08-16 11:00:00+00'),
  ('aaaaaaaa-9999-9999-9999-999999999999', 'ca000003-9999-4000-8000-000000000001', 'typing', false, '2026-08-16 11:05:00+00');

-- ---------------------------------------------------------------------------
-- 1. Security boundary: get_due_review_card_count grants + behavior.
-- ---------------------------------------------------------------------------

select is(
  has_function_privilege('authenticated', 'public.get_due_review_card_count(uuid)', 'execute'),
  false,
  'authenticated cannot execute get_due_review_card_count'
);
select is(
  has_function_privilege('anon', 'public.get_due_review_card_count(uuid)', 'execute'),
  false,
  'anon cannot execute get_due_review_card_count'
);
select is(
  has_function_privilege('service_role', 'public.get_due_review_card_count(uuid)', 'execute'),
  true,
  'service_role can execute get_due_review_card_count'
);

select is(
  public.get_due_review_card_count('aaaaaaaa-9999-9999-9999-999999999999'),
  2,
  'due count = quiz-wrong c1 + mode-wrong c3 (c2 latest correct excluded)'
);
select is(
  public.get_due_review_card_count('bbbbbbbb-9999-9999-9999-999999999999'),
  0,
  'user with no answers has 0 due cards'
);
select is(
  public.get_due_review_card_count(NULL),
  0,
  'null user returns 0 instead of raising'
);

-- ---------------------------------------------------------------------------
-- 2. push_subscriptions: RLS, grants, defaults, unique constraint.
-- ---------------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = 'public.push_subscriptions'::regclass),
  'push_subscriptions has RLS enabled'
);
select is(
  (select count(*) from pg_policies
   where schemaname = 'public' and tablename = 'push_subscriptions'
     and policyname = 'push_subscriptions_select_own' and cmd = 'SELECT'
     and roles = '{authenticated}'::name[]),
  1::bigint,
  'push_subscriptions_select_own policy exists for authenticated select'
);
select is(
  has_table_privilege('authenticated', 'public.push_subscriptions', 'select'),
  true,
  'authenticated can select push_subscriptions'
);
select is(
  has_table_privilege('authenticated', 'public.push_subscriptions', 'insert'),
  false,
  'authenticated cannot insert push_subscriptions directly'
);
select is(
  has_table_privilege('authenticated', 'public.push_subscriptions', 'update'),
  false,
  'authenticated cannot update push_subscriptions directly'
);
select is(
  has_table_privilege('authenticated', 'public.push_subscriptions', 'delete'),
  false,
  'authenticated cannot delete push_subscriptions directly'
);
select is(
  has_table_privilege('service_role', 'public.push_subscriptions', 'select'),
  true,
  'service_role can select push_subscriptions'
);
select is(
  has_table_privilege('service_role', 'public.push_subscriptions', 'insert'),
  true,
  'service_role can insert push_subscriptions'
);
select is(
  has_table_privilege('service_role', 'public.push_subscriptions', 'update'),
  true,
  'service_role can update push_subscriptions'
);
select is(
  has_table_privilege('service_role', 'public.push_subscriptions', 'delete'),
  true,
  'service_role can delete push_subscriptions'
);

insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('aaaaaaaa-9999-9999-9999-999999999999', 'https://push.example.com/a/1', 'p256-a-1', 'auth-a-1'),
  ('aaaaaaaa-9999-9999-9999-999999999999', 'https://push.example.com/a/2', 'p256-a-2', 'auth-a-2'),
  ('bbbbbbbb-9999-9999-9999-999999999999', 'https://push.example.com/b/1', 'p256-b-1', 'auth-b-1');

select is(
  (select count(*)::integer from public.push_subscriptions where user_id = 'aaaaaaaa-9999-9999-9999-999999999999'),
  2,
  'one row per subscription endpoint is stored'
);
select is(
  (select count(*)::integer from public.push_subscriptions
   where user_id = 'aaaaaaaa-9999-9999-9999-999999999999' and p256dh = 'p256-a-2' and auth = 'auth-a-2'),
  1,
  'subscription stores its VAPID keys'
);
select throws_ok(
  $$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('aaaaaaaa-9999-9999-9999-999999999999', 'https://push.example.com/a/1', 'dup', 'dup')$$,
  '23505', NULL,
  'duplicate (user_id, endpoint) raises a unique violation'
);

-- ---------------------------------------------------------------------------
-- 3. notification_preferences: RLS, grants, defaults, PK.
-- ---------------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = 'public.notification_preferences'::regclass),
  'notification_preferences has RLS enabled'
);
select is(
  (select count(*) from pg_policies
   where schemaname = 'public' and tablename = 'notification_preferences'
     and policyname = 'notification_preferences_select_own' and cmd = 'SELECT'
     and roles = '{authenticated}'::name[]),
  1::bigint,
  'notification_preferences_select_own policy exists for authenticated select'
);
select is(
  has_table_privilege('authenticated', 'public.notification_preferences', 'select'),
  true,
  'authenticated can select notification_preferences'
);
select is(
  has_table_privilege('authenticated', 'public.notification_preferences', 'insert'),
  false,
  'authenticated cannot insert notification_preferences directly'
);
select is(
  has_table_privilege('authenticated', 'public.notification_preferences', 'update'),
  false,
  'authenticated cannot update notification_preferences directly'
);
select is(
  has_table_privilege('authenticated', 'public.notification_preferences', 'delete'),
  false,
  'authenticated cannot delete notification_preferences directly'
);
select is(
  has_table_privilege('service_role', 'public.notification_preferences', 'insert'),
  true,
  'service_role can insert notification_preferences'
);

insert into public.notification_preferences (user_id) values
  ('aaaaaaaa-9999-9999-9999-999999999999');

select is(
  (select push_enabled from public.notification_preferences where user_id = 'aaaaaaaa-9999-9999-9999-999999999999'),
  false,
  'push_enabled defaults to false'
);
select is(
  (select streak_enabled from public.notification_preferences where user_id = 'aaaaaaaa-9999-9999-9999-999999999999'),
  true,
  'streak_enabled defaults to true'
);
select is(
  (select streak_time::text from public.notification_preferences where user_id = 'aaaaaaaa-9999-9999-9999-999999999999'),
  '19:00:00',
  'streak_time defaults to 19:00'
);
select is(
  (select review_enabled from public.notification_preferences where user_id = 'aaaaaaaa-9999-9999-9999-999999999999'),
  true,
  'review_enabled defaults to true'
);
select is(
  (select review_time::text from public.notification_preferences where user_id = 'aaaaaaaa-9999-9999-9999-999999999999'),
  '19:00:00',
  'review_time defaults to 19:00'
);
select throws_ok(
  $$insert into public.notification_preferences (user_id) values ('aaaaaaaa-9999-9999-9999-999999999999')$$,
  '23505', NULL,
  'second preference row for the same user violates the primary key'
);

-- ---------------------------------------------------------------------------
-- 4. push_notifications_log: service-role only, kind check, dedupe.
-- ---------------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = 'public.push_notifications_log'::regclass),
  'push_notifications_log has RLS enabled'
);
select is(
  has_table_privilege('authenticated', 'public.push_notifications_log', 'select'),
  false,
  'authenticated cannot select push_notifications_log'
);
select is(
  has_table_privilege('authenticated', 'public.push_notifications_log', 'insert'),
  false,
  'authenticated cannot insert push_notifications_log'
);
select is(
  has_table_privilege('anon', 'public.push_notifications_log', 'select'),
  false,
  'anon cannot select push_notifications_log'
);
select is(
  has_table_privilege('service_role', 'public.push_notifications_log', 'insert'),
  true,
  'service_role can insert push_notifications_log'
);

insert into public.push_notifications_log (user_id, kind, local_date) values
  ('aaaaaaaa-9999-9999-9999-999999999999', 'streak', '2026-08-17'),
  ('aaaaaaaa-9999-9999-9999-999999999999', 'review', '2026-08-17');

select is(
  (select count(*)::integer from public.push_notifications_log
   where user_id = 'aaaaaaaa-9999-9999-9999-999999999999'),
  2,
  'streak + review log rows for the same day are both stored'
);
select throws_ok(
  $$insert into public.push_notifications_log (user_id, kind, local_date)
    values ('aaaaaaaa-9999-9999-9999-999999999999', 'streak', '2026-08-17')$$,
  '23505', NULL,
  'duplicate (user_id, kind, local_date) raises a unique violation (dedupe)'
);
select throws_ok(
  $$insert into public.push_notifications_log (user_id, kind, local_date)
    values ('aaaaaaaa-9999-9999-9999-999999999999', 'bogus', '2026-08-17')$$,
  '23514', NULL,
  'unknown kind violates the check constraint'
);
select is(
  (select sent_at is not null from public.push_notifications_log
   where user_id = 'aaaaaaaa-9999-9999-9999-999999999999' and kind = 'streak'),
  true,
  'log rows record a sent_at timestamp'
);

-- ---------------------------------------------------------------------------
-- 5. RLS isolation: authenticated users see only their own subscriptions and
--    preferences, and nothing in the log.
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-9999-9999-9999-999999999999';
select is(
  (select count(*)::integer from public.push_subscriptions where user_id = 'aaaaaaaa-9999-9999-9999-999999999999'),
  2,
  'authenticated can read own push subscriptions'
);
select is(
  (select count(*)::integer from public.push_subscriptions where user_id = 'bbbbbbbb-9999-9999-9999-999999999999'),
  0,
  'RLS hides another user''s push subscriptions'
);
select is(
  (select count(*)::integer from public.notification_preferences where user_id = 'aaaaaaaa-9999-9999-9999-999999999999'),
  1,
  'authenticated can read own notification preferences'
);
select is(
  (select count(*)::integer from public.notification_preferences where user_id = 'bbbbbbbb-9999-9999-9999-999999999999'),
  0,
  'RLS hides another user''s notification preferences'
);
select throws_ok(
  $$select count(*) from public.push_notifications_log where user_id = 'aaaaaaaa-9999-9999-9999-999999999999'$$,
  '42501', NULL,
  'authenticated querying the push log is denied (service-role only)'
);
reset role;

select * from finish();
rollback;
