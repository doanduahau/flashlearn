-- Set and card management tests: rename, delete, add/edit/delete card, next
-- position assignment, ownership isolation and anonymous denial.
-- Runs mutations as low-privilege authenticated roles so RLS is exercised.

begin;

select plan(26);

-- fixtures ------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'manage.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'manage.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

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

-- rename --------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select lives_ok(
  'update public.flashcard_sets set name = ''Renamed A'' where id = ''11111111-1111-1111-1111-1111111111aa''',
  'owner can rename own set'
);
select is(
  (select name from public.flashcard_sets where id = '11111111-1111-1111-1111-1111111111aa'),
  'Renamed A',
  'rename persists'
);

update public.flashcard_sets set name = 'hacked' where id = '55555555-5555-5555-5555-5555555555aa';

reset role;

select is(
  (select name from public.flashcard_sets where id = '55555555-5555-5555-5555-5555555555aa'),
  'Set B',
  'user A cannot rename user B set'
);

-- add card via RPC ------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

create temporary table added as
select * from public.add_flashcard('11111111-1111-1111-1111-1111111111aa', '  New front  ', 'New back');

select is((select "position" from added), 2, 'added card receives max(position)+1');
select is(
  (select front from public.flashcards where id = (select flashcard_id from added)),
  'New front',
  'added card front is trimmed'
);
select is(
  (select user_id from public.flashcards where id = (select flashcard_id from added)),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'added card owner derives from auth.uid'
);
select is(
  (select count(*) from public.flashcards where set_id = '11111111-1111-1111-1111-1111111111aa'),
  3::bigint,
  'owner can read own added card'
);

create temporary table added2 as
select * from public.add_flashcard('11111111-1111-1111-1111-1111111111aa', 'Next', 'Next back');

select is((select "position" from added2), 3, 'repeated additions keep sequential positions');

select throws_ok(
  $$select * from public.add_flashcard('55555555-5555-5555-5555-5555555555aa', 'x', 'y')$$,
  '22023', NULL, 'user A cannot add a card into user B set'
);

select throws_ok(
  $$select * from public.add_flashcard('11111111-1111-1111-1111-1111111111aa', '   ', 'y')$$,
  '22023', NULL, 'blank front rejected'
);
select is(
  (select count(*) from public.flashcards where set_id = '11111111-1111-1111-1111-1111111111aa'),
  4::bigint,
  'failed add leaves data unchanged'
);

-- edit card -------------------------------------------------------------------

select lives_ok(
  'update public.flashcards set front = ''Edited'', back = ''Edited back'' where id = ''22222222-2222-2222-2222-2222222222aa''',
  'owner can edit own card'
);
select is(
  (select front from public.flashcards where id = '22222222-2222-2222-2222-2222222222aa'),
  'Edited',
  'card edit persists'
);

update public.flashcards set front = 'hacked' where id = '66666666-6666-6666-6666-6666666666aa';

reset role;

select is(
  (select front from public.flashcards where id = '66666666-6666-6666-6666-6666666666aa'),
  'B front',
  'user A cannot edit user B card'
);

-- delete card -------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

delete from public.flashcards where id = '22222222-2222-2222-2222-2222222222aa';

reset role;

select is(
  (select count(*) from public.flashcards where id = '22222222-2222-2222-2222-2222222222aa'),
  0::bigint,
  'owner can delete own card'
);
select is(
  (select count(*) from public.flashcards where set_id = '11111111-1111-1111-1111-1111111111aa'),
  3::bigint,
  'deleting one card removes only that card'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select is(
  (select array_agg(position order by position) from public.flashcards where set_id = '11111111-1111-1111-1111-1111111111aa'),
  array[1,2,3],
  'remaining cards keep relative order after deletion'
);

create temporary table added3 as
select * from public.add_flashcard('11111111-1111-1111-1111-1111111111aa', 'After delete', 'x');

select is((select "position" from added3), 4, 'new card after deletion gets max+1 with no reindexing');

delete from public.flashcards where id = '66666666-6666-6666-6666-6666666666aa';

reset role;

select is(
  (select count(*) from public.flashcards where id = '66666666-6666-6666-6666-6666666666aa'),
  1::bigint,
  'user A cannot delete user B card'
);

-- delete set (cascade) -----------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

delete from public.flashcard_sets where id = '11111111-1111-1111-1111-1111111111aa';

reset role;

select is(
  (select count(*) from public.flashcard_sets where id = '11111111-1111-1111-1111-1111111111aa'),
  0::bigint,
  'owner can delete own set'
);
select is(
  (select count(*) from public.flashcards where set_id = '11111111-1111-1111-1111-1111111111aa'),
  0::bigint,
  'deleting a set cascades to its cards'
);
select is(
  (select count(*) from public.flashcards where set_id = '55555555-5555-5555-5555-5555555555aa'),
  1::bigint,
  'deleting user A set leaves user B data intact'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

delete from public.flashcard_sets where id = '55555555-5555-5555-5555-5555555555aa';

reset role;

select is(
  (select count(*) from public.flashcard_sets where id = '55555555-5555-5555-5555-5555555555aa'),
  1::bigint,
  'user A cannot delete user B set'
);

-- anonymous denial ---------------------------------------------------------------

set local role anon;

select throws_ok(
  $$select * from public.add_flashcard('55555555-5555-5555-5555-5555555555aa', 'x', 'y')$$,
  '42501', NULL, 'anonymous add_flashcard denied'
);
select throws_ok(
  'update public.flashcard_sets set name = ''anon'' where id = ''55555555-5555-5555-5555-5555555555aa''',
  '42501', NULL, 'anonymous set mutation denied'
);

-- cross-user read isolation --------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

select is(
  (select count(*) from public.flashcard_sets where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'user B cannot read user A sets'
);

select * from finish();
rollback;
