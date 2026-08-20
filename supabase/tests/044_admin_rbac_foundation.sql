-- LP-09 part 1: admin RBAC foundation tests.
-- RLS/grants, role lifecycle, last-owner invariant, audit append-only.

begin;
select plan(42);

-- fixtures ---------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'rbac.owner@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'rbac.user@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'authenticated', 'authenticated', 'rbac.user2@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

-- schema checks -----------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.user_roles'::regclass), 'user_roles enables RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.admin_audit_logs'::regclass), 'admin_audit_logs enables RLS');
select is(has_table_privilege('authenticated', 'public.user_roles', 'insert'), false, 'authenticated cannot insert user_roles');
select is(has_table_privilege('authenticated', 'public.user_roles', 'update'), false, 'authenticated cannot update user_roles');
select is(has_table_privilege('authenticated', 'public.user_roles', 'select'), false, 'authenticated cannot select user_roles directly');
select is(has_table_privilege('authenticated', 'public.admin_audit_logs', 'select'), false, 'authenticated cannot read audit logs');
select is(has_table_privilege('authenticated', 'public.admin_audit_logs', 'insert'), false, 'authenticated cannot insert audit logs');
select is(has_table_privilege('anon', 'public.user_roles', 'select'), false, 'anon cannot read user_roles');
select is(has_function_privilege('authenticated', 'public.grant_admin_role(uuid,text,text,uuid)', 'execute'), true, 'authenticated can call grant RPC (role checked inside)');
select is(has_function_privilege('authenticated', 'public.revoke_admin_role(uuid,text,text,uuid)', 'execute'), true, 'authenticated can call revoke RPC (role checked inside)');
select is(has_function_privilege('authenticated', 'public.get_effective_admin_roles(uuid)', 'execute'), false, 'authenticated cannot read roles via service RPC');
select is(has_function_privilege('service_role', 'public.get_effective_admin_roles(uuid)', 'execute'), true, 'service role can read roles via RPC');

-- role constraint ----------------------------------------------------------
select throws_ok(
  'insert into public.user_roles (user_id, role) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''super_admin'')',
  '23514', NULL, 'unknown role is rejected'
);
select throws_ok(
  'insert into public.user_roles (user_id, role) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''owner''), (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''owner'')',
  '23505', NULL, 'duplicate active owner grant is rejected'
);

-- bootstrap and grant lifecycle through trusted RPC --------------------------
-- The first owner is bootstrapped by a direct service-role insert (this is the
-- documented out-of-band bootstrap path). After that, all role changes go
-- through the trusted RPC with a verified JWT actor.
insert into public.user_roles (user_id, role, created_by)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select is((select count(*)::integer from public.user_roles where role = 'owner' and revoked_at is null), 1, 'bootstrap owner is active');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok(
  $$select * from public.grant_admin_role('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'support', 'support staff')$$,
  'owner grants support role'
);
reset role;
select is((select count(*)::integer from public.user_roles where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and revoked_at is null), 1, 'support grant is active');

-- non-owner cannot grant (forge actor fails) --------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select throws_ok(
  $$select * from public.grant_admin_role('cccccccc-cccc-cccc-cccc-cccccccccccc', 'owner', 'self escalation')$$,
  '42501', 'roles.manage permission required', 'non-owner cannot grant a role'
);
select throws_ok(
  $$select * from public.revoke_admin_role('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', 'self escalation')$$,
  '42501', 'roles.manage permission required', 'non-owner cannot revoke a role'
);
reset role;

-- direct insert by authenticated fails (client cannot self-grant) -----------
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select throws_ok(
  'insert into public.user_roles (user_id, role) values (''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', ''owner'')',
  '42501', NULL, 'authenticated cannot self-grant via direct insert'
);
select throws_ok(
  'insert into public.admin_audit_logs (actor, action, target_type, target_id, reason) values (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''role.grant'', ''user'', ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', ''direct'')',
  '42501', NULL, 'authenticated cannot write audit directly'
);
reset role;

-- grant RPC wrote an audited trail ------------------------------------------
select is((select count(*)::integer from public.admin_audit_logs where action = 'role.grant'), 1, 'grant RPC wrote one audit row');
select is((select actor from public.admin_audit_logs where action = 'role.grant'), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'audit actor is the acting owner');
select is((select reason from public.admin_audit_logs where action = 'role.grant'), 'support staff', 'audit records the reason');

-- audit append-only: no UPDATE/DELETE even for service role ------------------
set local role service_role;
select throws_ok(
  'update public.admin_audit_logs set reason = ''tampered''',
  '42501', 'admin audit log is append-only', 'service role cannot update audit'
);
select throws_ok(
  'delete from public.admin_audit_logs',
  '42501', 'admin audit log is append-only', 'service role cannot delete audit'
);
select throws_ok(
  'delete from public.user_roles',
  '42501', 'admin roles must be revoked, not deleted', 'admin role rows cannot be hard-deleted'
);
reset role;

-- revoked role loses effectiveness ------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok(
  $$select * from public.revoke_admin_role('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'support', 'no longer needed')$$,
  'owner revokes support role'
);
reset role;
select is((select count(*)::integer from public.user_roles where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and revoked_at is null), 0, 'revoked role is no longer active');
select is((select count(*)::integer from public.user_roles where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 1, 'revoked row remains for audit history');
select is((select role from public.get_effective_admin_roles('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')), null, 'revoked role not returned by effective roles');

-- re-grant after revoke -------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok(
  $$select * from public.grant_admin_role('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'support', 'support restored')$$,
  'owner re-grants support after revoke'
);
reset role;
select is((select count(*)::integer from public.user_roles where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and revoked_at is null), 1, 're-granted support is active');

-- last-owner invariant ---------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select throws_ok(
  $$select * from public.revoke_admin_role('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', 'leaving')$$,
  'P0001', 'cannot revoke the last owner', 'owner cannot revoke the last active owner'
);
select lives_ok(
  $$select * from public.grant_admin_role('cccccccc-cccc-cccc-cccc-cccccccccccc', 'owner', 'second owner')$$,
  'owner grants a second owner'
);
select lives_ok(
  $$select * from public.revoke_admin_role('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', 'handover')$$,
  'owner can revoke one owner when another remains'
);
reset role;
select is((select count(*)::integer from public.user_roles where role = 'owner' and revoked_at is null), 1, 'one owner remains after handover');
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select throws_ok(
  $$select * from public.revoke_admin_role('cccccccc-cccc-cccc-cccc-cccccccccccc', 'owner', 'leaving')$$,
  'P0001', 'cannot revoke the last owner', 'final remaining owner cannot be revoked'
);
reset role;

-- audit redaction: no sensitive payload columns allowed -------------------------
select is((select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name = 'admin_audit_logs' and column_name in ('password','access_token','refresh_token','api_key','secret','card_front','card_back')), 0, 'audit log has no sensitive columns');
select is((select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name = 'user_roles' and column_name in ('password','access_token','refresh_token','api_key','secret')), 0, 'user_roles has no sensitive columns');

-- audit read requires service role (permission enforced server-side) ------------
select is((select count(*)::integer from public.get_admin_audit_logs(100)), (select count(*)::integer from public.admin_audit_logs), 'service role can read all audit rows');
select is((select action from public.get_admin_audit_logs(1, null, null, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')), 'role.revoke', 'audit read filters by actor');

select * from finish();
rollback;