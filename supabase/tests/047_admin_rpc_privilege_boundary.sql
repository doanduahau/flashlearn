-- LP-10 Security Regression Tests: Admin Mutation RPC Privilege Boundary
-- Verifies that all 8 admin mutation RPCs have browser execution revoked
-- (PUBLIC = FALSE, anon = FALSE, authenticated = FALSE, service_role = TRUE)
-- and that authenticated callers attempting forged-actor calls are blocked at the SQL boundary (42501).

begin;
select plan(42);

-- ============================================================
-- FIXTURES
-- ============================================================

-- Create test auth users (owner admin vs regular user)
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-2222-3333-4444-555555555555', 'authenticated', 'authenticated', 'sec.owner047@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '66666666-7777-8888-9999-000000000000', 'authenticated', 'authenticated', 'sec.attacker047@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

-- Assign owner role to the legitimate admin
insert into public.user_roles (user_id, role, created_by)
values ('11111111-2222-3333-4444-555555555555', 'owner', '11111111-2222-3333-4444-555555555555');

-- Create catalog category and set
insert into public.catalog_categories (name, slug)
values ('SecCat047', 'sec-cat-047')
on conflict (slug) do nothing;

insert into public.catalog_sets (id, title, slug, category_id, language_front, language_back, status, version)
select 'c0000000-0000-4000-8000-000000000047'::uuid, 'SecSet047', 'sec-set-047', cc.id, 'en', 'vi', 'draft', 1
from public.catalog_categories cc where cc.slug = 'sec-cat-047'
on conflict (slug) do nothing;

-- Create a failed job for testing retry
insert into public.processing_jobs (id, user_id, job_kind, source_type, status, error_code, correlation_id, idempotency_key, physical_calls)
values ('b4700000-0000-4000-8000-000000000047', '66666666-7777-8888-9999-000000000000', 'paste_generate', 'paste_prose', 'failed', 'PROVIDER_TIMEOUT', '00000000-0000-4000-8000-000000000047', '00000000-0000-4000-8000-000000000047'::uuid, 1)
on conflict (id) do nothing;

-- ============================================================
-- SECTION 1: PRIVILEGE INSPECTION FOR ALL 8 EXACT SIGNATURES (32 assertions)
-- ============================================================

-- 1. admin_update_catalog_set
select is(has_function_privilege('public', 'public.admin_update_catalog_set(uuid,uuid,text,text,uuid,text,text,text,text[],boolean)', 'execute'), false, 'PUBLIC: admin_update_catalog_set execute = false');
select is(has_function_privilege('anon', 'public.admin_update_catalog_set(uuid,uuid,text,text,uuid,text,text,text,text[],boolean)', 'execute'), false, 'anon: admin_update_catalog_set execute = false');
select is(has_function_privilege('authenticated', 'public.admin_update_catalog_set(uuid,uuid,text,text,uuid,text,text,text,text[],boolean)', 'execute'), false, 'authenticated: admin_update_catalog_set execute = false');
select is(has_function_privilege('service_role', 'public.admin_update_catalog_set(uuid,uuid,text,text,uuid,text,text,text,text[],boolean)', 'execute'), true, 'service_role: admin_update_catalog_set execute = true');

-- 2. admin_publish_catalog_set
select is(has_function_privilege('public', 'public.admin_publish_catalog_set(uuid,uuid,text)', 'execute'), false, 'PUBLIC: admin_publish_catalog_set execute = false');
select is(has_function_privilege('anon', 'public.admin_publish_catalog_set(uuid,uuid,text)', 'execute'), false, 'anon: admin_publish_catalog_set execute = false');
select is(has_function_privilege('authenticated', 'public.admin_publish_catalog_set(uuid,uuid,text)', 'execute'), false, 'authenticated: admin_publish_catalog_set execute = false');
select is(has_function_privilege('service_role', 'public.admin_publish_catalog_set(uuid,uuid,text)', 'execute'), true, 'service_role: admin_publish_catalog_set execute = true');

-- 3. admin_unpublish_catalog_set
select is(has_function_privilege('public', 'public.admin_unpublish_catalog_set(uuid,uuid,text)', 'execute'), false, 'PUBLIC: admin_unpublish_catalog_set execute = false');
select is(has_function_privilege('anon', 'public.admin_unpublish_catalog_set(uuid,uuid,text)', 'execute'), false, 'anon: admin_unpublish_catalog_set execute = false');
select is(has_function_privilege('authenticated', 'public.admin_unpublish_catalog_set(uuid,uuid,text)', 'execute'), false, 'authenticated: admin_unpublish_catalog_set execute = false');
select is(has_function_privilege('service_role', 'public.admin_unpublish_catalog_set(uuid,uuid,text)', 'execute'), true, 'service_role: admin_unpublish_catalog_set execute = true');

-- 4. admin_archive_catalog_set
select is(has_function_privilege('public', 'public.admin_archive_catalog_set(uuid,uuid,text)', 'execute'), false, 'PUBLIC: admin_archive_catalog_set execute = false');
select is(has_function_privilege('anon', 'public.admin_archive_catalog_set(uuid,uuid,text)', 'execute'), false, 'anon: admin_archive_catalog_set execute = false');
select is(has_function_privilege('authenticated', 'public.admin_archive_catalog_set(uuid,uuid,text)', 'execute'), false, 'authenticated: admin_archive_catalog_set execute = false');
select is(has_function_privilege('service_role', 'public.admin_archive_catalog_set(uuid,uuid,text)', 'execute'), true, 'service_role: admin_archive_catalog_set execute = true');

-- 5. admin_replace_catalog_cards
select is(has_function_privilege('public', 'public.admin_replace_catalog_cards(uuid,uuid,jsonb,text)', 'execute'), false, 'PUBLIC: admin_replace_catalog_cards execute = false');
select is(has_function_privilege('anon', 'public.admin_replace_catalog_cards(uuid,uuid,jsonb,text)', 'execute'), false, 'anon: admin_replace_catalog_cards execute = false');
select is(has_function_privilege('authenticated', 'public.admin_replace_catalog_cards(uuid,uuid,jsonb,text)', 'execute'), false, 'authenticated: admin_replace_catalog_cards execute = false');
select is(has_function_privilege('service_role', 'public.admin_replace_catalog_cards(uuid,uuid,jsonb,text)', 'execute'), true, 'service_role: admin_replace_catalog_cards execute = true');

-- 6. admin_adjust_user_usage
select is(has_function_privilege('public', 'public.admin_adjust_user_usage(uuid,uuid,text,integer,text,uuid)', 'execute'), false, 'PUBLIC: admin_adjust_user_usage execute = false');
select is(has_function_privilege('anon', 'public.admin_adjust_user_usage(uuid,uuid,text,integer,text,uuid)', 'execute'), false, 'anon: admin_adjust_user_usage execute = false');
select is(has_function_privilege('authenticated', 'public.admin_adjust_user_usage(uuid,uuid,text,integer,text,uuid)', 'execute'), false, 'authenticated: admin_adjust_user_usage execute = false');
select is(has_function_privilege('service_role', 'public.admin_adjust_user_usage(uuid,uuid,text,integer,text,uuid)', 'execute'), true, 'service_role: admin_adjust_user_usage execute = true');

-- 7. admin_override_user_entitlement
select is(has_function_privilege('public', 'public.admin_override_user_entitlement(uuid,uuid,text,text,text,integer,boolean,text,timestamptz,uuid)', 'execute'), false, 'PUBLIC: admin_override_user_entitlement execute = false');
select is(has_function_privilege('anon', 'public.admin_override_user_entitlement(uuid,uuid,text,text,text,integer,boolean,text,timestamptz,uuid)', 'execute'), false, 'anon: admin_override_user_entitlement execute = false');
select is(has_function_privilege('authenticated', 'public.admin_override_user_entitlement(uuid,uuid,text,text,text,integer,boolean,text,timestamptz,uuid)', 'execute'), false, 'authenticated: admin_override_user_entitlement execute = false');
select is(has_function_privilege('service_role', 'public.admin_override_user_entitlement(uuid,uuid,text,text,text,integer,boolean,text,timestamptz,uuid)', 'execute'), true, 'service_role: admin_override_user_entitlement execute = true');

-- 8. admin_retry_processing_job
select is(has_function_privilege('public', 'public.admin_retry_processing_job(uuid,uuid,text,uuid)', 'execute'), false, 'PUBLIC: admin_retry_processing_job execute = false');
select is(has_function_privilege('anon', 'public.admin_retry_processing_job(uuid,uuid,text,uuid)', 'execute'), false, 'anon: admin_retry_processing_job execute = false');
select is(has_function_privilege('authenticated', 'public.admin_retry_processing_job(uuid,uuid,text,uuid)', 'execute'), false, 'authenticated: admin_retry_processing_job execute = false');
select is(has_function_privilege('service_role', 'public.admin_retry_processing_job(uuid,uuid,text,uuid)', 'execute'), true, 'service_role: admin_retry_processing_job execute = true');

-- ============================================================
-- SECTION 2: FORGED-ACTOR ATTEMPT BY AUTHENTICATED CALLER (8 assertions)
-- All 8 calls must be denied at the function execution permission boundary (42501)
-- ============================================================

set local role authenticated;
set local request.jwt.claim.sub = '66666666-7777-8888-9999-000000000000';

-- 1. admin_update_catalog_set with forged owner UUID
select throws_ok(
  $$select * from public.admin_update_catalog_set('11111111-2222-3333-4444-555555555555'::uuid, 'c0000000-0000-4000-8000-000000000047'::uuid, 'Hacked Title')$$,
  '42501', NULL, 'authenticated blocked from calling admin_update_catalog_set'
);

-- 2. admin_publish_catalog_set with forged owner UUID
select throws_ok(
  $$select * from public.admin_publish_catalog_set('11111111-2222-3333-4444-555555555555'::uuid, 'c0000000-0000-4000-8000-000000000047'::uuid, 'forged publish')$$,
  '42501', NULL, 'authenticated blocked from calling admin_publish_catalog_set'
);

-- 3. admin_unpublish_catalog_set with forged owner UUID
select throws_ok(
  $$select * from public.admin_unpublish_catalog_set('11111111-2222-3333-4444-555555555555'::uuid, 'c0000000-0000-4000-8000-000000000047'::uuid, 'forged unpublish')$$,
  '42501', NULL, 'authenticated blocked from calling admin_unpublish_catalog_set'
);

-- 4. admin_archive_catalog_set with forged owner UUID
select throws_ok(
  $$select * from public.admin_archive_catalog_set('11111111-2222-3333-4444-555555555555'::uuid, 'c0000000-0000-4000-8000-000000000047'::uuid, 'forged archive')$$,
  '42501', NULL, 'authenticated blocked from calling admin_archive_catalog_set'
);

-- 5. admin_replace_catalog_cards with forged owner UUID
select throws_ok(
  $$select * from public.admin_replace_catalog_cards('11111111-2222-3333-4444-555555555555'::uuid, 'c0000000-0000-4000-8000-000000000047'::uuid, '[{"front":"a","back":"b"}]'::jsonb, 'forged cards')$$,
  '42501', NULL, 'authenticated blocked from calling admin_replace_catalog_cards'
);

-- 6. admin_adjust_user_usage with forged owner UUID
select throws_ok(
  $$select * from public.admin_adjust_user_usage('11111111-2222-3333-4444-555555555555'::uuid, '66666666-7777-8888-9999-000000000000'::uuid, 'ai.content_credits.monthly', 100, 'forged credits')$$,
  '42501', NULL, 'authenticated blocked from calling admin_adjust_user_usage'
);

-- 7. admin_override_user_entitlement with forged owner UUID
select throws_ok(
  $$select * from public.admin_override_user_entitlement('11111111-2222-3333-4444-555555555555'::uuid, '66666666-7777-8888-9999-000000000000'::uuid, 'catalog.install_limit', 'integer', 'forged override', 100, null, null, now() + interval '30 days')$$,
  '42501', NULL, 'authenticated blocked from calling admin_override_user_entitlement'
);

-- 8. admin_retry_processing_job with forged owner UUID
select throws_ok(
  $$select * from public.admin_retry_processing_job('11111111-2222-3333-4444-555555555555'::uuid, 'b4700000-0000-4000-8000-000000000047'::uuid, 'forged retry')$$,
  '42501', NULL, 'authenticated blocked from calling admin_retry_processing_job'
);

reset role;

-- ============================================================
-- SECTION 3: MUTATION INTEGRITY (2 assertions)
-- Verify that no state changes or audit entries were created by blocked calls
-- ============================================================

select is((select status from public.catalog_sets where id = 'c0000000-0000-4000-8000-000000000047'), 'draft', 'catalog set status unchanged');
select is((select count(*)::integer from public.admin_audit_logs where actor = '11111111-2222-3333-4444-555555555555'), 0, 'no forged audit logs created');

select * from finish();
rollback;
