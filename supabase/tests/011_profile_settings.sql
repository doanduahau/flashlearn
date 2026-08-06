-- Profile updates are restricted to the caller and timezone changes are
-- database-clock-controlled. Completed local dates are immutable snapshots.

begin;

select plan(22);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'settings.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"User A"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'settings.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

-- This historical record intentionally predates the test. It must stay on its
-- stored local date after timezone changes.
insert into public.daily_learning_records (
  user_id, local_date, timezone, completed_quiz_count, questions_answered,
  correct_answers, first_completed_at, last_completed_at
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-05', 'Asia/Ho_Chi_Minh',
  1, 10, 8, '2026-01-05T10:00:00Z', '2026-01-05T10:00:00Z'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select is(
  (public.update_profile('Nguyễn Văn A', 'Pacific/Kiritimati')).timezone,
  'Pacific/Kiritimati',
  'first timezone update succeeds'
);

select ok(
  (select timezone_changed_at is not null from public.profiles where id = auth.uid()),
  'timezone change timestamp is server controlled and recorded'
);

select throws_ok(
  $$select public.update_profile('Nguyễn Văn A', 'Pacific/Pago_Pago')$$,
  'P0001',
  'timezone_change_cooldown',
  'second timezone change within 72 hours is rejected'
);

select is(
  (public.update_profile('Tên vẫn đổi được', 'Pacific/Kiritimati')).display_name,
  'Tên vẫn đổi được',
  'display-name-only update succeeds during timezone cooldown'
);

select is(
  (select timezone from public.profiles where id = auth.uid()),
  'Pacific/Kiritimati',
  'display-name update does not alter timezone during cooldown'
);

set local timezone = 'Pacific/Kiritimati';
select throws_ok(
  $$select public.update_profile('Tên vẫn đổi được', 'America/New_York')$$,
  'P0001',
  'timezone_change_cooldown',
  'changing the client session timezone cannot bypass the database clock cooldown'
);
reset timezone;

reset role;
update public.profiles
set timezone_changed_at = now() - interval '73 hours'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select is(
  (public.update_profile('Tên vẫn đổi được', 'Pacific/Pago_Pago')).timezone,
  'Pacific/Pago_Pago',
  'timezone update succeeds after the server-side cooldown expires'
);

select is(
  (select local_date from public.daily_learning_records where user_id = auth.uid() and local_date = '2026-01-05'),
  '2026-01-05'::date,
  'historical activity date remains immutable after timezone update'
);

select is(
  public.get_learning_statistics() ->> 'last_active_date',
  '2026-01-05',
  'statistics use the immutable historical activity date'
);

select throws_ok(
  $$update public.profiles set timezone = 'Asia/Ho_Chi_Minh' where id = auth.uid()$$,
  '42501',
  NULL,
  'direct profile timezone updates remain revoked'
);

select throws_ok(
  $$update public.profiles set timezone_changed_at = now() where id = auth.uid()$$,
  '42501',
  NULL,
  'direct cooldown timestamp updates remain revoked'
);

select throws_ok(
  $$update public.profiles set avatar_url = 'x' where id = auth.uid()$$,
  '42501',
  NULL,
  'protected profile columns remain unavailable to direct updates'
);

select ok(
  has_function_privilege('authenticated', 'public.update_profile(text, text)', 'EXECUTE'),
  'authenticated role can execute the scoped profile RPC'
);

select ok(
  not has_function_privilege('anon', 'public.update_profile(text, text)', 'EXECUTE'),
  'anonymous role cannot execute the profile RPC'
);

reset role;
select is(
  (select timezone from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'Asia/Ho_Chi_Minh',
  'User A cannot alter User B timezone'
);

-- Build an unfinished 10-question session directly as the migration owner.
-- The authenticated RPC below is the only completion path and must snapshot
-- the caller's current timezone into the future activity record.
insert into public.quiz_sessions (
  id, user_id, mode, requested_question_count, actual_question_count,
  source_set_ids, source_collection_ids, source_all, started_at
) values (
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'balanced', 10, 10, '{}', '{}', false, now()
);

insert into public.quiz_questions (
  id, session_id, user_id, position, prompt, correct_answer, choices, correct_choice_index
)
select
  ('00000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid,
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  position,
  'Prompt ' || position,
  'Đáp án đúng ' || position,
  jsonb_build_array('Đáp án đúng ' || position, 'Nhiễu ' || position),
  0
from generate_series(0, 9) as position;

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select public.submit_quiz_answer(
  ('00000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid,
  0
)
from generate_series(0, 9) as position;

select is(
  (select timezone from public.daily_learning_records where user_id = auth.uid() order by last_completed_at desc limit 1),
  'Pacific/Pago_Pago',
  'future completed activity snapshots the new profile timezone'
);

select is(
  (select local_date from public.daily_learning_records where user_id = auth.uid() order by last_completed_at desc limit 1),
  (now() at time zone 'Pacific/Pago_Pago')::date,
  'future activity uses the new timezone at completion'
);

select is(
  (select completed_quiz_count from public.daily_learning_records where user_id = auth.uid() order by last_completed_at desc limit 1),
  1,
  'one completed quiz creates one daily activity record'
);

select ok(
  (select completed_at is not null from public.quiz_sessions where id = '11111111-1111-4111-8111-111111111111'),
  'the final answer completes the quiz session'
);

select ok(
  not has_table_privilege('authenticated', 'public.daily_learning_records', 'INSERT'),
  'clients cannot create activity records directly'
);

set local role anon;
select throws_ok(
  $$select public.update_profile('x', 'Asia/Ho_Chi_Minh')$$,
  '42501',
  NULL,
  'anonymous profile update is denied'
);

select throws_ok(
  $$select public.get_learning_statistics()$$,
  '42501',
  'permission denied for function get_learning_statistics',
  'anonymous statistics access is denied'
);

select * from finish();
rollback;
