begin;
select plan(27);

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
update public.quota_runtime_settings set storage_enforcement_mode='block';

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
set local role authenticated;
set local request.jwt.claim.sub='c2000000-0000-4000-8000-000000000001';
select lives_ok($$select * from public.commit_flashcard_import('Observe 501',(select jsonb_agg(jsonb_build_object('front',n,'back',n)) from generate_series(1,501)n),'c2100000-0000-4000-8000-000000000005','manual',0,0,false)$$,'observe records without blocking per-request overage');
reset role;
update public.quota_runtime_settings set storage_enforcement_mode='warn';
set local role authenticated;
set local request.jwt.claim.sub='c2000000-0000-4000-8000-000000000001';
select lives_ok($$select * from public.commit_flashcard_import('Warn 501',(select jsonb_agg(jsonb_build_object('front',n,'back',n)) from generate_series(1,501)n),'c2100000-0000-4000-8000-000000000006','manual',0,0,false)$$,'warn records without blocking per-request overage');

reset role;
update public.quota_runtime_settings set storage_enforcement_mode='block';
set local role authenticated;
set local request.jwt.claim.sub='c2000000-0000-4000-8000-000000000002';
select lives_ok($$select * from public.commit_flashcard_import('Pro 2000',(select jsonb_agg(jsonb_build_object('front',n,'back',n)) from generate_series(1,2000)n),'c2200000-0000-4000-8000-000000000001','manual',0,0,false)$$,'Pro accepts 2000 cards');
select throws_ok($$select * from public.commit_flashcard_import('Pro 2001',(select jsonb_agg(jsonb_build_object('front',n,'back',n)) from generate_series(1,2001)n),'c2200000-0000-4000-8000-000000000002','manual',0,0,false)$$,'P0001','import_per_request_limit','Pro rejects 2001 cards');

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
insert into public.flashcard_sets(id,user_id,name) values('c2300000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','Side boundary');
set local role authenticated;
set local request.jwt.claim.sub='c2000000-0000-4000-8000-000000000001';
select lives_ok($$select * from public.add_flashcard_with_quota('c2300000-0000-4000-8000-000000000002',repeat('x',5000),'B')$$,'Free accepts 5000 characters per side');
select throws_ok($$select * from public.add_flashcard_with_quota('c2300000-0000-4000-8000-000000000002',repeat('x',5001),'B')$$,'P0001','storage_card_side_limit','Free rejects 5001 characters per side');

reset role;
insert into public.special_collections(user_id,name)
select 'c2000000-0000-4000-8000-000000000001','Collection '||n from generate_series(1,10)n;
set local role authenticated;
set local request.jwt.claim.sub='c2000000-0000-4000-8000-000000000001';
select throws_ok($$select public.create_special_collection_with_quota('Collection 11')$$,'P0001','storage_quota_exceeded','Free collection cap is enforced');
select lives_ok($$delete from public.special_collections where name='Collection 10'$$,'collection delete remains allowed at cap');
select lives_ok($$select public.create_special_collection_with_quota('Replacement')$$,'capacity released by delete can be reused');

reset role;
set local role authenticated;
set local request.jwt.claim.sub='c2000000-0000-4000-8000-000000000002';
select is((select set_id from public.commit_flashcard_import('Other user same key','[{"front":"A","back":"B"}]','c2100000-0000-4000-8000-000000000001','manual',0,0,false)) is not null,true,'same idempotency key is isolated per user');
reset role;
select is((select public.get_effective_plan('c2000000-0000-4000-8000-000000000002')),'pro_monthly','caller cannot forge plan through import payload');

select * from finish();
rollback;
