-- LP-09 part 2: admin owner bootstrap + role mutation hardening tests.

begin;
select plan(43);

-- fixtures ---------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'bootstrap.owner@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'bootstrap.unconfirmed@example.test', null, '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'authenticated', 'authenticated', 'bootstrap.user@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'authenticated', 'authenticated', 'bootstrap.operator@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

-- email resolver ------------------------------------------------------------
select is((select user_id from public.get_admin_user_by_email('BOOTSTRAP.OWNER@example.test')), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'resolver is case-insensitive on email');
select is((select count(*)::integer from public.get_admin_user_by_email('missing@example.test')), 0, 'resolver returns no row for unknown email');
select is((select email_confirmed_at from public.get_admin_user_by_email('bootstrap.unconfirmed@example.test')), null, 'resolver reports unconfirmed email');
select is((select is_active_owner from public.get_admin_user_by_email('bootstrap.owner@example.test')), false, 'resolver reports not-yet-owner');

-- bootstrap: unknown user fails ----------------------------------------------
set local role service_role;
select throws_ok(
  $$select * from public.bootstrap_owner('missing@example.test', 'bootstrap owner')$$,
  'P0002', 'user not found', 'bootstrap refuses an unknown email'
);
select is((select count(*)::integer from public.user_roles), 0, 'no role rows written after unknown-user failure');
select is((select count(*)::integer from public.admin_audit_logs), 0, 'no audit rows written after unknown-user failure');

-- bootstrap: unconfirmed user fails ------------------------------------------
select throws_ok(
  $$select * from public.bootstrap_owner('bootstrap.unconfirmed@example.test', 'bootstrap owner')$$,
  'P0002', 'user email is not confirmed', 'bootstrap refuses an unconfirmed email'
);
select is((select count(*)::integer from public.user_roles), 0, 'no role rows written after unconfirmed failure');
select is((select count(*)::integer from public.admin_audit_logs), 0, 'no audit rows written after unconfirmed failure');

-- bootstrap: first owner succeeds and is audited ------------------------------
select lives_ok(
  $$select * from public.bootstrap_owner('bootstrap.owner@example.test', 'first owner bootstrap', '00000000-0000-4000-8000-000000000099', 'dddddddd-dddd-dddd-dddd-dddddddddddd')$$,
  'first owner bootstrap succeeds'
);
select is((select count(*)::integer from public.user_roles where role = 'owner' and revoked_at is null), 1, 'one active owner after bootstrap');
select is((select created_by from public.user_roles where role = 'owner'), 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'owner row records the operator actor');
select is((select action from public.admin_audit_logs), 'role.bootstrap', 'audit action is role.bootstrap');
select is((select actor from public.admin_audit_logs where action = 'role.bootstrap'), 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'audit actor is the operator');
select is((select target_id from public.admin_audit_logs where action = 'role.bootstrap'), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'audit target is the owner user id');
select is((select reason from public.admin_audit_logs where action = 'role.bootstrap'), 'first owner bootstrap', 'audit records the reason');
select is((select correlation_id::text from public.admin_audit_logs where action = 'role.bootstrap'), '00000000-0000-4000-8000-000000000099', 'audit records the correlation id');
select is((select after_summary->>'role' from public.admin_audit_logs where action = 'role.bootstrap'), 'owner', 'audit after_summary records role');

-- bootstrap: rerun is idempotent ----------------------------------------------
select lives_ok(
  $$select * from public.bootstrap_owner('bootstrap.owner@example.test', 'retry owner bootstrap')$$,
  'bootstrap rerun is idempotent'
);
select is((select count(*)::integer from public.user_roles where role = 'owner' and revoked_at is null), 1, 'rerun does not create a second owner row');
select is((select action from public.admin_audit_logs order by created_at desc limit 1), 'role.bootstrap.idempotent', 'rerun writes role.bootstrap.idempotent audit');

-- bootstrap: refuses once another owner exists --------------------------------
select throws_ok(
  $$select * from public.bootstrap_owner('bootstrap.user@example.test', 'second owner via bootstrap')$$,
  'P0001', 'owner already bootstrapped; use the audited grant flow', 'bootstrap cannot be used to add a second owner'
);
select is((select count(*)::integer from public.user_roles where user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'), 0, 'second owner not created');

-- authenticated user cannot call bootstrap -------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select throws_ok(
  $$select * from public.bootstrap_owner('bootstrap.user@example.test', 'browser escalation')$$,
  '42501', NULL, 'authenticated user cannot call bootstrap RPC'
);
select throws_ok(
  $$select * from public.get_admin_user_by_email('bootstrap.user@example.test')$$,
  '42501', NULL, 'authenticated user cannot read admin email resolver'
);
reset role;

-- audited grant/revoke mutation workflow --------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok(
  $$select * from public.grant_admin_role('cccccccc-cccc-cccc-cccc-cccccccccccc', 'support', 'support staff')$$,
  'owner grants support role'
);
reset role;
select is((select count(*)::integer from public.user_roles where user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and revoked_at is null), 1, 'support grant active');

-- forged actor cannot revoke ----------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select throws_ok(
  $$select * from public.revoke_admin_role('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', 'self escalation')$$,
  '42501', 'roles.manage permission required', 'support cannot revoke owner'
);
reset role;

-- revoke via authenticated owner, then retry is idempotent ----------------------
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok(
  $$select * from public.revoke_admin_role('cccccccc-cccc-cccc-cccc-cccccccccccc', 'support', 'no longer needed')$$,
  'owner revokes support'
);
reset role;
select is((select count(*)::integer from public.user_roles where user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and revoked_at is null), 0, 'support role is inactive after revoke');
select is((select action from public.admin_audit_logs order by created_at desc limit 1), 'role.revoke', 'revoke is audited');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok(
  $$select * from public.revoke_admin_role('cccccccc-cccc-cccc-cccc-cccccccccccc', 'support', 'retry revoke')$$,
  'retrying revoke is idempotent'
);
reset role;
select is((select count(*)::integer from public.user_roles where user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and revoked_at is null), 0, 'retry does not change role state');
select is((select action from public.admin_audit_logs order by created_at desc limit 1), 'role.revoke.idempotent', 'retry revoke writes role.revoke.idempotent audit');

-- revoked role loses effective permission (resolver) -----------------------------
set local role service_role;
select is((select count(*)::integer from public.get_effective_admin_roles('cccccccc-cccc-cccc-cccc-cccccccccccc')), 0, 'revoked support yields no effective roles');
select is((select role from public.get_effective_admin_roles('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')), 'owner', 'bootstrap owner yields owner role');
reset role;

-- last-owner invariant after bootstrap ------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select throws_ok(
  $$select * from public.revoke_admin_role('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', 'leaving')$$,
  'P0001', 'cannot revoke the last owner', 'last active owner cannot be revoked after bootstrap'
);
reset role;

-- audit append-only still holds ---------------------------------------------------
set local role service_role;
select throws_ok(
  'delete from public.admin_audit_logs',
  '42501', 'admin audit log is append-only', 'audit remains append-only'
);
select throws_ok(
  'update public.user_roles set role = ''owner''',
  '42501', 'admin roles cannot be modified; revoke and re-grant instead', 'roles cannot be silently escalated'
);
reset role;

-- fail-closed on service-role errors is enforced in the server layer ---------------
-- (covered by unit tests); here we assert the resolver/RPC surface stays locked down.
set local role service_role;
select is(has_function_privilege('authenticated', 'public.bootstrap_owner(text,text,uuid,uuid)', 'execute'), false, 'bootstrap is not callable by authenticated');
select is(has_function_privilege('authenticated', 'public.get_admin_user_by_email(text)', 'execute'), false, 'email resolver is not callable by authenticated');
select is(has_function_privilege('anon', 'public.bootstrap_owner(text,text,uuid,uuid)', 'execute'), false, 'bootstrap is not callable by anon');
reset role;

select * from finish();
rollback;