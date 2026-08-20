begin;
select plan(41);

insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','c2000000-0000-4000-8000-000000000001','authenticated','authenticated','storage.free@example.test',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','c2000000-0000-4000-8000-000000000002','authenticated','authenticated','storage.pro@example.test',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','c2000000-0000-4000-8000-000000000003','authenticated','authenticated','storage.legacy@example.test',now(),'{}','{}',now(),now());
insert into public.user_subscriptions(user_id,plan_id,status,current_period_start,current_period_end)
values('c2000000-0000-4000-8000-000000000002','pro_monthly','active',now()-interval '1 day',now()+interval '29 days');

select is(has_function_privilege('authenticated','public.import_flashcard_set(text,jsonb)','execute'),false,'legacy import RPC is closed');
select is(has_function_privilege('authenticated','public.commit_flashcard_import(text,jsonb,uuid,text,bigint,bigint,boolean)','execute'),true,'authenticated uses idempotent import boundary');
select is(has_function_privilege('anon','public.commit_flashcard_import(text,jsonb,uuid,text,bigint,bigint,boolean)','execute'),false,'anon cannot commit imports');
select is((select storage_enforcement_mode from public.quota_runtime_settings where singleton),'observe','database rollout defaults to observe');
select ok((select relrowsecurity from pg_class where oid='public.storage_quota_observations'::regclass),'quota observations have RLS');
select is(has_table_privilege('authenticated','public.storage_quota_observations','select'),false,'browser cannot read raw quota observations');
update public.quota_runtime_settings set storage_enforcement_mode='block';
select set_config('capystudy.quota_mode','observe',true);
select is(public.storage_enforcement_mode(),'block','request GUC cannot downgrade the DB-owned mode');

set local role authenticated;
set local request.jwt.claim.sub='c2000000-0000-4000-8000-000000000001';
create temporary table first_import as select * from public.commit_flashcard_import(
  'First','[{"front":"A","back":"B"}]','c2100000-0000-4000-8000-000000000001','paste_structured',0,100,false);
select is((select already_exists from first_import),false,'first logical import creates a set');
select is((select already_exists from public.commit_flashcard_import('Ignored','[{"front":"X","back":"Y"}]','c2100000-0000-4000-8000-000000000001','paste_structured',0,100,false)),true,'retry returns prior result');
select is((select set_id from public.commit_flashcard_import('Ignored','[{"front":"X","back":"Y"}]','c2100000-0000-4000-8000-000000000001','paste_structured',0,100,false)),(select set_id from first_import),'retry returns the same set id');
select is((select count(*)::integer from public.flashcard_sets),1,'retry creates no duplicate set');
select throws_ok($$select * from public.commit_flashcard_import('AI forge','[{"front":"A","back":"B"}]','c2100000-0000-4000-8000-000000000002','paste_structured',0,10,true)$$,'22023','deterministic import cannot use ai','deterministic sources cannot claim AI use');

select lives_ok($$select * from public.commit_flashcard_import('Free 500',(select jsonb_agg(jsonb_build_object('front',n,'back',n)) from generate_series(1,500)n),'c2100000-0000-4000-8000-000000000003','manual',0,0,false)$$,'Free accepts 500 cards');
select throws_ok($$select * from public.commit_flashcard_import('Free 501',(select jsonb_agg(jsonb_build_object('front',n,'back',n)) from generate_series(1,501)n),'c2100000-0000-4000-8000-000000000004','manual',0,0,false)$$,'P0001','import_per_request_limit','Free rejects 501 cards');
select throws_ok($$select * from public.commit_flashcard_import('Large CSV','[{"front":"A","back":"B"}]','c2100000-0000-4000-8000-000000000007','csv_xlsx',5242881,0,false)$$,'P0001','import_per_request_limit','Free rejects CSV/XLSX above 5 MiB');
select throws_ok($$select * from public.commit_flashcard_import('Large document','[{"front":"A","back":"B"}]','c2100000-0000-4000-8000-000000000008','pdf',1024,30001,true)$$,'P0001','import_per_request_limit','Free rejects document text above 30000 characters');

reset role;
update public.quota_runtime_settings set storage_enforcement_mode='observe';
insert into public.storage_quota_observations(
  user_id,resource_key,operation,enforcement_mode,current_value,limit_value,
  observed_hour,first_observed_at,last_observed_at
) values(
  'c2000000-0000-4000-8000-000000000001','imports.request.cards','old.probe','observe',501,500,
  date_trunc('hour',now()-interval '36 days'),now()-interval '36 days',now()-interval '36 days'
);
set local role authenticated;
set local request.jwt.claim.sub='c2000000-0000-4000-8000-000000000001';
select lives_ok($$select * from public.commit_flashcard_import('Observe 501',(select jsonb_agg(jsonb_build_object('front',n,'back',n)) from generate_series(1,501)n),'c2100000-0000-4000-8000-000000000005','manual',0,0,false)$$,'observe records without blocking per-request overage');
reset role;
select is((select count(*)::integer from public.storage_quota_observations where user_id='c2000000-0000-4000-8000-000000000001' and enforcement_mode='observe' and resource_key='imports.request.cards'),1,'observe persists a would-block import observation');
select is((select count(*)::integer from public.storage_quota_observations where user_id='c2000000-0000-4000-8000-000000000001' and operation='old.probe'),0,'observation writes prune the same user beyond 35-day retention');
update public.quota_runtime_settings set storage_enforcement_mode='warn';
set local role authenticated;
set local request.jwt.claim.sub='c2000000-0000-4000-8000-000000000001';
select lives_ok($$select * from public.commit_flashcard_import('Warn 501',(select jsonb_agg(jsonb_build_object('front',n,'back',n)) from generate_series(1,501)n),'c2100000-0000-4000-8000-000000000006','manual',0,0,false)$$,'warn records without blocking per-request overage');
select is((select has_recent_warning from public.get_my_storage_quota_status()),true,'warn status is visible to its authenticated owner');

reset role;
select is((select count(*)::integer from public.storage_quota_observations where user_id='c2000000-0000-4000-8000-000000000001' and enforcement_mode='warn' and resource_key='imports.request.cards'),1,'warn persists a would-block import observation');
update public.quota_runtime_settings set storage_enforcement_mode='block';
set local role authenticated;
set local request.jwt.claim.sub='c2000000-0000-4000-8000-000000000002';
select lives_ok($$select * from public.commit_flashcard_import('Pro 2000',(select jsonb_agg(jsonb_build_object('front',n,'back',n)) from generate_series(1,2000)n),'c2200000-0000-4000-8000-000000000001','manual',0,0,false)$$,'Pro accepts 2000 cards');
select throws_ok($$select * from public.commit_flashcard_import('Pro 2001',(select jsonb_agg(jsonb_build_object('front',n,'back',n)) from generate_series(1,2001)n),'c2200000-0000-4000-8000-000000000002','manual',0,0,false)$$,'P0001','import_per_request_limit','Pro rejects 2001 cards');
select throws_ok($$select * from public.commit_flashcard_import('Hard side',('[{"front":"' || repeat('x',50001) || '","back":"B"}]')::jsonb,'c2200000-0000-4000-8000-000000000003','manual',0,0,false)$$,'22023',NULL,'import rejects a card side above the 50000 hard ceiling');

reset role;
update public.quota_runtime_settings set storage_enforcement_mode='observe';
insert into public.flashcard_sets(id,user_id,name) values('c2300000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000003','Legacy');
insert into public.flashcards(id,user_id,set_id,front,back,position) values
('c2400000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000003','c2300000-0000-4000-8000-000000000001',repeat('x',6000),'B',0);
update public.quota_runtime_settings set storage_enforcement_mode='block';
set local role authenticated;
set local request.jwt.claim.sub='c2000000-0000-4000-8000-000000000003';
select lives_ok($$select public.update_flashcard_with_quota('c2400000-0000-4000-8000-000000000001','c2300000-0000-4000-8000-000000000001',repeat('x',5999),'B')$$,'legacy oversized side may shrink');
select throws_ok($$select public.update_flashcard_with_quota('c2400000-0000-4000-8000-000000000001','c2300000-0000-4000-8000-000000000001',repeat('x',6001),'B')$$,'P0001','storage_growth_blocked','legacy oversized side cannot grow');
select lives_ok($$delete from public.flashcards where id='c2400000-0000-4000-8000-000000000001'$$,'delete is always allowed');

reset role;
update public.quota_runtime_settings set storage_enforcement_mode='observe';
insert into public.legacy_storage_floors(user_id,regular_sets,cards,collections)
values('c2000000-0000-4000-8000-000000000003',30,0,0)
on conflict(user_id) do update set regular_sets=30;
insert into public.flashcard_sets(user_id,name)
select 'c2000000-0000-4000-8000-000000000003','Legacy floor '||n from generate_series(1,29)n;
update public.quota_runtime_settings set storage_enforcement_mode='block';
delete from public.flashcard_sets where user_id='c2000000-0000-4000-8000-000000000003' and name like 'Legacy floor %' and name not in (select 'Legacy floor '||n from generate_series(1,9)n);
select lives_ok($$insert into public.flashcard_sets(user_id,name) select 'c2000000-0000-4000-8000-000000000003','Refill '||n from generate_series(1,20)n$$,'a legacy account may refill to its fixed captured floor after deleting');
select is((select count(*)::integer from public.flashcard_sets where user_id='c2000000-0000-4000-8000-000000000003'),30,'fixed legacy floor remains the effective ceiling after deletion');
select throws_ok($$insert into public.flashcard_sets(user_id,name) values('c2000000-0000-4000-8000-000000000003','Beyond floor')$$,'P0001','storage_quota_exceeded','legacy account cannot grow beyond its fixed floor');

reset role;
insert into public.flashcard_sets(id,user_id,name) values('c2300000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','Side boundary');
set local role authenticated;
set local request.jwt.claim.sub='c2000000-0000-4000-8000-000000000001';
select lives_ok($$select * from public.add_flashcard_with_quota('c2300000-0000-4000-8000-000000000002',repeat('x',5000),'B')$$,'Free accepts 5000 characters per side');
select throws_ok($$select * from public.add_flashcard_with_quota('c2300000-0000-4000-8000-000000000002',repeat('x',5001),'B')$$,'P0001','storage_card_side_limit','Free rejects 5001 characters per side');
select throws_ok($$update public.flashcards set front=repeat('x',5001) where set_id='c2300000-0000-4000-8000-000000000002'$$,'P0001','storage_growth_blocked','direct owned RLS update cannot bypass the soft side limit');

reset role;
insert into public.special_collections(user_id,name)
select 'c2000000-0000-4000-8000-000000000001','Collection '||n from generate_series(1,10)n;
set local role authenticated;
set local request.jwt.claim.sub='c2000000-0000-4000-8000-000000000001';
select throws_ok($$select public.create_special_collection_with_quota('Collection 11')$$,'P0001','storage_quota_exceeded','Free collection cap is enforced');
select lives_ok($$delete from public.special_collections where name='Collection 10'$$,'collection delete remains allowed at cap');
select lives_ok($$select public.create_special_collection_with_quota('Replacement')$$,'capacity released by delete can be reused');

reset role;
insert into public.flashcard_sets(id,user_id,name) values('c2300000-0000-4000-8000-000000000004','c2000000-0000-4000-8000-000000000002','Clone source');
insert into public.flashcards(user_id,set_id,front,back,position) values('c2000000-0000-4000-8000-000000000002','c2300000-0000-4000-8000-000000000004','Source','Answer',0);
select set_config('storage.clone_token',public.create_set_share_token('c2000000-0000-4000-8000-000000000002','c2300000-0000-4000-8000-000000000004'),false);
insert into public.flashcards(user_id,set_id,front,back,position)
select 'c2000000-0000-4000-8000-000000000001','c2300000-0000-4000-8000-000000000002','Fill '||n,'B'||n,10000+n
from generate_series(1,3000-(select count(*)::integer from public.flashcards where user_id='c2000000-0000-4000-8000-000000000001')) n;
select is(has_function_privilege('authenticated','public.clone_shared_set_with_quota(text,uuid)','execute'),false,'browser cannot execute the storage clone wrapper');
select throws_ok($$select * from public.clone_shared_set_with_quota(current_setting('storage.clone_token'),'c2000000-0000-4000-8000-000000000001')$$,'P0001','storage_quota_exceeded','shared clone uses the DB-owned block mode');

set local role authenticated;
set local request.jwt.claim.sub='c2000000-0000-4000-8000-000000000002';
select is((select set_id from public.commit_flashcard_import('Other user same key','[{"front":"A","back":"B"}]','c2100000-0000-4000-8000-000000000001','manual',0,0,false)) is not null,true,'same idempotency key is isolated per user');
reset role;
select is((select public.get_effective_plan('c2000000-0000-4000-8000-000000000002')),'pro_monthly','caller cannot forge plan through import payload');

select * from finish();
rollback;
