-- LP-10 Part 2: Admin mutation RPCs
-- Catalog management, user/entitlement adjustments, job retry/reconcile
-- All SECURITY DEFINER, SET search_path = '', service_role only
-- Every mutation writes to admin_audit_logs

-- ============================================================
-- 1. CATALOG MUTATIONS
-- ============================================================

-- 1a. Update catalog set metadata (owner/content_admin via catalog.write)
create or replace function public.admin_update_catalog_set(
  p_actor_user_id uuid,
  p_catalog_set_id uuid,
  p_title text default null,
  p_description text default null,
  p_category_id uuid default null,
  p_language_front text default null,
  p_language_back text default null,
  p_level text default null,
  p_tags text[] default null,
  p_is_starter boolean default null
)
returns table(id uuid, title text, version integer, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old public.catalog_sets%rowtype;
  v_new_title text;
  v_new_desc text;
  v_new_cat uuid;
  v_new_lf text;
  v_new_lb text;
  v_new_level text;
  v_new_tags text[];
  v_new_starter boolean;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_actor_user_id is null or p_actor_user_id != v_actor then
    raise exception using errcode = '42501', message = 'actor mismatch';
  end if;
  if p_catalog_set_id is null then
    raise exception using errcode = '22023', message = 'catalog_set_id required';
  end if;

  select * into v_old from public.catalog_sets cs where cs.id = p_catalog_set_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'catalog set not found';
  end if;

  -- Validate non-empty updates
  v_new_title := coalesce(nullif(btrim(p_title), ''), v_old.title);
  v_new_desc := p_description;
  v_new_cat := coalesce(p_category_id, v_old.category_id);
  v_new_lf := coalesce(nullif(btrim(p_language_front), ''), v_old.language_front);
  v_new_lb := coalesce(nullif(btrim(p_language_back), ''), v_old.language_back);
  v_new_level := p_level;
  v_new_tags := coalesce(p_tags, v_old.tags);
  v_new_starter := coalesce(p_is_starter, v_old.is_starter);

  -- Prevent >3 published starters
  if v_new_starter = true and v_old.is_starter = false then
    if (select count(*) from public.catalog_sets cs2 where cs2.is_starter = true and cs2.status = 'published') >= 3 then
      raise exception using errcode = '22023', message = 'cannot mark as starter: already 3 published starters';
    end if;
  end if;

  update public.catalog_sets set
    title = v_new_title,
    description = v_new_desc,
    category_id = v_new_cat,
    language_front = v_new_lf,
    language_back = v_new_lb,
    level = v_new_level,
    tags = v_new_tags,
    is_starter = v_new_starter,
    updated_at = now()
  where id = p_catalog_set_id
  returning id, title, version, status into id, title, version, status;

  insert into public.admin_audit_logs(actor, action, target_type, target_id, reason, before_summary, after_summary)
  values (v_actor, 'catalog.update', 'catalog_set', p_catalog_set_id::text, coalesce(p_title, 'metadata update'),
    jsonb_build_object('title', v_old.title, 'version', v_old.version, 'is_starter', v_old.is_starter),
    jsonb_build_object('title', title, 'version', version, 'is_starter', v_new_starter));

  return;
end;
$$;

revoke all on function public.admin_update_catalog_set(uuid, uuid, text, text, uuid, text, text, text, text[], boolean) from public, anon, authenticated;
grant execute on function public.admin_update_catalog_set(uuid, uuid, text, text, uuid, text, text, text, text[], boolean) to service_role;


-- 1b. Publish catalog set (owner/content_admin via catalog.publish)
create or replace function public.admin_publish_catalog_set(
  p_actor_user_id uuid,
  p_catalog_set_id uuid,
  p_reason text
)
returns table(id uuid, version integer, status text, published_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old public.catalog_sets%rowtype;
  v_reason text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_actor_user_id is null or p_actor_user_id != v_actor then
    raise exception using errcode = '42501', message = 'actor mismatch';
  end if;
  if p_catalog_set_id is null then
    raise exception using errcode = '22023', message = 'catalog_set_id required';
  end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) = 0 or char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'reason required (1-500 chars)';
  end if;

  select * into v_old from public.catalog_sets cs where cs.id = p_catalog_set_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'catalog set not found';
  end if;
  if v_old.status = 'published' then
    raise exception using errcode = '22023', message = 'already published';
  end if;

  update public.catalog_sets set
    status = 'published',
    version = version + 1,
    published_at = now(),
    updated_at = now()
  where id = p_catalog_set_id
  returning id, version, status, published_at into id, version, status, published_at;

  insert into public.admin_audit_logs(actor, action, target_type, target_id, reason, before_summary, after_summary)
  values (v_actor, 'catalog.publish', 'catalog_set', p_catalog_set_id::text, v_reason,
    jsonb_build_object('status', v_old.status, 'version', v_old.version),
    jsonb_build_object('status', status, 'version', version, 'published_at', published_at));

  return;
end;
$$;

revoke all on function public.admin_publish_catalog_set(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_publish_catalog_set(uuid, uuid, text) to service_role;


-- 1c. Unpublish catalog set
create or replace function public.admin_unpublish_catalog_set(
  p_actor_user_id uuid,
  p_catalog_set_id uuid,
  p_reason text
)
returns table(id uuid, version integer, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old public.catalog_sets%rowtype;
  v_reason text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_actor_user_id is null or p_actor_user_id != v_actor then
    raise exception using errcode = '42501', message = 'actor mismatch';
  end if;
  if p_catalog_set_id is null then
    raise exception using errcode = '22023', message = 'catalog_set_id required';
  end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) = 0 or char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'reason required (1-500 chars)';
  end if;

  select * into v_old from public.catalog_sets cs where cs.id = p_catalog_set_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'catalog set not found';
  end if;
  if v_old.status != 'published' then
    raise exception using errcode = '22023', message = 'set is not published';
  end if;

  update public.catalog_sets set
    status = 'draft',
    published_at = null,
    updated_at = now()
  where id = p_catalog_set_id
  returning id, version, status into id, version, status;

  insert into public.admin_audit_logs(actor, action, target_type, target_id, reason, before_summary, after_summary)
  values (v_actor, 'catalog.unpublish', 'catalog_set', p_catalog_set_id::text, v_reason,
    jsonb_build_object('status', 'published', 'version', version),
    jsonb_build_object('status', 'draft', 'version', version));

  return;
end;
$$;

revoke all on function public.admin_unpublish_catalog_set(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_unpublish_catalog_set(uuid, uuid, text) to service_role;


-- 1d. Archive catalog set
create or replace function public.admin_archive_catalog_set(
  p_actor_user_id uuid,
  p_catalog_set_id uuid,
  p_reason text
)
returns table(id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old public.catalog_sets%rowtype;
  v_reason text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_actor_user_id is null or p_actor_user_id != v_actor then
    raise exception using errcode = '42501', message = 'actor mismatch';
  end if;
  if p_catalog_set_id is null then
    raise exception using errcode = '22023', message = 'catalog_set_id required';
  end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) = 0 or char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'reason required (1-500 chars)';
  end if;

  select * into v_old from public.catalog_sets cs where cs.id = p_catalog_set_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'catalog set not found';
  end if;
  if v_old.status = 'archived' then
    raise exception using errcode = '22023', message = 'already archived';
  end if;

  update public.catalog_sets set
    status = 'archived',
    is_starter = false,
    published_at = null,
    updated_at = now()
  where id = p_catalog_set_id
  returning id, status into id, status;

  insert into public.admin_audit_logs(actor, action, target_type, target_id, reason, before_summary, after_summary)
  values (v_actor, 'catalog.archive', 'catalog_set', p_catalog_set_id::text, v_reason,
    jsonb_build_object('status', v_old.status, 'is_starter', v_old.is_starter),
    jsonb_build_object('status', 'archived', 'is_starter', false));

  return;
end;
$$;

revoke all on function public.admin_archive_catalog_set(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_archive_catalog_set(uuid, uuid, text) to service_role;


-- 1e. Replace catalog cards atomically (owner/content_admin via catalog.write)
create or replace function public.admin_replace_catalog_cards(
  p_actor_user_id uuid,
  p_catalog_set_id uuid,
  p_cards jsonb,
  p_reason text default 'card update'
)
returns table(card_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old_count integer;
  v_new_count integer;
  v_card jsonb;
  v_pos integer := 0;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_actor_user_id is null or p_actor_user_id != v_actor then
    raise exception using errcode = '42501', message = 'actor mismatch';
  end if;
  if p_catalog_set_id is null then
    raise exception using errcode = '22023', message = 'catalog_set_id required';
  end if;
  if p_cards is null or jsonb_array_length(p_cards) = 0 then
    raise exception using errcode = '22023', message = 'cards array required';
  end if;
  if jsonb_array_length(p_cards) > 2000 then
    raise exception using errcode = '22023', message = 'max 2000 cards per catalog set';
  end if;

  if not exists (select 1 from public.catalog_sets cs where cs.id = p_catalog_set_id) then
    raise exception using errcode = 'P0002', message = 'catalog set not found';
  end if;

  select count(*)::integer into v_old_count from public.catalog_cards cc where cc.catalog_set_id = p_catalog_set_id;

  -- Atomic replace: delete old, insert new
  delete from public.catalog_cards where catalog_set_id = p_catalog_set_id;

  for v_card in select * from jsonb_array_elements(p_cards)
  loop
    v_pos := v_pos + 1;
    insert into public.catalog_cards(catalog_set_id, front, back, position)
    values (
      p_catalog_set_id,
      left(btrim(coalesce(v_card->>'front', '')), 5000),
      left(btrim(coalesce(v_card->>'back', '')), 5000),
      v_pos
    );
  end loop;

  select count(*)::integer into v_new_count from public.catalog_cards cc where cc.catalog_set_id = p_catalog_set_id;

  -- Bump version on card change
  update public.catalog_sets set version = version + 1, updated_at = now() where id = p_catalog_set_id;

  insert into public.admin_audit_logs(actor, action, target_type, target_id, reason, before_summary, after_summary)
  values (v_actor, 'catalog.update_cards', 'catalog_set', p_catalog_set_id::text, left(p_reason, 500),
    jsonb_build_object('card_count', v_old_count),
    jsonb_build_object('card_count', v_new_count));

  return query select v_new_count;
end;
$$;

revoke all on function public.admin_replace_catalog_cards(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_replace_catalog_cards(uuid, uuid, jsonb, text) to service_role;


-- ============================================================
-- 2. USER / ENTITLEMENT ADJUSTMENTS
-- ============================================================

-- 2a. Adjust user usage (support via usage.adjust)
create or replace function public.admin_adjust_user_usage(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_usage_key text,
  p_amount integer,
  p_reason text,
  p_correlation_id uuid default null
)
returns table(usage_key text, amount integer, entry_type text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text;
  v_entry_type text := 'admin_adjust';
  v_idempotency_key text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_actor_user_id is null or p_actor_user_id != v_actor then
    raise exception using errcode = '42501', message = 'actor mismatch';
  end if;
  if p_target_user_id is null then
    raise exception using errcode = '22023', message = 'target user required';
  end if;
  if p_usage_key is null or p_usage_key = '' then
    raise exception using errcode = '22023', message = 'usage_key required';
  end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) = 0 or char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'reason required (1-500 chars)';
  end if;
  -- Bounded adjustment: -10000 to +10000
  if p_amount is null or p_amount < -10000 or p_amount > 10000 or p_amount = 0 then
    raise exception using errcode = '22023', message = 'amount must be between -10000 and 10000 (non-zero)';
  end if;

  -- Generate idempotency key from actor+target+key+amount+reason
  v_idempotency_key := 'admin_adj_' || p_actor_user_id::text || '_' || p_target_user_id::text || '_' || p_usage_key || '_' || p_amount::text || '_' || md5(v_reason);

  -- Append-only ledger entry
  insert into public.usage_ledger(user_id, usage_key, amount, entry_type, idempotency_key)
  values (p_target_user_id, p_usage_key, p_amount, v_entry_type, v_idempotency_key)
  on conflict (idempotency_key) do nothing;

  insert into public.admin_audit_logs(actor, action, target_type, target_id, correlation_id, reason, after_summary)
  values (v_actor, 'usage.adjust', 'user', p_target_user_id::text, p_correlation_id, v_reason,
    jsonb_build_object('usage_key', p_usage_key, 'amount', p_amount, 'idempotency_key', v_idempotency_key));

  return query select p_usage_key, p_amount, v_entry_type;
end;
$$;

revoke all on function public.admin_adjust_user_usage(uuid, uuid, text, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_adjust_user_usage(uuid, uuid, text, integer, text, uuid) to service_role;


-- 2b. Override user entitlement (support via subscriptions.override)
create or replace function public.admin_override_user_entitlement(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_entitlement_key text,
  p_value_type text,
  p_reason text,
  p_integer_value integer default null,
  p_boolean_value boolean default null,
  p_text_value text default null,
  p_expires_at timestamptz default null,
  p_correlation_id uuid default null
)
returns table(id uuid, entitlement_key text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text;
  v_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_actor_user_id is null or p_actor_user_id != v_actor then
    raise exception using errcode = '42501', message = 'actor mismatch';
  end if;
  if p_target_user_id is null then
    raise exception using errcode = '22023', message = 'target user required';
  end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) = 0 or char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'reason required (1-500 chars)';
  end if;
  if p_entitlement_key is null or p_entitlement_key = '' then
    raise exception using errcode = '22023', message = 'entitlement_key required';
  end if;
  if p_value_type not in ('integer', 'boolean', 'text') then
    raise exception using errcode = '22023', message = 'value_type must be integer, boolean, or text';
  end if;
  if p_expires_at is null then
    raise exception using errcode = '22023', message = 'expiry required for admin overrides';
  end if;
  if p_expires_at <= now() then
    raise exception using errcode = '22023', message = 'expiry must be in the future';
  end if;

  insert into public.entitlement_overrides(
    user_id, entitlement_key, value_type, integer_value, boolean_value, text_value,
    expires_at, reason, created_by
  )
  values (
    p_target_user_id, p_entitlement_key, p_value_type, p_integer_value, p_boolean_value, p_text_value,
    p_expires_at, v_reason, v_actor
  )
  returning id, entitlement_key, expires_at into id, entitlement_key, expires_at;

  insert into public.admin_audit_logs(actor, action, target_type, target_id, correlation_id, reason, after_summary)
  values (v_actor, 'entitlement.override', 'user', p_target_user_id::text, p_correlation_id, v_reason,
    jsonb_build_object('entitlement_key', p_entitlement_key, 'value_type', p_value_type,
      'expires_at', expires_at, 'override_id', id));

  return;
end;
$$;

revoke all on function public.admin_override_user_entitlement(uuid, uuid, text, text, text, integer, boolean, text, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.admin_override_user_entitlement(uuid, uuid, text, text, text, integer, boolean, text, timestamptz, uuid) to service_role;


-- ============================================================
-- 3. JOB ACTIONS
-- ============================================================

-- 3a. Retry failed processing job (support via jobs.retry)
create or replace function public.admin_retry_processing_job(
  p_actor_user_id uuid,
  p_job_id uuid,
  p_reason text,
  p_correlation_id uuid default null
)
returns table(job_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_job public.processing_jobs%rowtype;
  v_reason text;
  -- Allowlisted job kinds for retry
  v_allowed_kinds text[] := array['paste_generate', 'google_sheets_generate', 'document_pipeline', 'typing_ai_review'];
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_actor_user_id is null or p_actor_user_id != v_actor then
    raise exception using errcode = '42501', message = 'actor mismatch';
  end if;
  if p_job_id is null then
    raise exception using errcode = '22023', message = 'job_id required';
  end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) = 0 or char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'reason required (1-500 chars)';
  end if;

  select * into v_job from public.processing_jobs pj where pj.id = p_job_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'job not found';
  end if;
  if v_job.status != 'failed' then
    raise exception using errcode = '22023', message = 'can only retry failed jobs';
  end if;
  if not (v_job.job_kind = any(v_allowed_kinds)) then
    raise exception using errcode = '22023', message = 'job kind not allowed for retry: ' || v_job.job_kind;
  end if;

  -- Reset status for retry: set back to queued, clear error, increment heartbeat
  update public.processing_jobs set
    status = 'queued',
    error_code = null,
    last_heartbeat_at = now(),
    updated_at = now()
  where id = p_job_id
  returning id, status into job_id, status;

  insert into public.admin_audit_logs(actor, action, target_type, target_id, correlation_id, reason, before_summary, after_summary)
  values (v_actor, 'job.retry', 'processing_job', p_job_id::text, p_correlation_id, v_reason,
    jsonb_build_object('status', 'failed', 'error_code', v_job.error_code, 'job_kind', v_job.job_kind),
    jsonb_build_object('status', 'queued', 'retry_by', v_actor));

  return;
end;
$$;

revoke all on function public.admin_retry_processing_job(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_retry_processing_job(uuid, uuid, text, uuid) to service_role;
