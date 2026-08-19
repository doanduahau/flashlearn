begin;
select plan(29);

insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','a1000000-0000-4000-8000-000000000001','authenticated','authenticated','starter.new@example.test',now(),'{}','{}','2026-01-01 00:00:00+00',now()),
('00000000-0000-0000-0000-000000000000','a1000000-0000-4000-8000-000000000002','authenticated','authenticated','starter.partial@example.test',now(),'{}','{}','2026-01-02 00:00:00+00',now()),
('00000000-0000-0000-0000-000000000000','a1000000-0000-4000-8000-000000000003','authenticated','authenticated','starter.legacy@example.test',now(),'{}','{}','2026-01-03 00:00:00+00',now()),
('00000000-0000-0000-0000-000000000000','a1000000-0000-4000-8000-000000000004','authenticated','authenticated','starter.unconfirmed@example.test',null,'{}','{}','2026-01-04 00:00:00+00',now());

select ok((select relrowsecurity from pg_class where oid='public.starter_provisioning_states'::regclass),'provisioning state has RLS');
select is(has_function_privilege('authenticated','public.provision_starter_sets(uuid)','execute'),false,'browser cannot provision starters');
select is(has_function_privilege('service_role','public.provision_starter_sets(uuid)','execute'),true,'service role can provision starters');
select is(has_function_privilege('authenticated','public.get_starter_backfill_batch(timestamptz,uuid,integer)','execute'),false,'browser cannot enumerate backfill candidates');

select is((select provisioning_status from public.provision_starter_sets('a1000000-0000-4000-8000-000000000001')),'completed','new confirmed user completes provisioning');
select is((select count(*)::integer from public.flashcard_sets where user_id='a1000000-0000-4000-8000-000000000001'),3,'new user receives exactly three sets');
select is((select count(*)::integer from public.flashcards where user_id='a1000000-0000-4000-8000-000000000001'),150,'new user receives all 150 cards');
select is((select string_agg(s.name,',' order by c.starter_order) from public.flashcard_sets s join public.catalog_sets c on c.id=s.source_catalog_set_id where s.user_id='a1000000-0000-4000-8000-000000000001'),'Từ vựng tiếng Anh: Trái cây,Từ vựng tiếng Anh: Động vật,Kiến thức khoa học và xã hội','starter set order is deterministic');
select is((select created_sets from public.provision_starter_sets('a1000000-0000-4000-8000-000000000001')),0,'second call creates no set');
select is((select count(*)::integer from public.flashcard_sets where user_id='a1000000-0000-4000-8000-000000000001'),3,'idempotent retry leaves exactly three sets');
select is((select attempt_count from public.starter_provisioning_states where user_id='a1000000-0000-4000-8000-000000000001'),1,'completed calls do not increment attempts');

delete from public.flashcard_sets
where user_id='a1000000-0000-4000-8000-000000000001'
  and source_catalog_set_id='20000000-0000-4000-8000-000000000001';
select is((select provisioning_status from public.provision_starter_sets('a1000000-0000-4000-8000-000000000001')),'completed','completed state respects explicit user deletion');
select is((select count(*)::integer from public.flashcard_sets where user_id='a1000000-0000-4000-8000-000000000001'),2,'background retry does not reinstall deleted starter');

delete from public.catalog_cards where catalog_set_id='20000000-0000-4000-8000-000000000003';
select is((select provisioning_status from public.provision_starter_sets('a1000000-0000-4000-8000-000000000002')),'partial','one invalid template produces durable partial state');
select is((select count(*)::integer from public.flashcard_sets where user_id='a1000000-0000-4000-8000-000000000002'),2,'partial attempt commits only valid complete sets');
insert into public.catalog_cards(catalog_set_id,position,front,back)
select '20000000-0000-4000-8000-000000000003',f.position,f.front,f.back
from public.flashcards f
join public.flashcard_sets s on s.id=f.set_id
where s.user_id='a1000000-0000-4000-8000-000000000001'
  and s.source_catalog_set_id='20000000-0000-4000-8000-000000000003';
select is((select provisioning_status from public.provision_starter_sets('a1000000-0000-4000-8000-000000000002')),'completed','retry fills only the missing starter');
select is((select count(*)::integer from public.flashcard_sets where user_id='a1000000-0000-4000-8000-000000000002'),3,'partial retry finishes with three sets and no duplicates');
select is((select attempt_count from public.starter_provisioning_states where user_id='a1000000-0000-4000-8000-000000000002'),2,'partial retry increments bounded durable attempts');

insert into public.flashcard_sets(id,user_id,name) values('b1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000003','Legacy large set');
insert into public.flashcards(user_id,set_id,front,back,position)
select 'a1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000003','Legacy '||n,'Answer '||n,n
from generate_series(1,2990) n;
select is((select provisioning_status from public.provision_starter_sets('a1000000-0000-4000-8000-000000000003')),'completed','legacy user near Free cap still receives starters');
select is((select integer_value from public.entitlement_overrides where user_id='a1000000-0000-4000-8000-000000000003' and entitlement_key='cards.total.max' order by created_at desc limit 1),3140::bigint,'legacy card floor preserves all old and starter data');
select is((public.get_effective_entitlement('a1000000-0000-4000-8000-000000000003','cards.total.max')->>'integer_value')::bigint,3140::bigint,'legacy floor becomes effective entitlement');

select throws_ok($$select * from public.provision_starter_sets('a1000000-0000-4000-8000-000000000004')$$,'22023','confirmed user not found','unconfirmed account is not provisioned');
select is((select count(*)::integer from public.starter_provisioning_states where user_id='a1000000-0000-4000-8000-000000000004'),0,'rejected account creates no state');

select is((select count(*)::integer from public.get_starter_backfill_batch(null,null,2)),2,'dry-run batch obeys hard-bounded page size');
select is((select count(*)::integer from public.starter_provisioning_states),3,'read-only backfill query writes no provisioning state');
select is((
  with first_page as (select * from public.get_starter_backfill_batch(null,null,2)),
  cursor_row as (select user_created_at,user_id from first_page order by user_created_at desc,user_id desc limit 1),
  second_page as (
    select b.* from cursor_row c
    cross join lateral public.get_starter_backfill_batch(c.user_created_at,c.user_id,2) b
  ), combined as (select user_id from first_page union all select user_id from second_page)
  select count(*)::integer from combined
),3,'cursor resume visits every eligible confirmed user');
select is((
  with first_page as (select * from public.get_starter_backfill_batch(null,null,2)),
  cursor_row as (select user_created_at,user_id from first_page order by user_created_at desc,user_id desc limit 1),
  second_page as (
    select b.* from cursor_row c
    cross join lateral public.get_starter_backfill_batch(c.user_created_at,c.user_id,2) b
  ), combined as (select user_id from first_page union all select user_id from second_page)
  select count(distinct user_id)::integer from combined
),3,'cursor resume never duplicates a user');
select throws_ok($$select * from public.get_starter_backfill_batch(null,null,101)$$,'22023','backfill batch limit must be between 1 and 100','backfill hard max is enforced');

set local role authenticated;
set local request.jwt.claim.sub='a1000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.starter_provisioning_states),1,'RLS exposes only own provisioning state');
reset role;

select * from finish();
rollback;
