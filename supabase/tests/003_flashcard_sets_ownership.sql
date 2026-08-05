-- Flashcard set and flashcard ownership tests, running as an authenticated user.

begin;

select plan(17);

-- fixtures ------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'authenticated', 'authenticated', 'sets.a@example.com', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'authenticated', 'authenticated', 'sets.b@example.com', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

insert into public.flashcard_sets (id, user_id, name)
values ('11111111-1111-1111-1111-1111111111aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Set A');
insert into public.flashcard_sets (id, user_id, name)
values ('55555555-5555-5555-5555-5555555555aa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Set B');

insert into public.flashcards (id, user_id, set_id, front, back)
values ('22222222-2222-2222-2222-2222222222aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-1111111111aa', 'A front', 'A back');
insert into public.flashcards (id, user_id, set_id, front, back)
values ('66666666-6666-6666-6666-6666666666aa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-5555555555aa', 'B front', 'B back');

-- ownership (as user A) -----------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select is(
  (select count(*) from public.flashcard_sets where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint,
  'A can read A''s own set'
);

select is(
  (select count(*) from public.flashcard_sets where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0::bigint,
  'A cannot read B''s set'
);

-- A tries to update B''s set; RLS filters the row so nothing changes.
update public.flashcard_sets
set name = 'hacked'
where id = '55555555-5555-5555-5555-5555555555aa';

reset role;

select is(
  (select name from public.flashcard_sets where id = '55555555-5555-5555-5555-5555555555aa'),
  'Set B',
  'A cannot update B''s set'
);

-- A tries to delete B''s set; RLS filters the row so it still exists.
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

delete from public.flashcard_sets where id = '55555555-5555-5555-5555-5555555555aa';

reset role;

select is(
  (select count(*) from public.flashcard_sets where id = '55555555-5555-5555-5555-5555555555aa'),
  1::bigint,
  'A cannot delete B''s set'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select throws_ok(
  'insert into public.flashcard_sets (user_id, name) values (''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', ''Set B2'')',
  '42501', NULL, 'A cannot create a set owned by B'
);

select throws_ok(
  'insert into public.flashcard_sets (user_id, name) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''Set A2'')',
  '42501', NULL, 'direct set creation is reserved for the import RPC'
);

select throws_ok(
  'insert into public.flashcards (user_id, set_id, front, back) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''55555555-5555-5555-5555-5555555555aa'', ''x'',''y'')',
  '42501', NULL, 'A cannot add a flashcard into B''s set'
);

select throws_ok(
  'insert into public.flashcards (user_id, set_id, front, back) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''11111111-1111-1111-1111-1111111111aa'', ''A2 front'',''A2 back'')',
  '42501', NULL, 'direct card creation is reserved for add_flashcard'
);

-- Database-level enforcement: even bypassing RLS, a flashcard cannot reference
-- a set owned by a different user. The composite FK rejects it.
reset role;

select throws_ok(
  'insert into public.flashcards (user_id, set_id, front, back) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''55555555-5555-5555-5555-5555555555aa'', ''F'', ''L'')',
  '23503', NULL, 'a flashcard cannot reference a set owned by another user (composite FK)'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select lives_ok(
  'update public.flashcards set back = ''updated back'' where id = ''22222222-2222-2222-2222-2222222222aa''',
  'A can update A''s own flashcard'
);

select throws_ok(
  'update public.flashcards set position = 99 where id = ''22222222-2222-2222-2222-2222222222aa''',
  '42501', NULL, 'A cannot choose a flashcard position'
);

select throws_ok(
  'update public.flashcards set set_id = ''55555555-5555-5555-5555-5555555555aa'' where id = ''22222222-2222-2222-2222-2222222222aa''',
  '42501', NULL, 'A cannot move a flashcard by supplying a set id'
);

select throws_ok(
  'update public.flashcards set user_id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'' where id = ''22222222-2222-2222-2222-2222222222aa''',
  '42501', NULL, 'A cannot supply a flashcard owner'
);

select throws_ok(
  'update public.flashcard_sets set user_id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'' where id = ''11111111-1111-1111-1111-1111111111aa''',
  '42501', NULL, 'A cannot supply a set owner'
);

select is(
  (select count(*) from public.flashcards where set_id = '55555555-5555-5555-5555-5555555555aa'),
  0::bigint,
  'A cannot read B''s flashcards'
);

select is(
  (select count(*) from public.flashcards where set_id = '11111111-1111-1111-1111-1111111111aa' and user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint,
  'A can read A''s own flashcards'
);

-- A tries to delete B''s flashcard; RLS filters the row so it still exists.
delete from public.flashcards where id = '66666666-6666-6666-6666-6666666666aa';

reset role;

select is(
  (select count(*) from public.flashcards where id = '66666666-6666-6666-6666-6666666666aa'),
  1::bigint,
  'A cannot delete B''s flashcard'
);

select * from finish();
rollback;
