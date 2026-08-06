-- Profile settings: scoped update_profile RPC, grants and statistics timezone.
-- Covers:
--   - owner can update own allowed fields via the RPC
--   - anonymous updates denied
--   - User A cannot touch User B's profile
--   - protected columns cannot be modified (direct UPDATE revoked)
--   - invalid timezone rejected, valid +/- offset timezones accepted
--   - updated timezone changes statistics local-day grouping
--   - failed updates leave the profile unchanged

begin;

select plan(23);

-- fixtures ------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'authenticated', 'authenticated', 'settings.a@example.com', now(),
  '{"provider":"email","providers":["email"]}', '{"display_name":"User A"}', now(), now()
);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'authenticated', 'authenticated', 'settings.b@example.com', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

-- a completed quiz at a fixed UTC instant so timezone grouping is deterministic:
-- 2026-08-05T17:30:00Z = 2026-08-06 00:30 in Asia/Ho_Chi_Minh (UTC+7)
--                      = 2026-08-05 06:30 in Pacific/Pago_Pago (UTC-11)
insert into public.quiz_sessions (id, user_id, mode, requested_question_count, actual_question_count, source_set_ids, source_collection_ids, source_all, started_at, completed_at, correct_answer_count)
values (
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'balanced', 10, 10, '{}', '{}', false,
  '2026-08-05T16:30:00Z', '2026-08-05T17:30:00Z', 8
);

-- owner can update own allowed fields ---------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select is(
  (public.update_profile('User A mới', 'Asia/Ho_Chi_Minh')).display_name,
  'User A mới',
  'owner can update own display name'
);

select is(
  (public.update_profile('   ', 'Asia/Ho_Chi_Minh')).display_name,
  NULL,
  'blank display name is normalized to null'
);

select is(
  (public.update_profile('Nguyễn Văn A — 中文', 'Asia/Ho_Chi_Minh')).display_name,
  'Nguyễn Văn A — 中文',
  'unicode display name is preserved'
);

select throws_ok(
  $$select public.update_profile(repeat('x', 101), 'Asia/Ho_Chi_Minh')$$,
  '22023', NULL, 'display name over 100 chars is rejected'
);

-- timezone validation --------------------------------------------------------

select throws_ok(
  $$select public.update_profile('User A', 'Mars/Olympus')$$,
  '22023', NULL, 'invalid timezone is rejected'
);

select throws_ok(
  $$select public.update_profile('User A', NULL)$$,
  '22023', NULL, 'null timezone is rejected'
);

select throws_ok(
  $$select public.update_profile('User A', repeat('z', 65))$$,
  '22023', NULL, 'overlong timezone is rejected'
);

select is(
  (public.update_profile('User A', 'Pacific/Kiritimati')).timezone,
  'Pacific/Kiritimati',
  'UTC+14 timezone is accepted'
);

select is(
  (public.update_profile('User A', 'Pacific/Pago_Pago')).timezone,
  'Pacific/Pago_Pago',
  'UTC-11 timezone is accepted'
);

-- anonymous denied -----------------------------------------------------------

set local role anon;

select throws_ok(
  $$select public.update_profile('x', 'Asia/Ho_Chi_Minh')$$,
  '42501', NULL, 'anonymous update is denied'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- User A cannot touch User B -------------------------------------------------

select is(
  (public.update_profile('A mới', 'America/New_York')).display_name,
  'A mới',
  'A updates own profile'
);

reset role;

select is(
  (select timezone from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'Asia/Ho_Chi_Minh',
  'B timezone is untouched by A updates'
);

select is(
  (select display_name from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  NULL,
  'B display_name is untouched by A updates'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- protected columns cannot be modified ----------------------------------------

select throws_ok(
  'update public.profiles set avatar_url = ''x'' where id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  '42501', NULL, 'avatar_url cannot be updated directly'
);

select throws_ok(
  'update public.profiles set created_at = now() where id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  '42501', NULL, 'created_at cannot be updated directly'
);

select is(
  (select avatar_url from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  NULL,
  'avatar_url is untouched by the RPC'
);

select is(
  (select id from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'id is untouched by the RPC'
);

-- failed updates leave the profile unchanged ----------------------------------

select (public.update_profile('Giữ nguyên', 'Asia/Ho_Chi_Minh'));

select throws_ok(
  $$select public.update_profile('x', 'Mars/Olympus')$$,
  '22023', NULL, 'failed update raises'
);

select is(
  (select display_name from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'Giữ nguyên',
  'display_name unchanged after a failed update'
);

select is(
  (select timezone from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'Asia/Ho_Chi_Minh',
  'timezone unchanged after a failed update'
);

-- updated timezone affects statistics local-day grouping ----------------------

select (public.update_profile('User A', 'Pacific/Pago_Pago'));

select is(
  (select get_learning_statistics() ->> 'last_active_date'),
  '2026-08-05',
  'statistics group the quiz on Pacific/Pago_Pago local day (UTC-11)'
);

select (public.update_profile('User A', 'Asia/Ho_Chi_Minh'));

select is(
  (select get_learning_statistics() ->> 'last_active_date'),
  '2026-08-06',
  'statistics group the quiz on Asia/Ho_Chi_Minh local day (UTC+7)'
);

select is(
  (select get_learning_statistics() ->> 'timezone'),
  'Asia/Ho_Chi_Minh',
  'statistics report the profile timezone'
);

select * from finish();
rollback;
