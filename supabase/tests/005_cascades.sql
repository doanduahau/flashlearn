-- Cascade behavior tests. Runs as postgres.

begin;

select plan(10);

-- fixtures ------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'authenticated', 'authenticated', 'cascades.a@example.com', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

insert into public.flashcard_sets (id, user_id, name)
values ('11111111-1111-1111-1111-1111111111aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Set A');

insert into public.flashcards (id, user_id, set_id, front, back)
values ('22222222-2222-2222-2222-2222222222aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-1111111111aa', 'front 1', 'back 1');
insert into public.flashcards (id, user_id, set_id, front, back)
values ('33333333-3333-3333-3333-3333333333aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-1111111111aa', 'front 2', 'back 2');

insert into public.special_collections (id, user_id, name)
values ('44444444-4444-4444-4444-4444444444aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Collection A');

insert into public.special_collection_items (user_id, collection_id, flashcard_id)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-4444444444aa', '22222222-2222-2222-2222-2222222222aa');
insert into public.special_collection_items (user_id, collection_id, flashcard_id)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-4444444444aa', '33333333-3333-3333-3333-3333333333aa');

-- deleting a flashcard removes its memberships ------------------------------

delete from public.flashcards where id = '22222222-2222-2222-2222-2222222222aa';

select is(
  (select count(*) from public.special_collection_items where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  0::bigint,
  'deleting a flashcard removes its special collection memberships'
);

select is(
  (select count(*) from public.special_collection_items where flashcard_id = '33333333-3333-3333-3333-3333333333aa'),
  1::bigint,
  'deleting one flashcard does not affect other memberships'
);

-- deleting a collection removes its memberships ------------------------------

delete from public.special_collections where id = '44444444-4444-4444-4444-4444444444aa';

select is(
  (select count(*) from public.special_collection_items where collection_id = '44444444-4444-4444-4444-4444444444aa'),
  0::bigint,
  'deleting a collection removes its memberships'
);

-- deleting a set removes its flashcards and their memberships ----------------

delete from public.flashcard_sets where id = '11111111-1111-1111-1111-1111111111aa';

select is(
  (select count(*) from public.flashcards where set_id = '11111111-1111-1111-1111-1111111111aa'),
  0::bigint,
  'deleting a set removes its flashcards'
);

select is(
  (select count(*) from public.special_collection_items where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'deleting a set removes memberships that referenced its flashcards'
);

-- deleting an Auth user removes all owned core data --------------------------

delete from auth.users where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select is(
  (select count(*) from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'deleting an Auth user removes the profile'
);

select is(
  (select count(*) from public.flashcard_sets where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'deleting an Auth user removes flashcard sets'
);

select is(
  (select count(*) from public.flashcards where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'deleting an Auth user removes flashcards'
);

select is(
  (select count(*) from public.special_collections where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'deleting an Auth user removes special collections'
);

select is(
  (select count(*) from public.special_collection_items where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'deleting an Auth user removes collection memberships'
);

select * from finish();
rollback;