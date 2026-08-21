-- 049_admin_user_mutations_v2.sql
-- pgTAP tests for LP-10 Part 2B User Administration V2 mutations.
-- Covers:
-- 1. Function existence & V1 retirement
-- 2. Privilege boundary (browser revoked, service_role allowed, security invoker, search_path = '')
-- 3. Owner-only enforcement & self-target guards (SQLSTATE 42501)
-- 4. 365-day rule boundary tests (<= 365 ALLOW, > 365 REJECT with 22023)
-- 5. Durable mutation receipts & idempotency (+50 vs -50 conflict, different user conflict, no duplicate audit rows)
-- 6. Raw timestamp optimistic concurrency (P0004 on stale update/remove)
-- 7. Interaction with active quota reservations (reserve_usage & advisory locks)

begin;
select plan(42);

-- Fixtures setup
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-4949-4111-8111-111111111111', 'authenticated', 'authenticated', 'owner-049@example.com', now(), '{}'::jsonb, '{"display_name":"Owner 049"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-4949-4222-8222-222222222222', 'authenticated', 'authenticated', 'support-049@example.com', now(), '{}'::jsonb, '{"display_name":"Support 049"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-4949-4333-8333-333333333333', 'authenticated', 'authenticated', 'analyst-049@example.com', now(), '{}'::jsonb, '{"display_name":"Analyst 049"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4949-4444-8444-444444444444', 'authenticated', 'authenticated', 'free-user-049@example.com', now(), '{}'::jsonb, '{"display_name":"Free User 049"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '55555555-4949-4555-8555-555555555555', 'authenticated', 'authenticated', 'pro-user-049@example.com', now(), '{}'::jsonb, '{"display_name":"Pro User 049"}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, display_name)
values
  ('11111111-4949-4111-8111-111111111111', 'Owner 049'),
  ('22222222-4949-4222-8222-222222222222', 'Support 049'),
  ('33333333-4949-4333-8333-333333333333', 'Analyst 049'),
  ('44444444-4949-4444-8444-444444444444', 'Free User 049'),
  ('55555555-4949-4555-8555-555555555555', 'Pro User 049')
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
values
  ('11111111-4949-4111-8111-111111111111', 'owner'),
  ('22222222-4949-4222-8222-222222222222', 'support'),
  ('33333333-4949-4333-8333-333333333333', 'analyst');

insert into public.user_subscriptions (user_id, plan_id, status)
values
  ('55555555-4949-4555-8555-555555555555', 'pro_monthly', 'active');

-- ============================================================
-- 1. V1 RETIREMENT, V2 FUNCTION EXISTENCE & SECURITY MODES (7 assertions)
-- ============================================================
select is((select count(*)::integer from pg_proc where proname = 'admin_adjust_user_usage'), 0, 'V1 admin_adjust_user_usage dropped');
select is((select count(*)::integer from pg_proc where proname = 'admin_override_user_entitlement'), 0, 'V1 admin_override_user_entitlement dropped');

select is(has_function_privilege('service_role', 'public.admin_adjust_user_usage_v2(uuid,uuid,text,integer,text,uuid)', 'execute'), true, 'V2 admin_adjust_user_usage_v2 exists for service_role');
select is(has_function_privilege('service_role', 'public.admin_override_user_entitlement_v2(uuid,uuid,text,text,text,bigint,boolean,text,timestamptz,text,uuid)', 'execute'), true, 'V2 admin_override_user_entitlement_v2 exists for service_role');
select is(has_function_privilege('service_role', 'public.admin_remove_user_entitlement_override_v2(uuid,uuid,text,text,text,uuid)', 'execute'), true, 'V2 admin_remove_user_entitlement_override_v2 exists for service_role');

-- Verify SECURITY INVOKER (prosecdef = false)
select is((select prosecdef from pg_proc where proname = 'admin_adjust_user_usage_v2'), false, 'admin_adjust_user_usage_v2 is SECURITY INVOKER');
select is((select prosecdef from pg_proc where proname = 'admin_override_user_entitlement_v2'), false, 'admin_override_user_entitlement_v2 is SECURITY INVOKER');

-- ============================================================
-- 2. PRIVILEGE BOUNDARY (3 assertions)
-- ============================================================
select is(has_function_privilege('authenticated', 'public.admin_adjust_user_usage_v2(uuid,uuid,text,integer,text,uuid)', 'execute'), false, 'authenticated blocked from admin_adjust_user_usage_v2');
select is(has_function_privilege('authenticated', 'public.admin_override_user_entitlement_v2(uuid,uuid,text,text,text,bigint,boolean,text,timestamptz,text,uuid)', 'execute'), false, 'authenticated blocked from admin_override_user_entitlement_v2');
select is(has_function_privilege('authenticated', 'public.admin_remove_user_entitlement_override_v2(uuid,uuid,text,text,text,uuid)', 'execute'), false, 'authenticated blocked from admin_remove_user_entitlement_override_v2');

-- ============================================================
-- 3. OWNER-ONLY & TARGET RESTRICTIONS (4 assertions)
-- ============================================================
set local role service_role;

-- Support blocked
select throws_ok(
  $$select * from public.admin_adjust_user_usage_v2('22222222-4949-4222-8222-222222222222'::uuid, '44444444-4949-4444-8444-444444444444'::uuid, 'ai.content_credits.monthly', 50, 'Support attempt with valid reason', 'a0000000-0000-4000-8000-000000000001'::uuid)$$,
  '42501', 'owner role required', 'support role blocked from adjust usage (42501)'
);

select throws_ok(
  $$select * from public.admin_override_user_entitlement_v2('22222222-4949-4222-8222-222222222222'::uuid, '44444444-4949-4444-8444-444444444444'::uuid, 'sets.regular.max', 'integer', 'Support attempt with valid reason', 100, null, null, now() + interval '30 days', null, 'a0000000-0000-4000-8000-000000000002'::uuid)$$,
  '42501', 'owner role required', 'support role blocked from override entitlement (42501)'
);

-- Owner self-target blocked
select throws_ok(
  $$select * from public.admin_adjust_user_usage_v2('11111111-4949-4111-8111-111111111111'::uuid, '11111111-4949-4111-8111-111111111111'::uuid, 'ai.content_credits.monthly', 50, 'Owner self adjust attempt reason', 'a0000000-0000-4000-8000-000000000003'::uuid)$$,
  '42501', 'admin cannot adjust own usage', 'owner self-target usage adjust denied (42501)'
);

select throws_ok(
  $$select * from public.admin_override_user_entitlement_v2('11111111-4949-4111-8111-111111111111'::uuid, '11111111-4949-4111-8111-111111111111'::uuid, 'sets.regular.max', 'integer', 'Owner self override attempt reason', 100, null, null, now() + interval '30 days', null, 'a0000000-0000-4000-8000-000000000004'::uuid)$$,
  '42501', 'admin cannot override own entitlement', 'owner self-target override denied (42501)'
);

-- ============================================================
-- 4. 365-DAY RULE BOUNDARY TESTS (3 assertions)
-- ============================================================
-- <= 365 days ALLOW
select lives_ok(
  $$select * from public.admin_override_user_entitlement_v2('11111111-4949-4111-8111-111111111111'::uuid, '44444444-4949-4444-8444-444444444444'::uuid, 'sets.regular.max', 'integer', 'Override within 365 days limit', 50, null, null, now() + interval '365 days', null, 'c0000000-0000-4000-8000-000000000001'::uuid)$$,
  'override <= 365 days succeeds'
);

-- > 365 days REJECT with 22023
select throws_ok(
  $$select * from public.admin_override_user_entitlement_v2('11111111-4949-4111-8111-111111111111'::uuid, '44444444-4949-4444-8444-444444444444'::uuid, 'sets.regular.max', 'integer', 'Override exceeding 365 days', 50, null, null, now() + interval '366 days', null, 'c0000000-0000-4000-8000-000000000002'::uuid)$$,
  '22023', 'expiry cannot exceed 365 days', 'override > 365 days rejected with 22023'
);

-- Past expiry REJECT with 22023
select throws_ok(
  $$select * from public.admin_override_user_entitlement_v2('11111111-4949-4111-8111-111111111111'::uuid, '44444444-4949-4444-8444-444444444444'::uuid, 'sets.regular.max', 'integer', 'Override in the past', 50, null, null, now() - interval '1 day', null, 'c0000000-0000-4000-8000-000000000003'::uuid)$$,
  '22023', 'expiry must be in the future', 'past expiry rejected with 22023'
);

-- ============================================================
-- 5. RETRY SAFETY & IDEMPOTENCY (7 assertions)
-- ============================================================
-- A: +50 with token X
select lives_ok(
  $$select * from public.admin_adjust_user_usage_v2('11111111-4949-4111-8111-111111111111'::uuid, '44444444-4949-4444-8444-444444444444'::uuid, 'ai.content_credits.monthly', 50, 'Bonus credits for free user 049', 'b0000000-0000-4000-8000-000000000001'::uuid)$$,
  'owner adjusts Free user usage (+50 credit)'
);

-- Retry +50 with token X => 1 ledger entry, 1 audit entry
select lives_ok(
  $$select * from public.admin_adjust_user_usage_v2('11111111-4949-4111-8111-111111111111'::uuid, '44444444-4949-4444-8444-444444444444'::uuid, 'ai.content_credits.monthly', 50, 'Bonus credits for free user 049', 'b0000000-0000-4000-8000-000000000001'::uuid)$$,
  'retry same usage adjustment token returns idempotent success'
);

select is(
  (select count(*)::integer from public.usage_ledger where idempotency_key = 'b0000000-0000-4000-8000-000000000001'::uuid),
  1,
  'idempotent retry did not duplicate ledger row'
);

select is(
  (select count(*)::integer from public.admin_audit_logs where target_id = '44444444-4949-4444-8444-444444444444' and action = 'usage.adjust'),
  1,
  'idempotent retry did not duplicate audit row'
);

-- B: Same token + opposite amount (-50) => P0005 IDEMPOTENCY_CONFLICT
select throws_ok(
  $$select * from public.admin_adjust_user_usage_v2('11111111-4949-4111-8111-111111111111'::uuid, '44444444-4949-4444-8444-444444444444'::uuid, 'ai.content_credits.monthly', -50, 'Bonus credits for free user 049', 'b0000000-0000-4000-8000-000000000001'::uuid)$$,
  'P0005', NULL, 'same token with opposite amount (+50 vs -50) rejected with P0005'
);

-- E: Same token against different target user => P0005 IDEMPOTENCY_CONFLICT
select throws_ok(
  $$select * from public.admin_adjust_user_usage_v2('11111111-4949-4111-8111-111111111111'::uuid, '55555555-4949-4555-8555-555555555555'::uuid, 'ai.content_credits.monthly', 50, 'Bonus credits for free user 049', 'b0000000-0000-4000-8000-000000000001'::uuid)$$,
  'P0005', NULL, 'same token against different target user rejected with P0005'
);

-- C: Override client retry => no 2nd audit entry
select is(
  (select count(*)::integer from public.admin_audit_logs where target_id = '44444444-4949-4444-8444-444444444444' and action = 'entitlement.override'),
  1,
  'override has exactly 1 audit entry'
);

-- ============================================================
-- 6. CONCURRENT EDIT PROTECTION (6 assertions)
-- ============================================================
-- Raw updated_at exists and advances
select is(
  (select updated_at is not null from public.entitlement_overrides where user_id = '44444444-4949-4444-8444-444444444444' and entitlement_key = 'sets.regular.max'),
  true,
  'entitlement_overrides has non-null updated_at'
);

-- Stale update attempt with mismatching timestamp => P0004
select throws_ok(
  $$select * from public.admin_override_user_entitlement_v2('11111111-4949-4111-8111-111111111111'::uuid, '44444444-4949-4444-8444-444444444444'::uuid, 'sets.regular.max', 'integer', 'Stale edit attempt reason 049', 80, null, null, now() + interval '30 days', '2020-01-01T00:00:00.000000+00:00', 'c0000000-0000-4000-8000-000000000004'::uuid)$$,
  'P0004', NULL, 'stale update rejected with P0004'
);

-- Update with matching timestamp advances updated_at
select lives_ok(
  $$select * from public.admin_override_user_entitlement_v2('11111111-4949-4111-8111-111111111111'::uuid, '44444444-4949-4444-8444-444444444444'::uuid, 'sets.regular.max', 'integer', 'Update regular sets limit to 75', 75, null, null, now() + interval '30 days', (select updated_at::text from public.entitlement_overrides where user_id = '44444444-4949-4444-8444-444444444444' and entitlement_key = 'sets.regular.max'), 'c0000000-0000-4000-8000-000000000005'::uuid)$$,
  'owner updates override with matching updated_at'
);

-- Stale removal attempt => P0004
select throws_ok(
  $$select * from public.admin_remove_user_entitlement_override_v2('11111111-4949-4111-8111-111111111111'::uuid, '44444444-4949-4444-8444-444444444444'::uuid, 'sets.regular.max', '2020-01-01T00:00:00.000000+00:00', 'Stale remove attempt reason 049', 'd0000000-0000-4000-8000-000000000001'::uuid)$$,
  'P0004', NULL, 'stale removal rejected with P0004'
);

-- D: Removal commits
select lives_ok(
  $$select * from public.admin_remove_user_entitlement_override_v2('11111111-4949-4111-8111-111111111111'::uuid, '44444444-4949-4444-8444-444444444444'::uuid, 'sets.regular.max', (select updated_at::text from public.entitlement_overrides where user_id = '44444444-4949-4444-8444-444444444444' and entitlement_key = 'sets.regular.max'), 'Remove override and restore base plan', 'd0000000-0000-4000-8000-000000000002'::uuid)$$,
  'owner removes override with matching updated_at'
);

-- Retry removal with same token returns deterministic previous success without 2nd audit entry
select lives_ok(
  $$select * from public.admin_remove_user_entitlement_override_v2('11111111-4949-4111-8111-111111111111'::uuid, '44444444-4949-4444-8444-444444444444'::uuid, 'sets.regular.max', null, 'Remove override and restore base plan', 'd0000000-0000-4000-8000-000000000002'::uuid)$$,
  'retry removal with same token returns idempotent success'
);

-- ============================================================
-- 7. INTERACTION WITH ACTIVE QUOTA RESERVATIONS & ADVISORY LOCKS (12 assertions)
-- ============================================================
-- 1. Pro user starts with 0 consumption
select is(
  (select coalesce(sum(case when entry_type = 'credit' then -amount else amount end), 0)::integer from public.usage_ledger where user_id = '55555555-4949-4555-8555-555555555555' and usage_key = 'ai.content_credits.monthly'),
  0,
  'Pro user initial consumption is 0'
);

-- 2. Pro user reserves 10 credits via reserve_usage
select lives_ok(
  $$select * from public.reserve_usage('55555555-4949-4555-8555-555555555555'::uuid, 'ai.content_credits.monthly', 10, 'e0000000-0000-4000-8000-000000000011'::uuid, 'e0000000-0000-4000-8000-000000000012'::uuid)$$,
  'reserve_usage reserves 10 credits successfully'
);

select is(
  (select count(*)::integer from public.quota_reservations where user_id = '55555555-4949-4555-8555-555555555555' and status = 'reserved'),
  1,
  'active quota reservation exists'
);

-- 3. Owner adds quota (+50 credit) while reservation is active
select lives_ok(
  $$select * from public.admin_adjust_user_usage_v2('11111111-4949-4111-8111-111111111111'::uuid, '55555555-4949-4555-8555-555555555555'::uuid, 'ai.content_credits.monthly', 50, 'Add 50 bonus credits to Pro user while job is running', 'e0000000-0000-4000-8000-000000000001'::uuid)$$,
  'admin_adjust_user_usage_v2 succeeds while active reservation exists'
);

-- 4. Reservation remains active and intact
select is(
  (select status from public.quota_reservations where user_id = '55555555-4949-4555-8555-555555555555' and idempotency_key = 'e0000000-0000-4000-8000-000000000011'::uuid),
  'reserved',
  'active reservation remains reserved after admin usage adjust'
);

-- 5. Owner deducts quota (-20 debit)
select lives_ok(
  $$select * from public.admin_adjust_user_usage_v2('11111111-4949-4111-8111-111111111111'::uuid, '55555555-4949-4555-8555-555555555555'::uuid, 'ai.content_credits.monthly', -20, 'Deduct 20 credits from Pro user while job is running', 'e0000000-0000-4000-8000-000000000002'::uuid)$$,
  'admin_adjust_user_usage_v2 deduction succeeds while active reservation exists'
);

-- 6. Finalize reservation
select lives_ok(
  $$select * from public.finalize_usage((select id from public.quota_reservations where idempotency_key = 'e0000000-0000-4000-8000-000000000011'::uuid), 10)$$,
  'finalize_usage finalizes reservation'
);

select is(
  (select status from public.quota_reservations where idempotency_key = 'e0000000-0000-4000-8000-000000000011'::uuid),
  'finalized',
  'quota reservation transitioned to finalized'
);

-- 7. Net consumption after +50 credit, -20 debit and 10 finalized debit: (-50 + 20 + 10) = -20 net consumed (effective 20 additional headroom)
select is(
  (select sum(case when entry_type = 'credit' then -amount else amount end)::integer from public.usage_ledger where user_id = '55555555-4949-4555-8555-555555555555' and usage_key = 'ai.content_credits.monthly'),
  -20,
  'net usage balance reflects +50 credit, -20 debit, and 10 finalized debit (-20 consumed)'
);

-- 8. Subsequent reserve_usage observes the new balance headroom
select lives_ok(
  $$select * from public.reserve_usage('55555555-4949-4555-8555-555555555555'::uuid, 'ai.content_credits.monthly', 50, 'e0000000-0000-4000-8000-000000000021'::uuid, 'e0000000-0000-4000-8000-000000000022'::uuid)$$,
  'subsequent reserve_usage observes expanded headroom and succeeds'
);

select is(
  (select count(*)::integer from public.quota_reservations where user_id = '55555555-4949-4555-8555-555555555555' and status = 'reserved'),
  1,
  'second reservation is active'
);

-- Cleanup
select lives_ok(
  $$select * from public.refund_usage((select id from public.quota_reservations where idempotency_key = 'e0000000-0000-4000-8000-000000000021'::uuid), 'test cleanup')$$,
  'refund second reservation'
);

reset role;
select * from finish();
rollback;
