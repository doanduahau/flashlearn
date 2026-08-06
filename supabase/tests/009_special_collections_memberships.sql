-- Special collection management tests: create/rename/delete collection via the
-- hardened grants + RPCs, idempotent membership sync (set_card_collections),
-- case-insensitive duplicate names, ownership isolation and anonymous denial.
-- Mutations run as low-privilege authenticated roles so RLS is exercised.

begin;

select plan(35);

-- fixtures ------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'coll.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'coll.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.flashcard_sets (id, user_id, name)
values ('11111111-1111-1111-1111-1111111111aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Set A');
insert into public.flashcard_sets (id, user_id, name)
values ('55555555-5555-5555-5555-5555555555aa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Set B');

insert into public.flashcards (id, user_id, set_id, front, back, position)
values ('22222222-2222-2222-2222-2222222222aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-1111111111aa', 'A front 1', 'A back 1', 0);
insert into public.flashcards (id, user_id, set_id, front, back, position)
values ('33333333-3333-3333-3333-3333333333aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-1111111111aa', 'A front 2', 'A back 2', 1);
insert into public.flashcards (id, user_id, set_id, front, back, position)
values ('66666666-6666-6666-6666-6666666666aa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-5555555555aa', 'B front', 'B back', 0);

-- user B collection used to prove cross-user protection.
insert into public.special_collections (id, user_id, name)
values ('88888888-8888-8888-8888-8888888888bb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B Collection');

-- user B membership used to prove cross-user membership protection.
insert into public.special_collection_items (user_id, collection_id, flashcard_id)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '88888888-8888-8888-8888-8888888888bb', '66666666-6666-6666-6666-6666666666aa');

-- create collection -----------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

create temporary table created_coll as
select public.create_special_collection('  Khó nhớ  ') as id;

select is(
  (select id from created_coll) is not null,
  true,
  'create_special_collection returns a collection id'
);

select is(
  (select name from public.special_collections where id = (select id from created_coll)),
  'Khó nhớ',
  'collection name is trimmed'
);
select is(
  (select user_id from public.special_collections where id = (select id from created_coll)),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'collection owner derives from auth.uid'
);

create temporary table created_coll2 as
select public.create_special_collection('Quan trọng') as id;

select is(
  (select count(*) from public.special_collections where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  2::bigint,
  'owner can create multiple collections'
);

select throws_ok(
  $$select public.create_special_collection('khó NHỚ')$$,
  '23505', NULL, 'duplicate collection name is rejected case-insensitively'
);

select throws_ok(
  $$select public.create_special_collection('   ')$$,
  '22023', NULL, 'blank collection name rejected'
);

select throws_ok(
  $$select public.create_special_collection(repeat('a', 61))$$,
  '22023', NULL, 'collection name over 60 chars rejected'
);

select throws_ok(
  $$select public.create_special_collection('OK', repeat('i', 33))$$,
  '22023', NULL, 'collection icon over 32 chars rejected'
);

-- set_card_collections -----------------------------------------------------------

select lives_ok(
  format('select public.set_card_collections(''22222222-2222-2222-2222-2222222222aa'', array[%L, %L]::uuid[])',
    (select id from created_coll), (select id from created_coll2)),
  'owner can add a card to multiple collections'
);
select is(
  (select count(*) from public.special_collection_items where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  2::bigint,
  'card added to both selected collections'
);

select lives_ok(
  format('select public.set_card_collections(''22222222-2222-2222-2222-2222222222aa'', array[%L, %L]::uuid[])',
    (select id from created_coll), (select id from created_coll2)),
  'repeated sync is idempotent'
);
select is(
  (select count(*) from public.special_collection_items where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  2::bigint,
  'repeated submission does not duplicate memberships'
);

select lives_ok(
  format('select public.set_card_collections(''22222222-2222-2222-2222-2222222222aa'', array[%L, ''88888888-8888-8888-8888-8888888888bb'']::uuid[])',
    (select id from created_coll)),
  'sync with a foreign collection id succeeds'
);
select is(
  (select count(*) from public.special_collection_items where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  1::bigint,
  'foreign collection id is silently ignored'
);
select is(
  (select collection_id from public.special_collection_items where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  (select id from created_coll),
  'removing a collection from the list drops its membership'
);

select lives_ok(
  $$select public.set_card_collections('22222222-2222-2222-2222-2222222222aa', array[]::uuid[])$$,
  'empty collection list removes all memberships'
);
select is(
  (select count(*) from public.special_collection_items where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  0::bigint,
  'no memberships remain after empty sync'
);

select throws_ok(
  $$select public.set_card_collections('66666666-6666-6666-6666-6666666666aa', array['88888888-8888-8888-8888-8888888888bb']::uuid[])$$,
  '22023', NULL, 'user A cannot add a card owned by user B'
);

select throws_ok(
  $$select public.set_card_collections('00000000-0000-0000-0000-000000000001', array[]::uuid[])$$,
  '22023', NULL, 'non-existent card is reported the same way as a foreign one'
);

-- rename ------------------------------------------------------------------------

select lives_ok(
  format('update public.special_collections set name = ''Khó nhớ đổi'' where id = %L', (select id from created_coll)),
  'owner can rename own collection'
);
select is(
  (select name from public.special_collections where id = (select id from created_coll)),
  'Khó nhớ đổi',
  'collection rename persists'
);

select throws_ok(
  format('update public.special_collections set name = ''Khó nhớ đổi'' where id = %L', (select id from created_coll2)),
  '23505', NULL, 'renaming to a duplicate name is rejected'
);

update public.special_collections set name = 'hacked' where id = '88888888-8888-8888-8888-8888888888bb';

reset role;

select is(
  (select name from public.special_collections where id = '88888888-8888-8888-8888-8888888888bb'),
  'B Collection',
  'user A cannot rename user B collection'
);

-- remove membership (direct delete via RLS) --------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select lives_ok(
  format('select public.set_card_collections(''22222222-2222-2222-2222-2222222222aa'', array[%L]::uuid[])', (select id from created_coll)),
  're-add a membership for the removal test'
);

delete from public.special_collection_items
where collection_id = (select id from created_coll) and flashcard_id = '22222222-2222-2222-2222-2222222222aa';

select is(
  (select count(*) from public.special_collection_items where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  0::bigint,
  'owner can remove a card from a collection'
);

delete from public.special_collection_items where collection_id = '88888888-8888-8888-8888-8888888888bb';

reset role;

select is(
  (select count(*) from public.special_collection_items where collection_id = '88888888-8888-8888-8888-8888888888bb'),
  1::bigint,
  'user A cannot delete user B membership'
);

-- delete collection (cascade) ------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

delete from public.special_collections where id = '88888888-8888-8888-8888-8888888888bb';

reset role;

select is(
  (select count(*) from public.special_collections where id = '88888888-8888-8888-8888-8888888888bb'),
  1::bigint,
  'user A cannot delete user B collection'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

delete from public.special_collections where id = (select id from created_coll2);

reset role;

select is(
  (select count(*) from public.special_collections where id = (select id from created_coll2)),
  0::bigint,
  'owner can delete own collection'
);

-- anonymous denial ---------------------------------------------------------------

set local role anon;

select throws_ok(
  $$select public.create_special_collection('Anon')$$,
  '42501', NULL, 'anonymous create_special_collection denied'
);
select throws_ok(
  $$select public.set_card_collections('22222222-2222-2222-2222-2222222222aa', array[]::uuid[])$$,
  '42501', NULL, 'anonymous set_card_collections denied'
);
select throws_ok(
  'update public.special_collections set name = ''anon''',
  '42501', NULL, 'anonymous collection rename denied'
);
select throws_ok(
  'delete from public.special_collections',
  '42501', NULL, 'anonymous collection delete denied'
);

-- cross-user read isolation --------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

select is(
  (select count(*) from public.special_collections where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'user B cannot read user A collections'
);
select is(
  (select count(*) from public.special_collection_items where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'user B cannot read user A memberships'
);
select is(
  (select count(*) from public.special_collection_items where collection_id = (select id from created_coll)),
  0::bigint,
  'user B cannot read memberships through user A collection'
);

select * from finish();
rollback;
