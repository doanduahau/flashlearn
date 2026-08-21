-- LP-10 Part 2B: Admin User Administration V2
--
-- 1. Alters entitlement_overrides to add updated_at.
-- 2. Creates admin_mutation_receipts table for durable idempotent replays.
-- 3. Drops historical V1 functions admin_adjust_user_usage and admin_override_user_entitlement without CASCADE.
-- 4. Creates hardened V2 functions:
--    - admin_adjust_user_usage_v2
--    - admin_override_user_entitlement_v2
--    - admin_remove_user_entitlement_override_v2
-- 5. Revokes all browser execution and grants execute strictly to service_role.

-- 1. Schema additions
alter table public.entitlement_overrides
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.admin_mutation_receipts (
  idempotency_key uuid primary key,
  operation text not null check (operation in ('usage.adjust', 'entitlement.override', 'entitlement.override.remove')),
  actor_user_id uuid not null,
  target_user_id uuid not null,
  payload_fingerprint text not null,
  response_payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_mutation_receipts_lookup
  on public.admin_mutation_receipts(target_user_id, operation, created_at desc);

alter table public.admin_mutation_receipts enable row level security;

revoke all on table public.admin_mutation_receipts from public, anon, authenticated;
grant all privileges on table public.admin_mutation_receipts to service_role;

grant select on table auth.users to service_role;
grant all privileges on table public.profiles to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'service_role_manage_profiles'
  ) then
    create policy "service_role_manage_profiles" on public.profiles for all to service_role using (true) with check (true);
  end if;
end $$;

-- 2. Drop historical V1 functions (without CASCADE)
drop function if exists public.admin_adjust_user_usage(uuid, uuid, text, integer, text, uuid);
drop function if exists public.admin_override_user_entitlement(uuid, uuid, text, text, text, integer, boolean, text, timestamptz, uuid);

-- Helper function to check owner role inside DB defense-in-depth
create or replace function public.is_admin_owner(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.user_roles
    where user_id = p_user_id
      and role = 'owner'
      and revoked_at is null
  );
$$;

revoke all on function public.is_admin_owner(uuid) from public, anon, authenticated;
grant execute on function public.is_admin_owner(uuid) to service_role;

-- 3. V2 Functions

-- 3A. admin_adjust_user_usage_v2
create or replace function public.admin_adjust_user_usage_v2(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_usage_key text,
  p_amount integer,
  p_reason text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_reason text;
  v_fingerprint text;
  v_receipt public.admin_mutation_receipts%rowtype;
  v_period_id uuid;
  v_period_kind text;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_entry_type text;
  v_new_consumed bigint;
  v_limit bigint;
  v_response jsonb;
begin
  -- 1. Security & Actor Validations
  if p_actor_user_id is null then
    raise exception using errcode = '42501', message = 'actor user id required';
  end if;
  if not public.is_admin_owner(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'owner role required';
  end if;
  if p_target_user_id is null then
    raise exception using errcode = '22023', message = 'target user required';
  end if;
  if p_actor_user_id = p_target_user_id then
    raise exception using errcode = '42501', message = 'admin cannot adjust own usage';
  end if;
  if not exists(select 1 from auth.users where id = p_target_user_id) then
    raise exception using errcode = 'P0002', message = 'target user not found';
  end if;

  -- 2. Input Validations
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'idempotency key required';
  end if;
  if p_usage_key is null or btrim(p_usage_key) = '' then
    raise exception using errcode = '22023', message = 'usage key required';
  end if;
  if p_amount is null or p_amount = 0 or p_amount < -10000 or p_amount > 10000 then
    raise exception using errcode = '22023', message = 'amount must be between -10000 and 10000 (non-zero)';
  end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) < 10 or char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'reason required (10-500 characters)';
  end if;

  -- 3. Idempotency Check
  v_fingerprint := md5('usage.adjust:' || p_actor_user_id::text || ':' || p_target_user_id::text || ':' || p_usage_key || ':' || p_amount::text);
  select * into v_receipt from public.admin_mutation_receipts where idempotency_key = p_idempotency_key for update;
  if found then
    if v_receipt.payload_fingerprint = v_fingerprint then
      return v_receipt.response_payload;
    else
      raise exception using errcode = 'P0005', message = 'idempotency conflict: key reused with different payload';
    end if;
  end if;

  -- 4. Advisory Lock (matches reserve_usage convention)
  perform pg_advisory_xact_lock(hashtextextended(p_target_user_id::text || ':' || p_usage_key, 0));

  -- 5. Resolve Period for calendar_month usage keys
  v_period_kind := case when p_usage_key = 'documents.heavy_jobs.rolling_day' then 'rolling_day' else 'calendar_month' end;
  v_period_start := case when v_period_kind = 'rolling_day' then date_trunc('day', now() at time zone 'UTC') else date_trunc('month', now() at time zone 'UTC') end;
  v_period_end := case when v_period_kind = 'rolling_day' then v_period_start + interval '1 day' else v_period_start + interval '1 month' end;

  insert into public.usage_periods(user_id, usage_key, period_kind, period_start, period_end, plan_id)
  values (p_target_user_id, p_usage_key, v_period_kind, v_period_start, v_period_end, public.get_effective_plan(p_target_user_id))
  on conflict (user_id, usage_key, period_kind, period_start) do update set plan_id = excluded.plan_id
  returning id into v_period_id;

  -- 6. Insert Ledger Entry
  -- Positive adjustment = credit (reduces consumption = adds budget)
  -- Negative adjustment = debit (increases consumption = consumes budget)
  v_entry_type := case when p_amount > 0 then 'credit' else 'debit' end;
  insert into public.usage_ledger(user_id, period_id, entry_type, usage_key, amount, reason, idempotency_key, created_by)
  values (p_target_user_id, v_period_id, v_entry_type, p_usage_key, abs(p_amount), v_reason, p_idempotency_key, p_actor_user_id);

  -- 7. Calculate New Consumed Total
  if v_period_kind = 'rolling_day' then
    select coalesce(sum(case when entry_type = 'credit' then -amount else amount end), 0) into v_new_consumed
    from public.usage_ledger
    where user_id = p_target_user_id and usage_key = p_usage_key and created_at > now() - interval '24 hours';
  else
    select coalesce(sum(case when entry_type = 'credit' then -amount else amount end), 0) into v_new_consumed
    from public.usage_ledger
    where period_id = v_period_id;
  end if;

  select (public.get_effective_entitlement(p_target_user_id, p_usage_key)->>'integer_value')::bigint into v_limit;

  -- 8. Audit Log
  insert into public.admin_audit_logs(actor, action, target_type, target_id, reason, after_summary)
  values (
    p_actor_user_id,
    'usage.adjust',
    'user',
    p_target_user_id::text,
    v_reason,
    jsonb_build_object(
      'usage_key', p_usage_key,
      'amount', p_amount,
      'entry_type', v_entry_type,
      'period_id', v_period_id,
      'new_consumed', v_new_consumed,
      'limit', v_limit
    )
  );

  -- 9. Store Mutation Receipt
  v_response := jsonb_build_object(
    'success', true,
    'usage_key', p_usage_key,
    'amount', p_amount,
    'entry_type', v_entry_type,
    'new_consumed', v_new_consumed,
    'limit', v_limit
  );

  insert into public.admin_mutation_receipts(idempotency_key, operation, actor_user_id, target_user_id, payload_fingerprint, response_payload)
  values (p_idempotency_key, 'usage.adjust', p_actor_user_id, p_target_user_id, v_fingerprint, v_response);

  return v_response;
end;
$fn$;

-- 3B. admin_override_user_entitlement_v2
create or replace function public.admin_override_user_entitlement_v2(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_entitlement_key text,
  p_value_type text,
  p_reason text,
  p_integer_value bigint default null,
  p_boolean_value boolean default null,
  p_text_value text default null,
  p_expires_at timestamptz default null,
  p_expected_updated_at text default null,
  p_idempotency_key uuid default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_reason text;
  v_fingerprint text;
  v_receipt public.admin_mutation_receipts%rowtype;
  v_existing public.entitlement_overrides%rowtype;
  v_valid_type text;
  v_expected_ts timestamptz;
  v_now timestamptz := now();
  v_response jsonb;
begin
  -- 1. Security & Actor Validations
  if p_actor_user_id is null then
    raise exception using errcode = '42501', message = 'actor user id required';
  end if;
  if not public.is_admin_owner(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'owner role required';
  end if;
  if p_target_user_id is null then
    raise exception using errcode = '22023', message = 'target user required';
  end if;
  if p_actor_user_id = p_target_user_id then
    raise exception using errcode = '42501', message = 'admin cannot override own entitlement';
  end if;
  if not exists(select 1 from auth.users where id = p_target_user_id) then
    raise exception using errcode = 'P0002', message = 'target user not found';
  end if;

  -- 2. Input Validations
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'idempotency key required';
  end if;
  if p_entitlement_key is null or btrim(p_entitlement_key) = '' then
    raise exception using errcode = '22023', message = 'entitlement key required';
  end if;

  -- Validate key exists in plan_entitlements
  select value_type into v_valid_type
  from public.plan_entitlements
  where entitlement_key = p_entitlement_key
  limit 1;

  if not found then
    raise exception using errcode = '22023', message = 'unknown entitlement key';
  end if;

  if p_value_type is null or p_value_type <> v_valid_type then
    raise exception using errcode = '22023', message = 'type mismatch for entitlement key';
  end if;

  -- Typed value validation
  if p_value_type = 'integer' then
    if p_integer_value is null or p_integer_value < 0 or p_boolean_value is not null or p_text_value is not null then
      raise exception using errcode = '22023', message = 'invalid integer value (must be >= 0)';
    end if;
  elsif p_value_type = 'boolean' then
    if p_boolean_value is null or p_integer_value is not null or p_text_value is not null then
      raise exception using errcode = '22023', message = 'invalid boolean value';
    end if;
  elsif p_value_type = 'text' then
    if p_text_value is null or btrim(p_text_value) = '' or p_integer_value is not null or p_boolean_value is not null then
      raise exception using errcode = '22023', message = 'invalid text value';
    end if;
  end if;

  -- Expiry validation (mandatory, future, max 365 days)
  if p_expires_at is null then
    raise exception using errcode = '22023', message = 'expiry required';
  end if;
  if p_expires_at <= v_now then
    raise exception using errcode = '22023', message = 'expiry must be in the future';
  end if;
  if p_expires_at > v_now + interval '365 days' then
    raise exception using errcode = '22023', message = 'expiry cannot exceed 365 days';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) < 10 or char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'reason required (10-500 characters)';
  end if;

  -- 3. Idempotency Check
  v_fingerprint := md5('entitlement.override:' || p_actor_user_id::text || ':' || p_target_user_id::text || ':' || p_entitlement_key || ':' || p_value_type || ':' || coalesce(p_integer_value::text, '') || ':' || coalesce(p_boolean_value::text, '') || ':' || coalesce(p_text_value, '') || ':' || p_expires_at::text);
  select * into v_receipt from public.admin_mutation_receipts where idempotency_key = p_idempotency_key for update;
  if found then
    if v_receipt.payload_fingerprint = v_fingerprint then
      return v_receipt.response_payload;
    else
      raise exception using errcode = 'P0005', message = 'idempotency conflict: key reused with different payload';
    end if;
  end if;

  -- 4. Optimistic Concurrency Check & Mutation
  select * into v_existing
  from public.entitlement_overrides
  where user_id = p_target_user_id and entitlement_key = p_entitlement_key
  for update;

  if found then
    if p_expected_updated_at is not null and btrim(p_expected_updated_at) <> '' then
      v_expected_ts := p_expected_updated_at::timestamptz;
      if v_existing.updated_at <> v_expected_ts then
        raise exception using errcode = 'P0004', message = 'entitlement override modified by another admin';
      end if;
    end if;

    update public.entitlement_overrides set
      value_type = p_value_type,
      integer_value = p_integer_value,
      boolean_value = p_boolean_value,
      text_value = p_text_value,
      expires_at = p_expires_at,
      reason = v_reason,
      created_by = p_actor_user_id,
      updated_at = v_now
    where id = v_existing.id;
  else
    insert into public.entitlement_overrides(
      user_id, entitlement_key, value_type, integer_value, boolean_value, text_value, expires_at, reason, created_by, updated_at
    ) values (
      p_target_user_id, p_entitlement_key, p_value_type, p_integer_value, p_boolean_value, p_text_value, p_expires_at, v_reason, p_actor_user_id, v_now
    );
  end if;

  -- 5. Audit Log
  insert into public.admin_audit_logs(actor, action, target_type, target_id, reason, after_summary)
  values (
    p_actor_user_id,
    'entitlement.override',
    'user',
    p_target_user_id::text,
    v_reason,
    jsonb_build_object(
      'key', p_entitlement_key,
      'type', p_value_type,
      'integer_value', p_integer_value,
      'boolean_value', p_boolean_value,
      'text_value', p_text_value,
      'expires_at', p_expires_at,
      'updated_at', v_now
    )
  );

  -- 6. Store Mutation Receipt
  v_response := jsonb_build_object(
    'success', true,
    'entitlement_key', p_entitlement_key,
    'value_type', p_value_type,
    'integer_value', p_integer_value,
    'boolean_value', p_boolean_value,
    'text_value', p_text_value,
    'expires_at', p_expires_at,
    'updated_at', v_now
  );

  insert into public.admin_mutation_receipts(idempotency_key, operation, actor_user_id, target_user_id, payload_fingerprint, response_payload)
  values (p_idempotency_key, 'entitlement.override', p_actor_user_id, p_target_user_id, v_fingerprint, v_response);

  return v_response;
end;
$fn$;

-- 3C. admin_remove_user_entitlement_override_v2
create or replace function public.admin_remove_user_entitlement_override_v2(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_entitlement_key text,
  p_expected_updated_at text,
  p_reason text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_reason text;
  v_fingerprint text;
  v_receipt public.admin_mutation_receipts%rowtype;
  v_existing public.entitlement_overrides%rowtype;
  v_expected_ts timestamptz;
  v_base_entitlement jsonb;
  v_response jsonb;
begin
  -- 1. Security & Actor Validations
  if p_actor_user_id is null then
    raise exception using errcode = '42501', message = 'actor user id required';
  end if;
  if not public.is_admin_owner(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'owner role required';
  end if;
  if p_target_user_id is null then
    raise exception using errcode = '22023', message = 'target user required';
  end if;
  if p_actor_user_id = p_target_user_id then
    raise exception using errcode = '42501', message = 'admin cannot remove own override';
  end if;
  if not exists(select 1 from auth.users where id = p_target_user_id) then
    raise exception using errcode = 'P0002', message = 'target user not found';
  end if;

  -- 2. Input Validations
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'idempotency key required';
  end if;
  if p_entitlement_key is null or btrim(p_entitlement_key) = '' then
    raise exception using errcode = '22023', message = 'entitlement key required';
  end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) < 10 or char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'reason required (10-500 characters)';
  end if;

  -- 3. Idempotency Check
  v_fingerprint := md5('entitlement.override.remove:' || p_actor_user_id::text || ':' || p_target_user_id::text || ':' || p_entitlement_key);
  select * into v_receipt from public.admin_mutation_receipts where idempotency_key = p_idempotency_key for update;
  if found then
    if v_receipt.payload_fingerprint = v_fingerprint then
      return v_receipt.response_payload;
    else
      raise exception using errcode = 'P0005', message = 'idempotency conflict: key reused with different payload';
    end if;
  end if;

  -- 4. Optimistic Concurrency Check
  select * into v_existing
  from public.entitlement_overrides
  where user_id = p_target_user_id and entitlement_key = p_entitlement_key
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'override record not found';
  end if;

  if p_expected_updated_at is not null and btrim(p_expected_updated_at) <> '' then
    v_expected_ts := p_expected_updated_at::timestamptz;
    if v_existing.updated_at <> v_expected_ts then
      raise exception using errcode = 'P0004', message = 'entitlement override modified by another admin';
    end if;
  end if;

  -- 5. Delete Override
  delete from public.entitlement_overrides where id = v_existing.id;

  -- 6. Resolve Effective Baseline Entitlement
  v_base_entitlement := public.get_effective_entitlement(p_target_user_id, p_entitlement_key);

  -- 7. Audit Log
  insert into public.admin_audit_logs(actor, action, target_type, target_id, reason, after_summary)
  values (
    p_actor_user_id,
    'entitlement.override.remove',
    'user',
    p_target_user_id::text,
    v_reason,
    jsonb_build_object(
      'key', p_entitlement_key,
      'removed_override', jsonb_build_object(
        'type', v_existing.value_type,
        'integer_value', v_existing.integer_value,
        'boolean_value', v_existing.boolean_value,
        'text_value', v_existing.text_value,
        'expires_at', v_existing.expires_at
      ),
      'restored_effective_entitlement', v_base_entitlement
    )
  );

  -- 8. Store Mutation Receipt
  v_response := jsonb_build_object(
    'success', true,
    'entitlement_key', p_entitlement_key,
    'restored_effective_entitlement', v_base_entitlement
  );

  insert into public.admin_mutation_receipts(idempotency_key, operation, actor_user_id, target_user_id, payload_fingerprint, response_payload)
  values (p_idempotency_key, 'entitlement.override.remove', p_actor_user_id, p_target_user_id, v_fingerprint, v_response);

  return v_response;
end;
$fn$;

-- 4. Revocations and Grants
revoke all on function public.admin_adjust_user_usage_v2(uuid, uuid, text, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_adjust_user_usage_v2(uuid, uuid, text, integer, text, uuid) to service_role;

revoke all on function public.admin_override_user_entitlement_v2(uuid, uuid, text, text, text, bigint, boolean, text, timestamptz, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_override_user_entitlement_v2(uuid, uuid, text, text, text, bigint, boolean, text, timestamptz, text, uuid) to service_role;

revoke all on function public.admin_remove_user_entitlement_override_v2(uuid, uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_remove_user_entitlement_override_v2(uuid, uuid, text, text, text, uuid) to service_role;
