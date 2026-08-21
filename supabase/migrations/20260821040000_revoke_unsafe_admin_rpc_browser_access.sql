-- ============================================================
-- LP-10 SECURITY RECOVERY (forward-only corrective migration)
--
--  20260821040000_revoke_unsafe_admin_rpc_browser_access.sql
--
-- Context: the 8 admin mutation RPCs created by 20260821010000 /
-- 20260821020000 were granted EXECUTE to PUBLIC/anon/authenticated.
-- An independent security review found they trust a client-supplied
--   p_actor_user_id without auth.uid() binding, so any authenticated
--   user who knows an admin UUID could invoke them and impersonate
--   that actor (privilege escalation + audit forgery).
--
-- This migration ONLY revokes browser-accessible execution from the
-- exact function signatures. It does NOT:
--   - drop functions
--   - alter tables / views / columns
--   - restore usage_ledger schema
--   - touch admin_audit_logs rows or its append-only policy
--   - modify any LP-09 function (role/audit/owner foundation)
--   - re-grant EXECUTE to anyone
--
-- service_role EXECUTE is intentionally preserved: server actions
-- that re-check permissions via requireAdminPermission() continue to
-- work through the trusted server boundary.
--
-- Idempotent: REVOKE on a grant that is absent is a no-op.
-- ============================================================

-- 1. admin_update_catalog_set --------------------------------
revoke all on function public.admin_update_catalog_set(uuid, uuid, text, text, uuid, text, text, text, text[], boolean) from public;
revoke all on function public.admin_update_catalog_set(uuid, uuid, text, text, uuid, text, text, text, text[], boolean) from anon;
revoke all on function public.admin_update_catalog_set(uuid, uuid, text, text, uuid, text, text, text, text[], boolean) from authenticated;

-- 2. admin_publish_catalog_set -------------------------------
revoke all on function public.admin_publish_catalog_set(uuid, uuid, text) from public;
revoke all on function public.admin_publish_catalog_set(uuid, uuid, text) from anon;
revoke all on function public.admin_publish_catalog_set(uuid, uuid, text) from authenticated;

-- 3. admin_unpublish_catalog_set -----------------------------
revoke all on function public.admin_unpublish_catalog_set(uuid, uuid, text) from public;
revoke all on function public.admin_unpublish_catalog_set(uuid, uuid, text) from anon;
revoke all on function public.admin_unpublish_catalog_set(uuid, uuid, text) from authenticated;

-- 4. admin_archive_catalog_set -------------------------------
revoke all on function public.admin_archive_catalog_set(uuid, uuid, text) from public;
revoke all on function public.admin_archive_catalog_set(uuid, uuid, text) from anon;
revoke all on function public.admin_archive_catalog_set(uuid, uuid, text) from authenticated;

-- 5. admin_replace_catalog_cards -----------------------------
revoke all on function public.admin_replace_catalog_cards(uuid, uuid, jsonb, text) from public;
revoke all on function public.admin_replace_catalog_cards(uuid, uuid, jsonb, text) from anon;
revoke all on function public.admin_replace_catalog_cards(uuid, uuid, jsonb, text) from authenticated;

-- 6. admin_adjust_user_usage ---------------------------------
revoke all on function public.admin_adjust_user_usage(uuid, uuid, text, integer, text, uuid) from public;
revoke all on function public.admin_adjust_user_usage(uuid, uuid, text, integer, text, uuid) from anon;
revoke all on function public.admin_adjust_user_usage(uuid, uuid, text, integer, text, uuid) from authenticated;

-- 7. admin_override_user_entitlement -------------------------
revoke all on function public.admin_override_user_entitlement(uuid, uuid, text, text, text, integer, boolean, text, timestamptz, uuid) from public;
revoke all on function public.admin_override_user_entitlement(uuid, uuid, text, text, text, integer, boolean, text, timestamptz, uuid) from anon;
revoke all on function public.admin_override_user_entitlement(uuid, uuid, text, text, text, integer, boolean, text, timestamptz, uuid) from authenticated;

-- 8. admin_retry_processing_job ------------------------------
revoke all on function public.admin_retry_processing_job(uuid, uuid, text, uuid) from public;
revoke all on function public.admin_retry_processing_job(uuid, uuid, text, uuid) from anon;
revoke all on function public.admin_retry_processing_job(uuid, uuid, text, uuid) from authenticated;