begin;
select plan(12);

insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','a2000000-0000-4000-8000-000000000001','authenticated','authenticated','catalog.ui@example.test',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','a2000000-0000-4000-8000-000000000002','authenticated','authenticated','catalog.quota@example.test',now(),'{}','{}',now(),now());

select is(has_function_privilege('authenticated','public.install_catalog_set_for_user(uuid,uuid,uuid)','execute'),false,'browser cannot invoke service install gate');
select is(has_function_privilege('service_role','public.install_catalog_set_for_user(uuid,uuid,uuid)','execute'),true,'service role can invoke install gate');
select is((select already_exists from public.install_catalog_set_for_user('a2000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','a2100000-0000-4000-8000-000000000001')),false,'first catalog install creates a clone');
select is((select count(*)::integer from public.flashcard_sets where user_id='a2000000-0000-4000-8000-000000000001'),1,'install creates one set');
select is((select already_exists from public.install_catalog_set_for_user('a2000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','a2100000-0000-4000-8000-000000000002')),true,'repeat returns existing clone');
select is((select count(*)::integer from public.flashcard_sets where user_id='a2000000-0000-4000-8000-000000000001'),1,'repeat remains idempotent');

insert into public.starter_provisioning_states(user_id,status,installed_count,attempt_count)
values('a2000000-0000-4000-8000-000000000001','completed',3,1);
select is(public.claim_starter_onboarding_banner('a2000000-0000-4000-8000-000000000001'),true,'completed provisioning claims banner once');
select is(public.claim_starter_onboarding_banner('a2000000-0000-4000-8000-000000000001'),false,'banner cannot be claimed twice');

insert into public.flashcard_sets(id,user_id,name) values('b2000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000002','Near quota');
insert into public.flashcards(user_id,set_id,front,back,position)
select 'a2000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002','F'||n,'B'||n,n from generate_series(1,2951)n;
update public.quota_runtime_settings set storage_enforcement_mode='block';
select throws_ok($$select * from public.install_catalog_set_for_user('a2000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','a2100000-0000-4000-8000-000000000003')$$,'P0001','storage_quota_exceeded','DB block mode enforces Free card quota');
select is((select count(*)::integer from public.flashcard_sets where user_id='a2000000-0000-4000-8000-000000000002'),1,'rejected quota install creates no partial set');
update public.quota_runtime_settings set storage_enforcement_mode='observe';
select lives_ok($$select * from public.install_catalog_set_for_user('a2000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','a2100000-0000-4000-8000-000000000004')$$,'DB observe mode records policy without blocking');
select is((select count(*)::integer from public.flashcard_sets where user_id='a2000000-0000-4000-8000-000000000002'),2,'observe mode creates one complete clone');

select * from finish();
rollback;
