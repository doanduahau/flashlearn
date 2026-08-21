-- LP-10 Part 3: pgTAP tests for admin mutation RPCs (8 functions + check_admin_permission)
-- Covers: permissions, input validation, idempotency, audit, security boundary

begin;
select plan(72);

-- ============================================================
-- FIXTURES
-- ============================================================

-- Auth users (unique IDs, no conflict with seed.sql)
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'mut.owner046@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'mut.support046@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'mut.content046@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'mut.user046@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

-- Roles
insert into public.user_roles (user_id, role, created_by) values
  ('11111111-1111-1111-1111-111111111111', 'owner', '11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222', 'support', '11111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333', 'content_admin', '11111111-1111-1111-1111-111111111111');

-- Profiles
insert into public.profiles (id, display_name, timezone) values
  ('44444444-4444-4444-4444-444444444444', 'Test User 046', 'Asia/Ho_Chi_Minh')
on conflict (id) do update set display_name = excluded.display_name;

-- Catalog category
insert into public.catalog_categories (name, slug)
values ('MutCat046', 'mutcat-046')
on conflict (slug) do nothing;

-- Catalog sets
insert into public.catalog_sets (title, slug, category_id, language_front, language_back, status, version)
select 'TestMutSet046', 'test-mut-set-046', cc.id, 'en', 'vi', 'draft', 1
from public.catalog_categories cc where cc.slug = 'mutcat-046'
and not exists (select 1 from public.catalog_sets where slug = 'test-mut-set-046');

insert into public.catalog_sets (title, slug, category_id, language_front, language_back, status, version)
select 'ReasonTest046', 'reason-test-046', cc.id, 'en', 'vi', 'draft', 1
from public.catalog_categories cc where cc.slug = 'mutcat-046'
and not exists (select 1 from public.catalog_sets where slug = 'reason-test-046');

insert into public.catalog_sets (title, slug, category_id, language_front, language_back, status, version)
select 'PermTest046', 'perm-test-046', cc.id, 'en', 'vi', 'draft', 1
from public.catalog_categories cc where cc.slug = 'mutcat-046'
and not exists (select 1 from public.catalog_sets where slug = 'perm-test-046');

-- Processing jobs
insert into public.processing_jobs (id, user_id, job_kind, source_type, status, error_code, correlation_id, idempotency_key, physical_calls)
values ('b1000000-0000-4000-8000-000000000001', '44444444-4444-4444-4444-444444444444', 'paste_generate', 'paste_prose', 'failed', 'PROVIDER_TIMEOUT', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011'::uuid, 1),
       ('b2000000-0000-4000-8000-000000000002', '44444444-4444-4444-4444-444444444444', 'document_extract', null, 'failed', 'GENERIC', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000012'::uuid, 1)
on conflict (id) do nothing;

-- ============================================================
-- SECTION 0: check_admin_permission (14 assertions)
-- ============================================================

-- Owner has all permissions
select ok(public.check_admin_permission('11111111-1111-1111-1111-111111111111', 'catalog.write'), 'owner has catalog.write');
select ok(public.check_admin_permission('11111111-1111-1111-1111-111111111111', 'catalog.publish'), 'owner has catalog.publish');
select ok(public.check_admin_permission('11111111-1111-1111-1111-111111111111', 'usage.adjust'), 'owner has usage.adjust');
select ok(public.check_admin_permission('11111111-1111-1111-1111-111111111111', 'jobs.retry'), 'owner has jobs.retry');
select ok(public.check_admin_permission('11111111-1111-1111-1111-111111111111', 'subscriptions.override'), 'owner has subscriptions.override');

-- Content admin has catalog permissions but not support/usage/jobs
select ok(public.check_admin_permission('33333333-3333-3333-3333-333333333333', 'catalog.write'), 'content_admin has catalog.write');
select ok(public.check_admin_permission('33333333-3333-3333-3333-333333333333', 'catalog.publish'), 'content_admin has catalog.publish');
select ok(not public.check_admin_permission('33333333-3333-3333-3333-333333333333', 'usage.adjust'), 'content_admin lacks usage.adjust');
select ok(not public.check_admin_permission('33333333-3333-3333-3333-333333333333', 'jobs.retry'), 'content_admin lacks jobs.retry');

-- Support has usage/jobs but not catalog.write/publish
select ok(public.check_admin_permission('22222222-2222-2222-2222-222222222222', 'usage.adjust'), 'support has usage.adjust');
select ok(public.check_admin_permission('22222222-2222-2222-2222-222222222222', 'jobs.retry'), 'support has jobs.retry');
select ok(not public.check_admin_permission('22222222-2222-2222-2222-222222222222', 'catalog.write'), 'support lacks catalog.write');
select ok(not public.check_admin_permission('22222222-2222-2222-2222-222222222222', 'catalog.publish'), 'support lacks catalog.publish');

-- Regular user has no permissions
select ok(not public.check_admin_permission('44444444-4444-4444-4444-444444444444', 'catalog.write'), 'regular user lacks catalog.write');

-- ============================================================
-- SECTION 1: PERMISSIONS (14 assertions)
-- ============================================================

select ok((select prosecdef from pg_proc where proname = 'admin_publish_catalog_set'), 'admin_publish_catalog_set is SECURITY DEFINER');
select is((select count(*)::integer from information_schema.routine_privileges where routine_name = 'admin_publish_catalog_set' and grantee = 'anon'), 0, 'anon blocked: publish');
select is(has_function_privilege('service_role', 'public.admin_publish_catalog_set(uuid,uuid,text)', 'execute'), true, 'svc can: publish');
select is(has_function_privilege('authenticated', 'public.admin_publish_catalog_set(uuid,uuid,text)', 'execute'), false, 'authenticated blocked: publish');

-- ============================================================
-- SECTION 2: PUBLISH / UNPUBLISH / ARCHIVE (10 assertions)
-- ============================================================

-- Publish a draft
set local role service_role;
select lives_ok(
  $$select * from public.admin_publish_catalog_set('11111111-1111-1111-1111-111111111111'::uuid, (select id from public.catalog_sets where slug = 'test-mut-set-046'), 'ready to go')$$,
  'owner publishes draft'
);
reset role;

select is((select status from public.catalog_sets where slug = 'test-mut-set-046'), 'published', 'status=published');
select is((select version from public.catalog_sets where slug = 'test-mut-set-046'), 2, 'version=2');
select ok((select published_at is not null from public.catalog_sets where slug = 'test-mut-set-046'), 'published_at set');

-- Already published fails
set local role service_role;
select throws_ok(
  $$select * from public.admin_publish_catalog_set('11111111-1111-1111-1111-111111111111'::uuid, (select id from public.catalog_sets where slug = 'test-mut-set-046'), 'retry')$$,
  '22023', NULL, 'publish already-published fails'
);
reset role;

-- Unpublish
set local role service_role;
select lives_ok(
  $$select * from public.admin_unpublish_catalog_set('11111111-1111-1111-1111-111111111111'::uuid, (select id from public.catalog_sets where slug = 'test-mut-set-046'), 'needs changes')$$,
  'owner unpublishes'
);
reset role;
select is((select status from public.catalog_sets where slug = 'test-mut-set-046'), 'draft', 'unpublished to draft');

-- Not published fails
set local role service_role;
select throws_ok(
  $$select * from public.admin_unpublish_catalog_set('11111111-1111-1111-1111-111111111111'::uuid, (select id from public.catalog_sets where slug = 'test-mut-set-046'), 'reason')$$,
  '22023', NULL, 'unpublish draft fails'
);
reset role;

-- Publish again, then archive
set local role service_role;
select lives_ok(
  $$select * from public.admin_publish_catalog_set('11111111-1111-1111-1111-111111111111'::uuid, (select id from public.catalog_sets where slug = 'test-mut-set-046'), 'republish')$$,
  'republish for archive'
);
select lives_ok(
  $$select * from public.admin_archive_catalog_set('11111111-1111-1111-1111-111111111111'::uuid, (select id from public.catalog_sets where slug = 'test-mut-set-046'), 'archive it')$$,
  'owner archives'
);
reset role;
select is((select status from public.catalog_sets where slug = 'test-mut-set-046'), 'archived', 'status=archived');
select ok((select is_starter = false from public.catalog_sets where slug = 'test-mut-set-046'), 'archived unsets starter');

-- Already archived fails
set local role service_role;
select throws_ok(
  $$select * from public.admin_archive_catalog_set('11111111-1111-1111-1111-111111111111'::uuid, (select id from public.catalog_sets where slug = 'test-mut-set-046'), 'retry')$$,
  '22023', NULL, 'archive already-archived fails'
);
reset role;

-- ============================================================
-- SECTION 3: REASON VALIDATION (2 assertions)
-- ============================================================

set local role service_role;
select throws_ok(
  $$select * from public.admin_publish_catalog_set('11111111-1111-1111-1111-111111111111'::uuid, (select id from public.catalog_sets where slug = 'reason-test-046'), '')$$,
  '22023', NULL, 'empty reason rejected'
);
select throws_ok(
  $$select * from public.admin_adjust_user_usage('11111111-1111-1111-1111-111111111111'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, 'key', 10, '')$$,
  '22023', NULL, 'empty usage reason rejected'
);
reset role;

-- ============================================================
-- SECTION 4: UPDATE METADATA + REPLACE CARDS (8 assertions)
-- ============================================================

set local role service_role;
select lives_ok(
  $$select * from public.admin_update_catalog_set('11111111-1111-1111-1111-111111111111'::uuid, (select id from public.catalog_sets where slug = 'reason-test-046'), 'New Title')$$,
  'owner updates title'
);
reset role;
select is((select title from public.catalog_sets where slug = 'reason-test-046'), 'New Title', 'title updated');

set local role service_role;
select lives_ok(
  $$select * from public.admin_replace_catalog_cards('11111111-1111-1111-1111-111111111111'::uuid, (select id from public.catalog_sets where slug = 'reason-test-046'), '[{"front":"Hello","back":"Xin chào"},{"front":"Bye","back":"Tạm biệt"}]'::jsonb, 'cards')$$,
  'owner replaces cards'
);
reset role;
select is((select count(*)::integer from public.catalog_cards where catalog_set_id = (select id from public.catalog_sets where slug = 'reason-test-046')), 2, 'two cards inserted');

set local role service_role;
select throws_ok(
  $$select * from public.admin_replace_catalog_cards('11111111-1111-1111-1111-111111111111'::uuid, (select id from public.catalog_sets where slug = 'reason-test-046'), (select jsonb_agg(jsonb_build_object('front', 'c' || i, 'back', 'd' || i)) from generate_series(1, 2001) i)::jsonb, 'too many')$$,
  '22023', NULL, 'over 2000 rejected'
);
reset role;

-- ============================================================
-- SECTION 5: USAGE ADJUSTMENT (8 assertions)
-- ============================================================

set local role service_role;
select lives_ok(
  $$select * from public.admin_adjust_user_usage('11111111-1111-1111-1111-111111111111'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, 'ai.content_credits.monthly', 50, 'compensation')$$,
  'adjust usage'
);
reset role;

set local role service_role;
select lives_ok(
  $$select * from public.admin_adjust_user_usage('11111111-1111-1111-1111-111111111111'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, 'ai.content_credits.monthly', 50, 'compensation')$$,
  'idempotent adjust'
);
reset role;
select is((select count(*)::integer from public.usage_ledger where user_id = '44444444-4444-4444-4444-444444444444' and entry_type = 'credit'), 1, 'idempotent: 1 ledger row');

set local role service_role;
select throws_ok(
  $$select * from public.admin_adjust_user_usage('11111111-1111-1111-1111-111111111111'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, 'key', 10001, 'too much')$$,
  '22023', NULL, 'amount > 10000 rejected'
);
select throws_ok(
  $$select * from public.admin_adjust_user_usage('11111111-1111-1111-1111-111111111111'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, 'key', 0, 'zero')$$,
  '22023', NULL, 'zero amount rejected'
);
reset role;

-- Negative works
set local role service_role;
select lives_ok(
  $$select * from public.admin_adjust_user_usage('11111111-1111-1111-1111-111111111111'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, 'ai.content_credits.monthly', -20, 'deduct')$$,
  'negative adjustment works'
);
reset role;
select is((select count(*)::integer from public.usage_ledger where user_id = '44444444-4444-4444-4444-444444444444'), 2, 'two ledger entries (credit + debit)');

-- ============================================================
-- SECTION 6: ENTITLEMENT OVERRIDE (5 assertions)
-- ============================================================

set local role service_role;
select lives_ok(
  $$select * from public.admin_override_user_entitlement('11111111-1111-1111-1111-111111111111'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, 'catalog.install_limit', 'integer', 'override test', 100, null, null, now() + interval '30 days')$$,
  'override entitlement'
);
reset role;
select is((select count(*)::integer from public.entitlement_overrides where user_id = '44444444-4444-4444-4444-444444444444'), 1, 'override row created');

set local role service_role;
select throws_ok(
  $$select * from public.admin_override_user_entitlement('11111111-1111-1111-1111-111111111111'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, 'key', 'integer', 'reason', 5)$$,
  '22023', NULL, 'missing expiry rejected'
);
select throws_ok(
  $$select * from public.admin_override_user_entitlement('11111111-1111-1111-1111-111111111111'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, 'key', 'integer', 'reason', 5, null, null, '2020-01-01T00:00:00Z'::timestamptz)$$,
  '22023', NULL, 'past expiry rejected'
);
reset role;

-- ============================================================
-- SECTION 7: JOB RETRY (7 assertions)
-- ============================================================

set local role service_role;
select lives_ok(
  $$select * from public.admin_retry_processing_job('11111111-1111-1111-1111-111111111111'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'transient error')$$,
  'retry failed job'
);
reset role;
select is((select status from public.processing_jobs where id = 'b1000000-0000-4000-8000-000000000001'), 'queued', 'job queued');
select ok((select error_code is null from public.processing_jobs where id = 'b1000000-0000-4000-8000-000000000001'), 'error_code cleared');

-- Non-failed fails
insert into public.processing_jobs (id, user_id, job_kind, status, correlation_id, idempotency_key)
values ('b3000000-0000-4000-8000-000000000003', '44444444-4444-4444-4444-444444444444', 'paste_generate', 'succeeded', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000013'::uuid)
on conflict (id) do nothing;

set local role service_role;
select throws_ok(
  $$select * from public.admin_retry_processing_job('11111111-1111-1111-1111-111111111111'::uuid, 'b3000000-0000-4000-8000-000000000003'::uuid, 'already done')$$,
  '22023', NULL, 'retrying succeeded fails'
);
-- Note: all valid processing_jobs kinds (paste_generate, document_extract) are in the allowlist.
-- Instead test: retrying an already-retried (now queued) job fails.
select throws_ok(
  $$select * from public.admin_retry_processing_job('11111111-1111-1111-1111-111111111111'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'already retried')$$,
  '22023', NULL, 'retrying queued job fails'
);
reset role;

-- ============================================================
-- SECTION 8: AUDIT LOGGING (7 assertions)
-- ============================================================

select ok((select count(*)::integer from public.admin_audit_logs where action = 'catalog.publish') > 0, 'audit: catalog.publish exists');
select ok((select count(*)::integer from public.admin_audit_logs where action = 'catalog.archive') > 0, 'audit: catalog.archive exists');
select ok((select count(*)::integer from public.admin_audit_logs where action = 'usage.adjust') > 0, 'audit: usage.adjust exists');
select ok((select count(*)::integer from public.admin_audit_logs where action = 'entitlement.override') > 0, 'audit: entitlement.override exists');
select ok((select count(*)::integer from public.admin_audit_logs where action = 'job.retry') > 0, 'audit: job.retry exists');
select is((select actor from public.admin_audit_logs where action = 'catalog.publish' order by created_at desc limit 1), '11111111-1111-1111-1111-111111111111'::uuid, 'audit actor correct');
select ok((select after_summary->>'version' from public.admin_audit_logs where action = 'catalog.publish' order by created_at desc limit 1) is not null, 'audit after_summary has version');

-- ============================================================
-- SECTION 9: PERMISSION DENIED (8 assertions)
-- ============================================================

-- Regular user (no admin role) — use perm-test-046 set (not archived)
set local role service_role;
select throws_ok(
  $$select * from public.admin_publish_catalog_set('44444444-4444-4444-4444-444444444444'::uuid, (select id from public.catalog_sets where slug = 'perm-test-046'), 'hacked')$$,
  '42501', 'permission denied', 'regular user blocked: publish'
);
select throws_ok(
  $$select * from public.admin_adjust_user_usage('44444444-4444-4444-4444-444444444444'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'key', 100, 'hacked')$$,
  '42501', 'permission denied', 'regular user blocked: adjust'
);
select throws_ok(
  $$select * from public.admin_retry_processing_job('44444444-4444-4444-4444-444444444444'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'hacked')$$,
  '42501', 'permission denied', 'regular user blocked: retry'
);
reset role;

-- Support cannot publish (no catalog.publish)
set local role service_role;
select throws_ok(
  $$select * from public.admin_publish_catalog_set('22222222-2222-2222-2222-222222222222'::uuid, (select id from public.catalog_sets where slug = 'perm-test-046'), 'nope')$$,
  '42501', 'permission denied', 'support blocked: publish'
);
reset role;

-- Content admin CAN publish
set local role service_role;
select lives_ok(
  $$select * from public.admin_publish_catalog_set('33333333-3333-3333-3333-333333333333'::uuid, (select id from public.catalog_sets where slug = 'perm-test-046'), 'content admin publish')$$,
  'content_admin can publish'
);
reset role;

-- ============================================================
-- SECTION 10: NULL TARGET VALIDATION (5 assertions)
-- ============================================================

set local role service_role;
select throws_ok(
  $$select * from public.admin_publish_catalog_set('11111111-1111-1111-1111-111111111111'::uuid, null, 'reason')$$,
  '22023', NULL, 'null set_id rejected'
);
select throws_ok(
  $$select * from public.admin_adjust_user_usage('11111111-1111-1111-1111-111111111111'::uuid, null, 'key', 10, 'reason')$$,
  '22023', NULL, 'null target rejected'
);
select throws_ok(
  $$select * from public.admin_retry_processing_job('11111111-1111-1111-1111-111111111111'::uuid, null, 'reason')$$,
  '22023', NULL, 'null job_id rejected'
);
select throws_ok(
  $$select * from public.admin_publish_catalog_set('11111111-1111-1111-1111-111111111111'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'reason')$$,
  'P0002', NULL, 'unknown set rejected'
);
select throws_ok(
  $$select * from public.admin_retry_processing_job('11111111-1111-1111-1111-111111111111'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'reason')$$,
  'P0002', NULL, 'unknown job rejected'
);
reset role;

-- ============================================================
-- SECTION 11: USER CLONE NOT MUTATED (1 assertion)
-- ============================================================

select is((select count(*)::integer from public.flashcard_sets where name = 'TestMutSet046'), 0, 'catalog mutations do not create user sets');

select * from finish();
rollback;
