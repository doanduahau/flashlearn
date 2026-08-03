-- Constraint tests for the core FlashLearn tables.
-- Runs as postgres (superuser) so only table constraints are exercised.

begin;

select plan(11);

-- fixtures ------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'authenticated', 'authenticated', 'constraints.a@example.com', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

insert into public.flashcard_sets (id, user_id, name)
values ('11111111-1111-1111-1111-1111111111aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Set A');

insert into public.flashcards (id, user_id, set_id, front, back)
values ('22222222-2222-2222-2222-2222222222aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-1111111111aa', 'front 1', 'back 1');
insert into public.flashcards (id, user_id, set_id, front, back)
values ('33333333-3333-3333-3333-3333333333aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-1111111111aa', 'front 2', 'back 2');

insert into public.special_collections (id, user_id, name)
values ('44444444-4444-4444-4444-4444444444aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Favorites');

-- a base membership so the duplicate test has something to collide with
insert into public.special_collection_items (user_id, collection_id, flashcard_id)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-4444444444aa', '22222222-2222-2222-2222-2222222222aa');

-- tests ---------------------------------------------------------------------

select throws_ok(
  'insert into public.flashcard_sets (user_id, name) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''   '')',
  '23514', NULL, 'blank set name is rejected'
);

select throws_ok(
  'insert into public.flashcard_sets (user_id, name) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', repeat(''x'', 121))',
  '23514', NULL, 'overlong set name is rejected'
);

select throws_ok(
  'insert into public.flashcards (user_id, set_id, front, back) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''11111111-1111-1111-1111-1111111111aa'', ''   '', ''back'')',
  '23514', NULL, 'blank flashcard front is rejected'
);

select throws_ok(
  'insert into public.flashcards (user_id, set_id, front, back) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''11111111-1111-1111-1111-1111111111aa'', ''front'', ''   '')',
  '23514', NULL, 'blank flashcard back is rejected'
);

select throws_ok(
  'insert into public.flashcards (user_id, set_id, front, back, position) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''11111111-1111-1111-1111-1111111111aa'', ''front'', ''back'', -1)',
  '23514', NULL, 'negative flashcard position is rejected'
);

select throws_ok(
  'insert into public.special_collection_items (user_id, collection_id, flashcard_id) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''44444444-4444-4444-4444-4444444444aa'', ''22222222-2222-2222-2222-2222222222aa'')',
  '23505', NULL, 'duplicate special collection membership is rejected'
);

select throws_ok(
  'insert into public.special_collections (user_id, name) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''Favorites'')',
  '23505', NULL, 'duplicate special collection name for one user is rejected'
);

select throws_ok(
  'insert into public.special_collections (user_id, name) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''favorites'')',
  '23505', NULL, 'case-insensitive duplicate collection name is rejected'
);

select throws_ok(
  'insert into public.special_collections (user_id, name) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''   '')',
  '23514', NULL, 'blank special collection name is rejected'
);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'authenticated', 'authenticated', 'constraints.b@example.com', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

select lives_ok(
  'insert into public.special_collections (user_id, name) values (''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', ''favorites'')',
  'same collection name for a different user is allowed'
);

select lives_ok(
  'insert into public.special_collection_items (user_id, collection_id, flashcard_id) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''44444444-4444-4444-4444-4444444444aa'', ''33333333-3333-3333-3333-3333333333aa'')',
  'a valid special collection membership is allowed'
);

select * from finish();
rollback;