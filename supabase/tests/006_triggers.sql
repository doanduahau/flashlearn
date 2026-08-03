-- Trigger tests: profile creation, updated_at refresh, safe search_path.

begin;

select plan(8);

-- fixtures ------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'authenticated', 'authenticated', 'triggers.a@example.com', now(),
  '{"provider":"email","providers":["email"]}', '{"display_name":"User A"}', now(), now()
);

insert into public.flashcard_sets (id, user_id, name)
values ('11111111-1111-1111-1111-1111111111aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Set A');

insert into public.flashcards (id, user_id, set_id, front, back)
values ('22222222-2222-2222-2222-2222222222aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-1111111111aa', 'front', 'back');

insert into public.special_collections (id, user_id, name)
values ('44444444-4444-4444-4444-4444444444aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Collection A');

-- profile creation ----------------------------------------------------------

select is(
  (select count(*) from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint,
  'a new Auth user receives exactly one profile'
);

-- function security ----------------------------------------------------------

select ok(
  (select prosecdef from pg_proc where proname = 'handle_new_user'),
  'handle_new_user is security definer'
);

select ok(
  (select proconfig[1] = 'search_path=""' from pg_proc where proname = 'set_updated_at'),
  'set_updated_at uses an empty, safe search_path'
);

select ok(
  (select proconfig[1] = 'search_path=""' from pg_proc where proname = 'handle_new_user'),
  'handle_new_user uses an empty, safe search_path'
);

-- updated_at refresh on every table -----------------------------------------

update public.profiles
set updated_at = now() - interval '1 day'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
update public.profiles
set display_name = 'User A updated'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select ok(
  (select updated_at > now() - interval '1 hour' from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'updated_at is refreshed on profiles'
);

update public.flashcard_sets
set updated_at = now() - interval '1 day'
where id = '11111111-1111-1111-1111-1111111111aa';
update public.flashcard_sets
set name = 'Set A renamed'
where id = '11111111-1111-1111-1111-1111111111aa';

select ok(
  (select updated_at > now() - interval '1 hour' from public.flashcard_sets where id = '11111111-1111-1111-1111-1111111111aa'),
  'updated_at is refreshed on flashcard_sets'
);

update public.flashcards
set updated_at = now() - interval '1 day'
where id = '22222222-2222-2222-2222-2222222222aa';
update public.flashcards
set back = 'back updated'
where id = '22222222-2222-2222-2222-2222222222aa';

select ok(
  (select updated_at > now() - interval '1 hour' from public.flashcards where id = '22222222-2222-2222-2222-2222222222aa'),
  'updated_at is refreshed on flashcards'
);

update public.special_collections
set updated_at = now() - interval '1 day'
where id = '44444444-4444-4444-4444-4444444444aa';
update public.special_collections
set icon = 'star'
where id = '44444444-4444-4444-4444-4444444444aa';

select ok(
  (select updated_at > now() - interval '1 hour' from public.special_collections where id = '44444444-4444-4444-4444-4444444444aa'),
  'updated_at is refreshed on special_collections'
);

select * from finish();
rollback;