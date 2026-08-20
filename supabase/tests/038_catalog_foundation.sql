begin;
select plan(19);

insert into auth.users (instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','aaaaaaaa-cccc-cccc-cccc-cccccccccccc','authenticated','authenticated','catalog.a@example.test',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','bbbbbbbb-cccc-cccc-cccc-cccccccccccc','authenticated','authenticated','catalog.b@example.test',now(),'{}','{}',now(),now());
insert into public.catalog_categories(id,slug,name) values ('11111111-cccc-cccc-cccc-cccccccccccc','starter','Starter');
insert into public.catalog_sets(id,category_id,slug,title,language_front,language_back,status,version,published_at) values
('22222222-cccc-cccc-cccc-cccccccccccc','11111111-cccc-cccc-cccc-cccccccccccc','fruit','Trái cây','vi','en','published',1,now()),
('33333333-cccc-cccc-cccc-cccccccccccc','11111111-cccc-cccc-cccc-cccccccccccc','draft','Nháp','vi','en','draft',1,null);
insert into public.catalog_cards(catalog_set_id,front,back,position) values
('22222222-cccc-cccc-cccc-cccccccccccc','Táo','Apple',0),('22222222-cccc-cccc-cccc-cccccccccccc','Cam','Orange',1);

select ok((select relrowsecurity from pg_class where oid='public.catalog_sets'::regclass),'catalog sets have RLS');
select is(has_table_privilege('authenticated','public.catalog_sets','insert'),false,'browser cannot write catalog');
select is(has_function_privilege('authenticated','public.install_catalog_set(uuid,uuid,uuid)','execute'),false,'browser cannot call install RPC');
select is(has_function_privilege('service_role','public.install_catalog_set(uuid,uuid,uuid)','execute'),true,'service role can call install RPC');
set local role authenticated; set local request.jwt.claim.sub='aaaaaaaa-cccc-cccc-cccc-cccccccccccc';
select is((select count(*)::integer from public.catalog_sets where id in ('22222222-cccc-cccc-cccc-cccccccccccc','33333333-cccc-cccc-cccc-cccccccccccc')),1,'authenticated reads published fixture but not draft fixture');
select is((select count(*)::integer from public.catalog_cards where catalog_set_id='22222222-cccc-cccc-cccc-cccccccccccc'),2,'authenticated reads cards of published fixture');
reset role;

select lives_ok($$select * from public.install_catalog_set('aaaaaaaa-cccc-cccc-cccc-cccccccccccc','22222222-cccc-cccc-cccc-cccccccccccc','44444444-cccc-4ccc-8ccc-cccccccccccc')$$,'installs published set');
select is((select count(*)::integer from public.flashcard_sets where user_id='aaaaaaaa-cccc-cccc-cccc-cccccccccccc'),1,'one independent flashcard set created');
select is((select count(*)::integer from public.flashcards f join public.flashcard_sets s on s.id=f.set_id where s.user_id='aaaaaaaa-cccc-cccc-cccc-cccccccccccc'),2,'copies all catalog cards');
select is((select string_agg(front,',' order by position) from public.flashcards f join public.flashcard_sets s on s.id=f.set_id where s.user_id='aaaaaaaa-cccc-cccc-cccc-cccccccccccc'),'Táo,Cam','keeps deterministic card order');
select is((select source_catalog_version from public.flashcard_sets where user_id='aaaaaaaa-cccc-cccc-cccc-cccccccccccc'),1,'clone snapshots catalog version');
select is((select already_exists from public.install_catalog_set('aaaaaaaa-cccc-cccc-cccc-cccccccccccc','22222222-cccc-cccc-cccc-cccccccccccc','55555555-cccc-4ccc-8ccc-cccccccccccc')),true,'second install returns existing clone');
select is((select count(*)::integer from public.flashcard_sets where user_id='aaaaaaaa-cccc-cccc-cccc-cccccccccccc'),1,'second install creates no duplicate');

delete from public.flashcard_sets where user_id='aaaaaaaa-cccc-cccc-cccc-cccccccccccc';
select lives_ok($$select * from public.install_catalog_set('aaaaaaaa-cccc-cccc-cccc-cccccccccccc','22222222-cccc-cccc-cccc-cccccccccccc','66666666-cccc-4ccc-8ccc-cccccccccccc')$$,'deleted clone can be installed again');
select is((select count(*)::integer from public.flashcard_sets where user_id='aaaaaaaa-cccc-cccc-cccc-cccccccccccc'),1,'reinstall creates one new clone');
update public.catalog_sets set status='archived',published_at=null where id='22222222-cccc-cccc-cccc-cccccccccccc';
select throws_ok($$select * from public.install_catalog_set('bbbbbbbb-cccc-cccc-cccc-cccccccccccc','22222222-cccc-cccc-cccc-cccccccccccc','77777777-cccc-4ccc-8ccc-cccccccccccc')$$,'P0002','published catalog set not found','archived template cannot be installed');
select is((select count(*)::integer from public.flashcard_sets where user_id='bbbbbbbb-cccc-cccc-cccc-cccccccccccc'),0,'failed install has no partial clone');
select is((select count(*)::integer from public.user_catalog_installs where user_id='bbbbbbbb-cccc-cccc-cccc-cccccccccccc'),0,'failed install has no partial install row');
set local role authenticated; set local request.jwt.claim.sub='aaaaaaaa-cccc-cccc-cccc-cccccccccccc';
select is((select count(*)::integer from public.user_catalog_installs),2,'RLS exposes only own install history');
reset role;

select * from finish(); rollback;
