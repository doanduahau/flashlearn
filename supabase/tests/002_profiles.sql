-- Profile trigger and profile ownership tests.

begin;

select plan(10);

-- fixtures ------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'authenticated', 'authenticated', 'profiles.a@example.com', now(),
  '{"provider":"email","providers":["email"]}', '{"display_name":"User A"}', now(), now()
);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'authenticated', 'authenticated', 'profiles.b@example.com', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'authenticated', 'authenticated', 'profiles.c@example.com', now(),
  '{"provider":"email","providers":["email"]}', '{"display_name":"   "}', now(), now()
);

-- trigger tests -------------------------------------------------------------

select is(
  (select display_name from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'User A',
  'profile is created with a validated display_name from user metadata'
);

select is(
  (select timezone from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'Asia/Ho_Chi_Minh',
  'profile defaults to Asia/Ho_Chi_Minh timezone'
);

select is(
  (select display_name from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  NULL,
  'profile display_name stays null when metadata has none'
);

select is(
  (select display_name from public.profiles where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  NULL,
  'profile display_name stays null when metadata display_name is blank'
);

-- updated_at trigger --------------------------------------------------------

update public.profiles
set updated_at = now() - interval '1 day'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

update public.profiles
set display_name = 'User A updated'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select ok(
  (select updated_at > now() - interval '1 hour' from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'updated_at is refreshed even when a manual update left it outdated'
);

-- ownership (as user A) -----------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select is(
  (select count(*) from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint,
  'A can read A''s own profile'
);

select is(
  (select count(*) from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0::bigint,
  'A cannot read B''s profile'
);

-- A tries to update B''s profile. Direct table UPDATE is revoked from
-- authenticated entirely (profile changes go through the scoped
-- update_profile RPC), so any direct update is denied.
select throws_ok(
  'update public.profiles set display_name = ''hacked'' where id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  '42501', NULL, 'authenticated cannot directly update a profile row'
);

reset role;

select is(
  (select display_name from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  NULL,
  'B''s profile is never touched by A''s attempts'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select throws_ok(
  'insert into public.profiles (id, display_name) values (''dddddddd-dddd-dddd-dddd-dddddddddddd'', ''ghost'')',
  '42501', NULL, 'A cannot insert an arbitrary profile for another Auth user'
);

select * from finish();
rollback;