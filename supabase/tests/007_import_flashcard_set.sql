begin;

select plan(12);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'authenticated', 'authenticated', 'import.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'authenticated', 'authenticated', 'import.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

create temporary table imported as
select * from public.import_flashcard_set('  Vietnamese  ', '[{"front":"Xin chào","back":"Hello"},{"front":"Cảm ơn","back":"Thanks"}]'::jsonb);

select is((select imported_count from imported), 2, 'valid authenticated import returns count');
select is((select user_id from public.flashcard_sets where id = (select set_id from imported)), 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'owner comes from auth.uid');
select is((select count(*) from public.flashcards where set_id = (select set_id from imported)), 2::bigint, 'creates both cards');
select is((select array_agg(position order by position) from public.flashcards where set_id = (select set_id from imported)), array[0,1], 'positions start at zero deterministically');
select is((select count(*) from public.flashcards where set_id = (select set_id from imported) and user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'), 2::bigint, 'cards share caller owner');

select throws_ok($$select * from public.import_flashcard_set(' ', '[{"front":"a","back":"b"}]')$$, '22023', NULL, 'blank name rejected');
select throws_ok($$select * from public.import_flashcard_set('Bad', '[{"front":"","back":"b"}]')$$, '22023', NULL, 'blank card field rejected');
select throws_ok($$select * from public.import_flashcard_set('Too many', (select jsonb_agg(jsonb_build_object('front', i::text, 'back', i::text)) from generate_series(1,2001) i))$$, '22023', NULL, 'more than 2000 cards rejected');
select is((select count(*) from public.flashcard_sets where name = 'Bad'), 0::bigint, 'invalid card rolls back set');

set local request.jwt.claim.sub = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is((select count(*) from public.flashcard_sets where id = (select set_id from imported)), 0::bigint, 'user B cannot read user A imported set');

reset role;
set local role anon;
select throws_ok($$select * from public.import_flashcard_set('Anon', '[{"front":"a","back":"b"}]')$$, '42501', NULL, 'anon cannot execute RPC');

reset role;
select is((select count(*) from public.flashcard_sets where id = (select set_id from imported)), 1::bigint, 'returned set id belongs to caller');

select * from finish();
rollback;
