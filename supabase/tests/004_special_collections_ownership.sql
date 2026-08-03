-- Special collection and special collection item ownership tests.

begin;

select plan(12);

-- fixtures ------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'authenticated', 'authenticated', 'collections.a@example.com', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'authenticated', 'authenticated', 'collections.b@example.com', now(),
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

insert into public.special_collections (id, user_id, name)
values ('44444444-4444-4444-4444-4444444444aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Collection A');
insert into public.special_collections (id, user_id, name)
values ('77777777-7777-7777-7777-7777777777aa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Collection B');

-- ownership tests (as user A) ----------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select is(
  (select count(*) from public.special_collections where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint,
  'A can read A''s own collection'
);

select is(
  (select count(*) from public.special_collections where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0::bigint,
  'A cannot read B''s collection'
);

-- A tries to update B''s collection; RLS filters the row so nothing changes.
update public.special_collections
set name = 'hacked'
where id = '77777777-7777-7777-7777-7777777777aa';

reset role;

select is(
  (select name from public.special_collections where id = '77777777-7777-7777-7777-7777777777aa'),
  'Collection B',
  'A cannot update B''s collection'
);

-- A tries to delete B''s collection; RLS filters the row so it still exists.
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

delete from public.special_collections where id = '77777777-7777-7777-7777-7777777777aa';

reset role;

select is(
  (select count(*) from public.special_collections where id = '77777777-7777-7777-7777-7777777777aa'),
  1::bigint,
  'A cannot delete B''s collection'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select throws_ok(
  'insert into public.special_collections (user_id, name) values (''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', ''Coll B2'')',
  '42501', NULL, 'A cannot create a collection owned by B'
);

select lives_ok(
  'insert into public.special_collection_items (user_id, collection_id, flashcard_id) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''44444444-4444-4444-4444-4444444444aa'', ''22222222-2222-2222-2222-2222222222aa'')',
  'A can add A''s flashcard to A''s collection'
);

select throws_ok(
  'insert into public.special_collection_items (user_id, collection_id, flashcard_id) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''44444444-4444-4444-4444-4444444444aa'', ''66666666-6666-6666-6666-6666666666aa'')',
  '42501', NULL, 'A cannot add B''s flashcard to A''s collection'
);

select throws_ok(
  'insert into public.special_collection_items (user_id, collection_id, flashcard_id) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''77777777-7777-7777-7777-7777777777aa'', ''22222222-2222-2222-2222-2222222222aa'')',
  '42501', NULL, 'A cannot add A''s flashcard to B''s collection'
);

select throws_ok(
  'insert into public.special_collection_items (user_id, collection_id, flashcard_id) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''44444444-4444-4444-4444-4444444444aa'', ''22222222-2222-2222-2222-2222222222aa'')',
  '23505', NULL, 'duplicate membership in a collection is rejected'
);

select is(
  (select count(*) from public.special_collection_items where collection_id = '44444444-4444-4444-4444-4444444444aa'),
  1::bigint,
  'A can read the memberships of A''s own collection'
);

select is(
  (select count(*) from public.special_collection_items where collection_id = '77777777-7777-7777-7777-7777777777aa'),
  0::bigint,
  'A cannot read the memberships of B''s collection'
);

-- database-level enforcement (as postgres, bypassing RLS) -------------------

reset role;

select throws_ok(
  'insert into public.special_collection_items (user_id, collection_id, flashcard_id) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''44444444-4444-4444-4444-4444444444aa'', ''66666666-6666-6666-6666-6666666666aa'')',
  '23503', NULL, 'cross-user membership is impossible at the database level (composite FK)'
);

select * from finish();
rollback;