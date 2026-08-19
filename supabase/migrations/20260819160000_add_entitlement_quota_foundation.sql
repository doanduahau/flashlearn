-- LP-02: additive commercial entitlement and quota foundation.
--
-- This migration is intentionally observer-ready only: no existing user flow
-- calls these RPCs until later rollout tasks. All mutations remain service-role
-- only; client code can read only its own subscription/usage state.

create table public.plans (
  id text primary key check (id in ('free', 'pro_monthly', 'pro_yearly')),
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_entitlements (
  plan_id text not null references public.plans(id) on delete cascade,
  entitlement_key text not null check (entitlement_key ~ '^[a-z][a-z0-9_.]{1,80}$'),
  value_type text not null check (value_type in ('integer', 'boolean', 'text')),
  integer_value bigint,
  boolean_value boolean,
  text_value text,
  effective_version integer not null default 1 check (effective_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, entitlement_key),
  check (
    (value_type = 'integer' and integer_value is not null and boolean_value is null and text_value is null)
    or (value_type = 'boolean' and integer_value is null and boolean_value is not null and text_value is null)
    or (value_type = 'text' and integer_value is null and boolean_value is null and text_value is not null)
  )
);

create table public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null check (status in ('active', 'past_due', 'cancel_at_period_end', 'grace', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_ends_at timestamptz,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((provider is null) = (provider_subscription_id is null)),
  check (current_period_end is null or current_period_start is null or current_period_end > current_period_start),
  check (grace_ends_at is null or current_period_end is null or grace_ends_at >= current_period_end)
);

create unique index user_subscriptions_active_provider_reference
  on public.user_subscriptions(provider, provider_subscription_id)
  where provider is not null and provider_subscription_id is not null;
create index user_subscriptions_effective_lookup
  on public.user_subscriptions(user_id, current_period_end desc, created_at desc);

create table public.entitlement_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement_key text not null check (entitlement_key ~ '^[a-z][a-z0-9_.]{1,80}$'),
  value_type text not null check (value_type in ('integer', 'boolean', 'text')),
  integer_value bigint,
  boolean_value boolean,
  text_value text,
  reason text not null check (btrim(reason) <> '' and char_length(reason) <= 500),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check (
    (value_type = 'integer' and integer_value is not null and boolean_value is null and text_value is null)
    or (value_type = 'boolean' and integer_value is null and boolean_value is not null and text_value is null)
    or (value_type = 'text' and integer_value is null and boolean_value is null and text_value is not null)
  )
);
create index entitlement_overrides_lookup
  on public.entitlement_overrides(user_id, entitlement_key, expires_at desc, created_at desc);

create table public.usage_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_key text not null check (usage_key ~ '^[a-z][a-z0-9_.]{1,80}$'),
  period_kind text not null check (period_kind in ('calendar_month', 'rolling_day')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  plan_id text not null references public.plans(id),
  created_at timestamptz not null default now(),
  check (period_end > period_start),
  unique (user_id, usage_key, period_kind, period_start)
);
create index usage_periods_active_lookup
  on public.usage_periods(user_id, usage_key, period_kind, period_end desc);

create table public.quota_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_key text not null check (usage_key ~ '^[a-z][a-z0-9_.]{1,80}$'),
  period_id uuid references public.usage_periods(id) on delete restrict,
  idempotency_key uuid not null,
  correlation_id uuid not null,
  status text not null check (status in ('reserved', 'finalized', 'refunded', 'expired')),
  requested_amount bigint not null check (requested_amount > 0),
  actual_amount bigint check (actual_amount is null or actual_amount >= 0),
  expires_at timestamptz not null,
  finalized_at timestamptz,
  refunded_at timestamptz,
  refund_reason text check (refund_reason is null or char_length(refund_reason) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, usage_key, idempotency_key),
  check (finalized_at is null or status in ('finalized', 'refunded')),
  check ((status = 'refunded') = (refunded_at is not null))
);
create index quota_reservations_capacity_lookup
  on public.quota_reservations(period_id, status, expires_at);

create table public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_key text not null check (usage_key ~ '^[a-z][a-z0-9_.]{1,80}$'),
  period_id uuid references public.usage_periods(id) on delete restrict,
  reservation_id uuid references public.quota_reservations(id) on delete restrict,
  entry_type text not null check (entry_type in ('debit', 'credit', 'adjustment')),
  amount bigint not null check (amount > 0),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, usage_key, idempotency_key),
  unique (reservation_id, entry_type)
);
create index usage_ledger_period_lookup on public.usage_ledger(period_id, created_at);

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_kind text not null check (job_kind in ('document_extract', 'document_analyze', 'document_generate', 'typing_ai_review')),
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'expired')),
  idempotency_key uuid not null,
  correlation_id uuid not null,
  reservation_id uuid references public.quota_reservations(id) on delete set null,
  provider text,
  provider_request_id text,
  error_code text check (error_code is null or error_code ~ '^[A-Z0-9_.-]{1,80}$'),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_kind, idempotency_key),
  unique (provider, provider_request_id),
  check (finished_at is null or started_at is null or finished_at >= started_at)
);
create index processing_jobs_concurrency_lookup on public.processing_jobs(user_id, job_kind, status);

-- Seed plans and the approved entitlement v1. Re-running the migration is not
-- expected, but these upserts keep local reset/dev fixtures deterministic.
insert into public.plans (id) values ('free'), ('pro_monthly'), ('pro_yearly')
on conflict (id) do nothing;

insert into public.plan_entitlements (plan_id, entitlement_key, value_type, integer_value)
values
  ('free','sets.regular.max','integer',20),('pro_monthly','sets.regular.max','integer',200),('pro_yearly','sets.regular.max','integer',200),
  ('free','cards.total.max','integer',3000),('pro_monthly','cards.total.max','integer',30000),('pro_yearly','cards.total.max','integer',30000),
  ('free','collections.max','integer',10),('pro_monthly','collections.max','integer',100),('pro_yearly','collections.max','integer',100),
  ('free','card.side_chars.soft_max','integer',5000),('pro_monthly','card.side_chars.soft_max','integer',20000),('pro_yearly','card.side_chars.soft_max','integer',20000),
  ('free','ai.content_credits.monthly','integer',20),('pro_monthly','ai.content_credits.monthly','integer',300),('pro_yearly','ai.content_credits.monthly','integer',300),
  ('free','ai.typing_reviews.monthly','integer',100),('pro_monthly','ai.typing_reviews.monthly','integer',2000),('pro_yearly','ai.typing_reviews.monthly','integer',2000),
  ('free','documents.heavy_jobs.monthly','integer',10),('pro_monthly','documents.heavy_jobs.monthly','integer',100),('pro_yearly','documents.heavy_jobs.monthly','integer',100),
  ('free','documents.heavy_jobs.rolling_day','integer',2),('pro_monthly','documents.heavy_jobs.rolling_day','integer',10),('pro_yearly','documents.heavy_jobs.rolling_day','integer',10),
  ('free','jobs.heavy.concurrent','integer',1),('pro_monthly','jobs.heavy.concurrent','integer',2),('pro_yearly','jobs.heavy.concurrent','integer',2)
on conflict (plan_id, entitlement_key) do nothing;

alter table public.plans enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.entitlement_overrides enable row level security;
alter table public.usage_periods enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.quota_reservations enable row level security;
alter table public.processing_jobs enable row level security;

create policy "plans_select_authenticated" on public.plans for select to authenticated using (true);
create policy "plan_entitlements_select_authenticated" on public.plan_entitlements for select to authenticated using (true);
create policy "user_subscriptions_select_own" on public.user_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "usage_periods_select_own" on public.usage_periods for select to authenticated using (user_id = auth.uid());
create policy "usage_ledger_select_own" on public.usage_ledger for select to authenticated using (user_id = auth.uid());
create policy "quota_reservations_select_own" on public.quota_reservations for select to authenticated using (user_id = auth.uid());
create policy "processing_jobs_select_own" on public.processing_jobs for select to authenticated using (user_id = auth.uid());

revoke all on table public.plans, public.plan_entitlements, public.user_subscriptions, public.entitlement_overrides, public.usage_periods, public.usage_ledger, public.quota_reservations, public.processing_jobs from public, anon, authenticated;
grant select on table public.plans, public.plan_entitlements, public.user_subscriptions, public.usage_periods, public.usage_ledger, public.quota_reservations, public.processing_jobs to authenticated;
grant all privileges on table public.plans, public.plan_entitlements, public.user_subscriptions, public.entitlement_overrides, public.usage_periods, public.usage_ledger, public.quota_reservations, public.processing_jobs to service_role;

drop trigger if exists set_updated_at on public.plans;
create trigger set_updated_at before update on public.plans for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.plan_entitlements;
create trigger set_updated_at before update on public.plan_entitlements for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.user_subscriptions;
create trigger set_updated_at before update on public.user_subscriptions for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.quota_reservations;
create trigger set_updated_at before update on public.quota_reservations for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.processing_jobs;
create trigger set_updated_at before update on public.processing_jobs for each row execute function public.set_updated_at();

-- The service layer resolves every entitlement through these functions. They
-- are service-role only because callers must derive p_user_id from a verified
-- server session, never from a browser payload.
create or replace function public.get_effective_plan(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan_id text;
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'user id is required';
  end if;

  select s.plan_id into v_plan_id
  from public.user_subscriptions s
  join public.plans p on p.id = s.plan_id and p.active
  where s.user_id = p_user_id
    and (
      (s.status in ('active', 'cancel_at_period_end', 'past_due') and (s.current_period_end is null or s.current_period_end > now()))
      or (s.status = 'grace' and s.grace_ends_at > now())
    )
  order by s.current_period_end desc nulls last, s.created_at desc
  limit 1;

  return coalesce(v_plan_id, 'free');
end;
$$;

create or replace function public.get_effective_entitlement(p_user_id uuid, p_entitlement_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_override public.entitlement_overrides%rowtype;
  v_entitlement public.plan_entitlements%rowtype;
  v_plan_id text;
begin
  if p_user_id is null or p_entitlement_key is null or p_entitlement_key !~ '^[a-z][a-z0-9_.]{1,80}$' then
    raise exception using errcode = '22023', message = 'invalid entitlement input';
  end if;

  select * into v_override
  from public.entitlement_overrides
  where user_id = p_user_id
    and entitlement_key = p_entitlement_key
    and (expires_at is null or expires_at > now())
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'source', 'override', 'value_type', v_override.value_type,
      'integer_value', v_override.integer_value, 'boolean_value', v_override.boolean_value,
      'text_value', v_override.text_value
    );
  end if;

  v_plan_id := public.get_effective_plan(p_user_id);
  select * into v_entitlement
  from public.plan_entitlements
  where plan_id = v_plan_id and entitlement_key = p_entitlement_key;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'source', 'plan', 'plan_id', v_plan_id, 'value_type', v_entitlement.value_type,
    'integer_value', v_entitlement.integer_value, 'boolean_value', v_entitlement.boolean_value,
    'text_value', v_entitlement.text_value, 'effective_version', v_entitlement.effective_version
  );
end;
$$;

revoke all on function public.get_effective_plan(uuid) from public, anon, authenticated;
revoke all on function public.get_effective_entitlement(uuid, text) from public, anon, authenticated;
grant execute on function public.get_effective_plan(uuid) to service_role;
grant execute on function public.get_effective_entitlement(uuid, text) to service_role;

create or replace function public.reserve_usage(
  p_user_id uuid,
  p_usage_key text,
  p_requested_amount bigint,
  p_idempotency_key uuid,
  p_correlation_id uuid
)
returns table(reservation_id uuid, reservation_status text, allowed boolean, remaining bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.quota_reservations%rowtype;
  v_period_id uuid;
  v_period_kind text;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_limit bigint;
  v_consumed bigint;
  v_pending bigint;
begin
  if p_user_id is null or p_requested_amount is null or p_requested_amount <= 0 or p_idempotency_key is null or p_correlation_id is null then
    raise exception using errcode = '22023', message = 'invalid usage reservation input';
  end if;

  select * into v_existing from public.quota_reservations
  where user_id = p_user_id and usage_key = p_usage_key and idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.id, v_existing.status, v_existing.status in ('reserved', 'finalized'), 0::bigint;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_usage_key, 0));
  select (public.get_effective_entitlement(p_user_id, p_usage_key)->>'integer_value')::bigint into v_limit;
  if v_limit is null then
    raise exception using errcode = '22023', message = 'unknown or non-numeric usage key';
  end if;

  v_period_kind := case when p_usage_key = 'documents.heavy_jobs.rolling_day' then 'rolling_day' else 'calendar_month' end;
  v_period_start := case when v_period_kind = 'rolling_day' then date_trunc('day', now() at time zone 'UTC') else date_trunc('month', now() at time zone 'UTC') end;
  v_period_end := case when v_period_kind = 'rolling_day' then v_period_start + interval '1 day' else v_period_start + interval '1 month' end;

  insert into public.usage_periods(user_id, usage_key, period_kind, period_start, period_end, plan_id)
  values (p_user_id, p_usage_key, v_period_kind, v_period_start, v_period_end, public.get_effective_plan(p_user_id))
  on conflict (user_id, usage_key, period_kind, period_start) do update set plan_id = excluded.plan_id
  returning id into v_period_id;

  if v_period_kind = 'rolling_day' then
    select coalesce(sum(case when entry_type = 'credit' then -amount else amount end), 0) into v_consumed
    from public.usage_ledger where user_id = p_user_id and usage_key = p_usage_key and created_at > now() - interval '24 hours';
    select coalesce(sum(requested_amount), 0) into v_pending
    from public.quota_reservations where user_id = p_user_id and usage_key = p_usage_key and status = 'reserved' and expires_at > now() and created_at > now() - interval '24 hours';
  else
    select coalesce(sum(case when entry_type = 'credit' then -amount else amount end), 0) into v_consumed
    from public.usage_ledger where period_id = v_period_id;
    select coalesce(sum(requested_amount), 0) into v_pending
    from public.quota_reservations where period_id = v_period_id and status = 'reserved' and expires_at > now();
  end if;

  if v_consumed + v_pending + p_requested_amount > v_limit then
    return query select null::uuid, 'denied'::text, false, greatest(v_limit - v_consumed - v_pending, 0);
    return;
  end if;

  insert into public.quota_reservations(user_id, usage_key, period_id, idempotency_key, correlation_id, status, requested_amount, expires_at)
  values (p_user_id, p_usage_key, v_period_id, p_idempotency_key, p_correlation_id, 'reserved', p_requested_amount, now() + interval '15 minutes')
  returning id into reservation_id;
  return query select reservation_id, 'reserved'::text, true, v_limit - v_consumed - v_pending - p_requested_amount;
end;
$$;

create or replace function public.finalize_usage(p_reservation_id uuid, p_actual_amount bigint)
returns public.quota_reservations
language plpgsql security definer set search_path = '' as $$
declare v_res public.quota_reservations%rowtype;
begin
  if p_reservation_id is null or p_actual_amount is null or p_actual_amount < 0 then raise exception using errcode = '22023', message = 'invalid usage finalization input'; end if;
  select * into v_res from public.quota_reservations where id = p_reservation_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'reservation not found'; end if;
  if v_res.status = 'finalized' then return v_res; end if;
  if v_res.status <> 'reserved' or v_res.expires_at <= now() then raise exception using errcode = '22023', message = 'reservation is not active'; end if;
  if p_actual_amount > v_res.requested_amount then raise exception using errcode = '22023', message = 'actual usage exceeds reservation'; end if;
  update public.quota_reservations set status = 'finalized', actual_amount = p_actual_amount, finalized_at = now() where id = v_res.id returning * into v_res;
  if p_actual_amount > 0 then insert into public.usage_ledger(user_id, usage_key, period_id, reservation_id, entry_type, amount, idempotency_key) values (v_res.user_id, v_res.usage_key, v_res.period_id, v_res.id, 'debit', p_actual_amount, v_res.id); end if;
  return v_res;
end;
$$;

create or replace function public.refund_usage(p_reservation_id uuid, p_reason text)
returns public.quota_reservations
language plpgsql security definer set search_path = '' as $$
declare v_res public.quota_reservations%rowtype; v_refund_key uuid;
begin
  if p_reservation_id is null or p_reason is null or btrim(p_reason) = '' then raise exception using errcode = '22023', message = 'invalid usage refund input'; end if;
  select * into v_res from public.quota_reservations where id = p_reservation_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'reservation not found'; end if;
  if v_res.status = 'refunded' then return v_res; end if;
  if v_res.status = 'finalized' and coalesce(v_res.actual_amount, 0) > 0 then
    v_refund_key := (substr(md5(v_res.id::text || ':refund'),1,8)||'-'||substr(md5(v_res.id::text || ':refund'),9,4)||'-'||substr(md5(v_res.id::text || ':refund'),13,4)||'-'||substr(md5(v_res.id::text || ':refund'),17,4)||'-'||substr(md5(v_res.id::text || ':refund'),21,12))::uuid;
    insert into public.usage_ledger(user_id, usage_key, period_id, reservation_id, entry_type, amount, idempotency_key) values (v_res.user_id, v_res.usage_key, v_res.period_id, v_res.id, 'credit', v_res.actual_amount, v_refund_key) on conflict (reservation_id, entry_type) do nothing;
  end if;
  update public.quota_reservations set status = 'refunded', refunded_at = now(), refund_reason = left(btrim(p_reason), 120) where id = v_res.id returning * into v_res;
  return v_res;
end;
$$;

revoke all on function public.reserve_usage(uuid,text,bigint,uuid,uuid), public.finalize_usage(uuid,bigint), public.refund_usage(uuid,text) from public, anon, authenticated;
grant execute on function public.reserve_usage(uuid,text,bigint,uuid,uuid), public.finalize_usage(uuid,bigint), public.refund_usage(uuid,text) to service_role;
