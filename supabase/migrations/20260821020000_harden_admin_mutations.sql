-- LP-10 Part 3 hardening: fix admin mutation RPCs
-- 1. Add reason/created_by to usage_ledger
-- 2. Expand entry_type constraint to include 'admin_adjust'
-- 3. Allow non-zero amounts for admin adjustments
-- 4. Add in-RPC permission checks via check_admin_permission()

-- ============================================================
-- 0. Helper: SQL-side permission check (mirrors permission-map.ts)
-- ============================================================
create or replace function public.check_admin_permission(p_user_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.revoked_at is null
      and (
        (ur.role = 'owner')
        or (ur.role = 'content_admin' and p_permission in ('catalog.read', 'catalog.write', 'catalog.publish'))
        or (ur.role = 'support' and p_permission in ('users.read', 'users.status.write', 'usage.read', 'usage.adjust', 'subscriptions.read', 'subscriptions.override', 'jobs.read', 'jobs.retry'))
        or (ur.role = 'analyst' and p_permission in ('catalog.read', 'usage.read', 'subscriptions.read', 'jobs.read', 'audit.read'))
      )
  );
$fn$;

revoke all on function public.check_admin_permission(uuid, text) from public, anon, authenticated;
grant execute on function public.check_admin_permission(uuid, text) to service_role;

-- ============================================================
-- 1. Add missing columns to usage_ledger
-- ============================================================
alter table public.usage_ledger add column if not exists reason text;
alter table public.usage_ledger add column if not exists created_by uuid;

-- ============================================================
-- 2. Expand entry_type to include 'admin_adjust'
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_ledger_entry_type_check' AND conrelid = 'public.usage_ledger'::regclass) THEN
    ALTER TABLE public.usage_ledger DROP CONSTRAINT usage_ledger_entry_type_check;
  END IF;
END $$;

ALTER TABLE public.usage_ledger
  ADD CONSTRAINT usage_ledger_entry_type_check
  CHECK (entry_type in ('debit', 'credit', 'adjustment', 'admin_adjust'));

-- ============================================================
-- 3. Allow non-zero amounts for admin adjustments
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_ledger_amount_check' AND conrelid = 'public.usage_ledger'::regclass) THEN
    ALTER TABLE public.usage_ledger DROP CONSTRAINT usage_ledger_amount_check;
  END IF;
END $$;

ALTER TABLE public.usage_ledger
  ADD CONSTRAINT usage_ledger_amount_check
  CHECK (amount != 0);

-- ============================================================
-- 4. Drop and recreate all 8 RPCs with in-RPC permission checks
-- ============================================================

-- 1a. admin_update_catalog_set
DROP FUNCTION IF EXISTS public.admin_update_catalog_set(uuid, uuid, text, text, uuid, text, text, text, text[], boolean);

create or replace function public.admin_update_catalog_set(
  p_actor_user_id uuid, p_catalog_set_id uuid,
  p_title text default null, p_description text default null, p_category_id uuid default null,
  p_language_front text default null, p_language_back text default null, p_level text default null,
  p_tags text[] default null, p_is_starter boolean default null
) returns table(out_id uuid, out_title text, out_version integer, out_status text)
language plpgsql security definer set search_path = '' as $fn$
declare v_old public.catalog_sets%rowtype;
begin
  if p_actor_user_id is null then raise exception using errcode = '42501', message = 'actor user id required'; end if;
  if not public.check_admin_permission(p_actor_user_id, 'catalog.write') then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;
  if p_catalog_set_id is null then raise exception using errcode = '22023', message = 'catalog_set_id required'; end if;
  select * into v_old from public.catalog_sets cs where cs.id = p_catalog_set_id;
  if not found then raise exception using errcode = 'P0002', message = 'catalog set not found'; end if;
  if coalesce(p_is_starter, v_old.is_starter) = true and v_old.is_starter = false then
    if (select count(*) from public.catalog_sets cs2 where cs2.is_starter = true and cs2.status = 'published') >= 3 then
      raise exception using errcode = '22023', message = 'cannot mark as starter: already 3 published starters';
    end if;
  end if;
  update public.catalog_sets cs set
    title = coalesce(nullif(btrim(p_title), ''), v_old.title),
    description = p_description,
    category_id = coalesce(p_category_id, v_old.category_id),
    language_front = coalesce(nullif(btrim(p_language_front), ''), v_old.language_front),
    language_back = coalesce(nullif(btrim(p_language_back), ''), v_old.language_back),
    level = p_level,
    tags = coalesce(p_tags, v_old.tags),
    is_starter = coalesce(p_is_starter, v_old.is_starter),
    updated_at = now()
  where cs.id = p_catalog_set_id
  returning cs.id, cs.title, cs.version, cs.status into out_id, out_title, out_version, out_status;
  insert into public.admin_audit_logs(actor, action, target_type, target_id, reason, before_summary, after_summary)
  values (p_actor_user_id, 'catalog.update', 'catalog_set', p_catalog_set_id::text, coalesce(p_title, 'metadata update'),
    jsonb_build_object('title', v_old.title, 'version', v_old.version),
    jsonb_build_object('title', out_title, 'version', out_version));
  return;
end;
$fn$;

revoke all on function public.admin_update_catalog_set(uuid, uuid, text, text, uuid, text, text, text, text[], boolean) from public, anon, authenticated;
grant execute on function public.admin_update_catalog_set(uuid, uuid, text, text, uuid, text, text, text, text[], boolean) to service_role;
grant execute on function public.admin_update_catalog_set(uuid, uuid, text, text, uuid, text, text, text, text[], boolean) to authenticated;

-- 1b. admin_publish_catalog_set
DROP FUNCTION IF EXISTS public.admin_publish_catalog_set(uuid, uuid, text);

create or replace function public.admin_publish_catalog_set(
  p_actor_user_id uuid, p_catalog_set_id uuid, p_reason text
) returns table(out_id uuid, out_version integer, out_status text, out_published_at timestamptz)
language plpgsql security definer set search_path = '' as $fn$
declare v_old public.catalog_sets%rowtype; v_reason text;
begin
  if p_actor_user_id is null then raise exception using errcode = '42501', message = 'actor user id required'; end if;
  if not public.check_admin_permission(p_actor_user_id, 'catalog.publish') then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;
  if p_catalog_set_id is null then raise exception using errcode = '22023', message = 'catalog_set_id required'; end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) = 0 or char_length(v_reason) > 500 then raise exception using errcode = '22023', message = 'reason required (1-500 chars)'; end if;
  select * into v_old from public.catalog_sets cs where cs.id = p_catalog_set_id;
  if not found then raise exception using errcode = 'P0002', message = 'catalog set not found'; end if;
  if v_old.status = 'published' then raise exception using errcode = '22023', message = 'already published'; end if;
  update public.catalog_sets cs set status = 'published', version = cs.version + 1, published_at = now(), updated_at = now()
  where cs.id = p_catalog_set_id
  returning cs.id, cs.version, cs.status, cs.published_at into out_id, out_version, out_status, out_published_at;
  insert into public.admin_audit_logs(actor, action, target_type, target_id, reason, before_summary, after_summary)
  values (p_actor_user_id, 'catalog.publish', 'catalog_set', p_catalog_set_id::text, v_reason,
    jsonb_build_object('status', v_old.status, 'version', v_old.version),
    jsonb_build_object('status', out_status, 'version', out_version));
  return;
end;
$fn$;

revoke all on function public.admin_publish_catalog_set(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_publish_catalog_set(uuid, uuid, text) to service_role;
grant execute on function public.admin_publish_catalog_set(uuid, uuid, text) to authenticated;

-- 1c. admin_unpublish_catalog_set
DROP FUNCTION IF EXISTS public.admin_unpublish_catalog_set(uuid, uuid, text);

create or replace function public.admin_unpublish_catalog_set(
  p_actor_user_id uuid, p_catalog_set_id uuid, p_reason text
) returns table(out_id uuid, out_version integer, out_status text)
language plpgsql security definer set search_path = '' as $fn$
declare v_old public.catalog_sets%rowtype; v_reason text;
begin
  if p_actor_user_id is null then raise exception using errcode = '42501', message = 'actor user id required'; end if;
  if not public.check_admin_permission(p_actor_user_id, 'catalog.publish') then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;
  if p_catalog_set_id is null then raise exception using errcode = '22023', message = 'catalog_set_id required'; end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) = 0 or char_length(v_reason) > 500 then raise exception using errcode = '22023', message = 'reason required (1-500 chars)'; end if;
  select * into v_old from public.catalog_sets cs where cs.id = p_catalog_set_id;
  if not found then raise exception using errcode = 'P0002', message = 'catalog set not found'; end if;
  if v_old.status != 'published' then raise exception using errcode = '22023', message = 'set is not published'; end if;
  update public.catalog_sets cs set status = 'draft', published_at = null, updated_at = now()
  where cs.id = p_catalog_set_id
  returning cs.id, cs.version, cs.status into out_id, out_version, out_status;
  insert into public.admin_audit_logs(actor, action, target_type, target_id, reason, before_summary, after_summary)
  values (p_actor_user_id, 'catalog.unpublish', 'catalog_set', p_catalog_set_id::text, v_reason,
    jsonb_build_object('status', 'published', 'version', out_version),
    jsonb_build_object('status', 'draft', 'version', out_version));
  return;
end;
$fn$;

revoke all on function public.admin_unpublish_catalog_set(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_unpublish_catalog_set(uuid, uuid, text) to service_role;
grant execute on function public.admin_unpublish_catalog_set(uuid, uuid, text) to authenticated;

-- 1d. admin_archive_catalog_set — clears published_at to satisfy constraint
DROP FUNCTION IF EXISTS public.admin_archive_catalog_set(uuid, uuid, text);

create or replace function public.admin_archive_catalog_set(
  p_actor_user_id uuid, p_catalog_set_id uuid, p_reason text
) returns table(out_id uuid, out_status text)
language plpgsql security definer set search_path = '' as $fn$
declare v_old public.catalog_sets%rowtype; v_reason text;
begin
  if p_actor_user_id is null then raise exception using errcode = '42501', message = 'actor user id required'; end if;
  if not public.check_admin_permission(p_actor_user_id, 'catalog.write') then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;
  if p_catalog_set_id is null then raise exception using errcode = '22023', message = 'catalog_set_id required'; end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) = 0 or char_length(v_reason) > 500 then raise exception using errcode = '22023', message = 'reason required (1-500 chars)'; end if;
  select * into v_old from public.catalog_sets cs where cs.id = p_catalog_set_id;
  if not found then raise exception using errcode = 'P0002', message = 'catalog set not found'; end if;
  if v_old.status = 'archived' then raise exception using errcode = '22023', message = 'already archived'; end if;
  update public.catalog_sets cs set status = 'archived', published_at = null, is_starter = false, updated_at = now()
  where cs.id = p_catalog_set_id
  returning cs.id, cs.status into out_id, out_status;
  insert into public.admin_audit_logs(actor, action, target_type, target_id, reason, before_summary, after_summary)
  values (p_actor_user_id, 'catalog.archive', 'catalog_set', p_catalog_set_id::text, v_reason,
    jsonb_build_object('status', v_old.status, 'is_starter', v_old.is_starter),
    jsonb_build_object('status', 'archived', 'is_starter', false));
  return;
end;
$fn$;

revoke all on function public.admin_archive_catalog_set(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_archive_catalog_set(uuid, uuid, text) to service_role;
grant execute on function public.admin_archive_catalog_set(uuid, uuid, text) to authenticated;

-- 1e. admin_replace_catalog_cards — only front/back/position (no phonetic/explanation)
DROP FUNCTION IF EXISTS public.admin_replace_catalog_cards(uuid, uuid, jsonb, text);

create or replace function public.admin_replace_catalog_cards(
  p_actor_user_id uuid, p_catalog_set_id uuid, p_cards jsonb, p_reason text
) returns void
language plpgsql security definer set search_path = '' as $fn$
declare v_old public.catalog_sets%rowtype; v_count integer; v_reason text;
begin
  if p_actor_user_id is null then raise exception using errcode = '42501', message = 'actor user id required'; end if;
  if not public.check_admin_permission(p_actor_user_id, 'catalog.write') then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;
  if p_catalog_set_id is null then raise exception using errcode = '22023', message = 'catalog_set_id required'; end if;
  if p_cards is null or jsonb_array_length(p_cards) = 0 then raise exception using errcode = '22023', message = 'cards array required (non-empty)'; end if;
  if jsonb_array_length(p_cards) > 2000 then raise exception using errcode = '22023', message = 'max 2000 cards per set'; end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) = 0 or char_length(v_reason) > 500 then raise exception using errcode = '22023', message = 'reason required (1-500 chars)'; end if;
  select * into v_old from public.catalog_sets cs where cs.id = p_catalog_set_id;
  if not found then raise exception using errcode = 'P0002', message = 'catalog set not found'; end if;
  select count(*) into v_count from public.catalog_cards cc where cc.catalog_set_id = p_catalog_set_id;
  delete from public.catalog_cards cc where cc.catalog_set_id = p_catalog_set_id;
  insert into public.catalog_cards (catalog_set_id, front, back, position)
  select p_catalog_set_id,
    (item->>'front')::text,
    (item->>'back')::text,
    ord - 1
  from jsonb_array_elements(p_cards) with ordinality as t(item, ord);
  update public.catalog_sets cs set version = cs.version + 1, updated_at = now() where cs.id = p_catalog_set_id;
  insert into public.admin_audit_logs(actor, action, target_type, target_id, reason, before_summary, after_summary)
  values (p_actor_user_id, 'catalog.replace_cards', 'catalog_set', p_catalog_set_id::text, v_reason,
    jsonb_build_object('card_count', v_count),
    jsonb_build_object('card_count', jsonb_array_length(p_cards)));
  return;
end;
$fn$;

revoke all on function public.admin_replace_catalog_cards(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_replace_catalog_cards(uuid, uuid, jsonb, text) to service_role;
grant execute on function public.admin_replace_catalog_cards(uuid, uuid, jsonb, text) to authenticated;

-- 2a. admin_adjust_user_usage
DROP FUNCTION IF EXISTS public.admin_adjust_user_usage(uuid, uuid, text, integer, text, uuid);

create or replace function public.admin_adjust_user_usage(
  p_actor_user_id uuid, p_target_user_id uuid, p_usage_key text, p_amount integer, p_reason text,
  p_idempotency_key uuid default null
) returns void
language plpgsql security definer set search_path = '' as $fn$
declare v_reason text; v_idem uuid;
begin
  if p_actor_user_id is null then raise exception using errcode = '42501', message = 'actor user id required'; end if;
  if not public.check_admin_permission(p_actor_user_id, 'usage.adjust') then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;
  if p_target_user_id is null then raise exception using errcode = '22023', message = 'target user required'; end if;
  if p_amount is null or p_amount = 0 or p_amount < -10000 or p_amount > 10000 then
    raise exception using errcode = '22023', message = 'amount must be between -10000 and 10000 (non-zero)';
  end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) = 0 or char_length(v_reason) > 500 then raise exception using errcode = '22023', message = 'reason required (1-500 chars)'; end if;
  v_idem := coalesce(p_idempotency_key, md5(p_actor_user_id::text || p_target_user_id::text || p_usage_key || p_amount::text || v_reason)::uuid);
  if exists(select 1 from public.usage_ledger ul where ul.idempotency_key = v_idem) then return; end if;
  -- Use credit/debit entry types so quota calculation works correctly:
  -- positive adjustment → credit (reduces consumption = gives budget)
  -- negative adjustment → debit (increases consumption = takes budget)
  insert into public.usage_ledger(user_id, entry_type, usage_key, amount, reason, idempotency_key, created_by)
  values (p_target_user_id, case when p_amount > 0 then 'credit' else 'debit' end, p_usage_key, abs(p_amount), v_reason, v_idem, p_actor_user_id);
  insert into public.admin_audit_logs(actor, action, target_type, target_id, reason, after_summary)
  values (p_actor_user_id, 'usage.adjust', 'user', p_target_user_id::text, v_reason,
    jsonb_build_object('usage_key', p_usage_key, 'amount', p_amount));
  return;
end;
$fn$;

revoke all on function public.admin_adjust_user_usage(uuid, uuid, text, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_adjust_user_usage(uuid, uuid, text, integer, text, uuid) to service_role;
grant execute on function public.admin_adjust_user_usage(uuid, uuid, text, integer, text, uuid) to authenticated;

-- 2b. admin_override_user_entitlement — uses (user_id, entitlement_key) for idempotency (no idempotency_key column)
DROP FUNCTION IF EXISTS public.admin_override_user_entitlement(uuid, uuid, text, text, text, integer, boolean, text, timestamptz, uuid);

create or replace function public.admin_override_user_entitlement(
  p_actor_user_id uuid, p_target_user_id uuid, p_entitlement_key text,
  p_value_type text, p_reason text,
  p_integer_value integer default null, p_boolean_value boolean default null, p_text_value text default null,
  p_expires_at timestamptz default null, p_idempotency_key uuid default null
) returns void
language plpgsql security definer set search_path = '' as $fn$
declare v_reason text;
begin
  if p_actor_user_id is null then raise exception using errcode = '42501', message = 'actor user id required'; end if;
  if not public.check_admin_permission(p_actor_user_id, 'subscriptions.override') then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;
  if p_target_user_id is null then raise exception using errcode = '22023', message = 'target user required'; end if;
  if p_entitlement_key is null or btrim(p_entitlement_key) = '' then
    raise exception using errcode = '22023', message = 'entitlement key required';
  end if;
  if p_expires_at is null then raise exception using errcode = '22023', message = 'expiry required'; end if;
  if p_expires_at <= now() then raise exception using errcode = '22023', message = 'expiry must be in the future'; end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) = 0 or char_length(v_reason) > 500 then raise exception using errcode = '22023', message = 'reason required (1-500 chars)'; end if;
  -- Idempotency: if override exists for same user+key, update it
  if exists(select 1 from public.entitlement_overrides eo where eo.user_id = p_target_user_id and eo.entitlement_key = p_entitlement_key) then
    update public.entitlement_overrides eo set
      value_type = p_value_type, integer_value = p_integer_value, boolean_value = p_boolean_value,
      text_value = p_text_value, expires_at = p_expires_at, reason = v_reason, created_by = p_actor_user_id
    where eo.user_id = p_target_user_id and eo.entitlement_key = p_entitlement_key;
  else
    insert into public.entitlement_overrides(user_id, entitlement_key, value_type, integer_value, boolean_value, text_value, expires_at, reason, created_by)
    values (p_target_user_id, p_entitlement_key, p_value_type, p_integer_value, p_boolean_value, p_text_value, p_expires_at, v_reason, p_actor_user_id);
  end if;
  insert into public.admin_audit_logs(actor, action, target_type, target_id, reason, after_summary)
  values (p_actor_user_id, 'entitlement.override', 'user', p_target_user_id::text, v_reason,
    jsonb_build_object('key', p_entitlement_key, 'type', p_value_type, 'expires', p_expires_at));
  return;
end;
$fn$;

revoke all on function public.admin_override_user_entitlement(uuid, uuid, text, text, text, integer, boolean, text, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.admin_override_user_entitlement(uuid, uuid, text, text, text, integer, boolean, text, timestamptz, uuid) to service_role;
grant execute on function public.admin_override_user_entitlement(uuid, uuid, text, text, text, integer, boolean, text, timestamptz, uuid) to authenticated;

-- 3a. admin_retry_processing_job
DROP FUNCTION IF EXISTS public.admin_retry_processing_job(uuid, uuid, text, uuid);

create or replace function public.admin_retry_processing_job(
  p_actor_user_id uuid, p_job_id uuid, p_reason text,
  p_idempotency_key uuid default null
) returns void
language plpgsql security definer set search_path = '' as $fn$
declare v_job public.processing_jobs%rowtype; v_reason text; v_idem uuid;
begin
  if p_actor_user_id is null then raise exception using errcode = '42501', message = 'actor user id required'; end if;
  if not public.check_admin_permission(p_actor_user_id, 'jobs.retry') then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;
  if p_job_id is null then raise exception using errcode = '22023', message = 'job_id required'; end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) = 0 or char_length(v_reason) > 500 then raise exception using errcode = '22023', message = 'reason required (1-500 chars)'; end if;
  select * into v_job from public.processing_jobs pj where pj.id = p_job_id;
  if not found then raise exception using errcode = 'P0002', message = 'job not found'; end if;
  if v_job.status != 'failed' then raise exception using errcode = '22023', message = 'can only retry failed jobs'; end if;
  if v_job.job_kind not in ('paste_generate', 'document_extract') then
    raise exception using errcode = '22023', message = 'job kind not allowed for retry';
  end if;
  v_idem := coalesce(p_idempotency_key, md5('retry:' || p_job_id::text || ':' || p_actor_user_id::text)::uuid);
  if exists(select 1 from public.admin_audit_logs aal where aal.after_summary->>'idempotency_key' = v_idem::text) then return; end if;
  update public.processing_jobs pj set status = 'queued', error_code = null, updated_at = now() where pj.id = p_job_id;
  insert into public.admin_audit_logs(actor, action, target_type, target_id, reason, after_summary)
  values (p_actor_user_id, 'job.retry', 'processing_job', p_job_id::text, v_reason,
    jsonb_build_object('job_kind', v_job.job_kind, 'old_status', 'failed', 'idempotency_key', v_idem::text));
  return;
end;
$fn$;

revoke all on function public.admin_retry_processing_job(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_retry_processing_job(uuid, uuid, text, uuid) to service_role;
grant execute on function public.admin_retry_processing_job(uuid, uuid, text, uuid) to authenticated;
