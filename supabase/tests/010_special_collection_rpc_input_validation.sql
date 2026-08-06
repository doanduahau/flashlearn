-- Direct RPC callers cannot bypass collection membership input validation.

begin;

select plan(14);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'membership.input.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'membership.input.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.flashcard_sets (id, user_id, name)
values
  ('11111111-1111-1111-1111-1111111111aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Set A'),
  ('55555555-5555-5555-5555-5555555555aa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Set B');

insert into public.flashcards (id, user_id, set_id, front, back, position)
values ('22222222-2222-2222-2222-2222222222aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-1111111111aa', 'A front', 'A back', 0);

insert into public.special_collections (id, user_id, name)
values
  ('33333333-3333-3333-3333-3333333333aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Collection A'),
  ('44444444-4444-4444-4444-4444444444aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Collection B'),
  ('88888888-8888-8888-8888-8888888888bb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Foreign collection');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select lives_ok(
  $$select public.set_card_collections('22222222-2222-2222-2222-2222222222aa', array['33333333-3333-3333-3333-3333333333aa', '44444444-4444-4444-4444-4444444444aa']::uuid[])$$,
  'valid membership sync succeeds'
);
select is(
  (select count(*) from public.special_collection_items where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  2::bigint,
  'valid sync creates two memberships'
);

select throws_ok(
  $$select public.set_card_collections('22222222-2222-2222-2222-2222222222aa', null::uuid[])$$,
  '22023', 'invalid collection ids', 'null collection array is rejected'
);
select is(
  (select count(*) from public.special_collection_items where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  2::bigint,
  'null collection array leaves memberships unchanged'
);

select throws_ok(
  $$select public.set_card_collections('22222222-2222-2222-2222-2222222222aa', array[null]::uuid[])$$,
  '22023', 'invalid collection ids', 'null collection id is rejected'
);
select is(
  (select count(*) from public.special_collection_items where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  2::bigint,
  'null collection id leaves memberships unchanged'
);

select throws_ok(
  $$select public.set_card_collections('22222222-2222-2222-2222-2222222222aa', array_fill('33333333-3333-3333-3333-3333333333aa'::uuid, array[51]))$$,
  '22023', 'invalid collection ids', 'more than fifty collection ids is rejected'
);
select is(
  (select count(*) from public.special_collection_items where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  2::bigint,
  'oversized collection array leaves memberships unchanged'
);

select lives_ok(
  $$select public.set_card_collections('22222222-2222-2222-2222-2222222222aa', array['33333333-3333-3333-3333-3333333333aa', '33333333-3333-3333-3333-3333333333aa']::uuid[])$$,
  'repeated collection ids are idempotent'
);
select is(
  (select count(*) from public.special_collection_items where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  1::bigint,
  'repeated collection ids produce one membership'
);

select throws_ok(
  $$select public.set_card_collections('22222222-2222-2222-2222-2222222222aa', array['00000000-0000-0000-0000-000000000001']::uuid[])$$,
  '22023', 'collection not found', 'nonexistent collection id is rejected'
);
select is(
  (select count(*) from public.special_collection_items where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  1::bigint,
  'nonexistent collection id leaves memberships unchanged'
);

select throws_ok(
  $$select public.set_card_collections('22222222-2222-2222-2222-2222222222aa', array['88888888-8888-8888-8888-8888888888bb']::uuid[])$$,
  '22023', 'collection not found', 'foreign collection id has the same error as a nonexistent id'
);
select is(
  (select count(*) from public.special_collection_items where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  1::bigint,
  'foreign collection id leaves memberships unchanged'
);

select * from finish();
rollback;
