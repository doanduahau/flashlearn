begin;

select plan(15);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'a1111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'order.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b1111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'order.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.flashcard_sets (id, user_id, name, sort_order)
values
  ('a0000000-0000-0000-0000-000000000001', 'a1111111-1111-1111-1111-111111111111', 'A one', 1024),
  ('a0000000-0000-0000-0000-000000000002', 'a1111111-1111-1111-1111-111111111111', 'A two', 2048),
  ('a0000000-0000-0000-0000-000000000003', 'a1111111-1111-1111-1111-111111111111', 'A three', 3072),
  ('b0000000-0000-0000-0000-000000000001', 'b1111111-1111-1111-1111-111111111111', 'B one', 1024);

set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';

select is((select array_agg(name order by sort_order asc, id asc) from public.flashcard_sets), array['A one', 'A two', 'A three'], 'owned sets use persisted custom order');
select lives_ok($$select public.move_flashcard_set('a0000000-0000-0000-0000-000000000002', 'up')$$, 'owner can move a set up');
select is((select array_agg(name order by sort_order asc, id asc) from public.flashcard_sets), array['A two', 'A one', 'A three'], 'moving up swaps only the adjacent display position');
select lives_ok($$select public.move_flashcard_set('a0000000-0000-0000-0000-000000000002', 'down')$$, 'owner can move a set down');
select is((select array_agg(name order by sort_order asc, id asc) from public.flashcard_sets), array['A one', 'A two', 'A three'], 'moving down restores the persisted order');
select lives_ok($$select public.move_flashcard_set('a0000000-0000-0000-0000-000000000001', 'up')$$, 'moving the first set up is a no-op');
select is((select array_agg(name order by sort_order asc, id asc) from public.flashcard_sets), array['A one', 'A two', 'A three'], 'first-set no-op preserves order');
select throws_ok($$select public.move_flashcard_set('a0000000-0000-0000-0000-000000000001', 'sideways')$$, '22023', NULL, 'invalid move direction is rejected');
select throws_ok($$select public.move_flashcard_set('b0000000-0000-0000-0000-000000000001', 'up')$$, '22023', NULL, 'owner cannot reorder another user''s set');
select throws_ok($$update public.flashcard_sets set sort_order = -100 where id = 'a0000000-0000-0000-0000-000000000001'$$, '42501', NULL, 'direct set rank updates are denied');

reset role;
select is((select sort_order from public.flashcard_sets where id = 'b0000000-0000-0000-0000-000000000001'), 1024::bigint, 'failed cross-user move leaves the other user order unchanged');

set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
delete from public.flashcard_sets where id = 'a0000000-0000-0000-0000-000000000001';
select is((select array_agg(name order by sort_order asc, id asc) from public.flashcard_sets), array['A two', 'A three'], 'deleting a set leaves the remaining custom order intact');

create temporary table imported as select * from public.commit_flashcard_import('New imported', '[{"front":"front","back":"back"}]'::jsonb,'71000000-0000-4000-8000-000000000001','manual',0,0,false);
select is((select array_agg(name order by sort_order asc, id asc) from public.flashcard_sets), array['New imported', 'A two', 'A three'], 'new imports receive a sensible position at the front');
select is((select array_agg(name) from (select name from public.flashcard_sets order by sort_order asc, id asc offset 1 limit 2) as page_two), array['A two', 'A three'], 'offset pagination remains deterministic after reordering');

reset role;
set local role anon;
select throws_ok($$select public.move_flashcard_set('a0000000-0000-0000-0000-000000000002', 'up')$$, '42501', NULL, 'anonymous callers cannot reorder sets');

select * from finish();
rollback;
