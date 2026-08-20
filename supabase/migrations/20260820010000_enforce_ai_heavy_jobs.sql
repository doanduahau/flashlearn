-- LP-08: durable AI/heavy job lifecycle, physical-call budget and typing batch replay.
-- Browser roles remain read-only; every mutation is service-role-only and derives
-- plan/user state from trusted server context.

alter table public.processing_jobs
  drop constraint if exists processing_jobs_job_kind_check;
alter table public.processing_jobs
  add constraint processing_jobs_job_kind_check check (job_kind in (
    'paste_generate', 'google_sheets_generate', 'document_pipeline', 'typing_ai_review',
    'document_extract', 'document_analyze', 'document_generate'
  ));

alter table public.processing_jobs
  drop constraint if exists processing_jobs_status_check;
alter table public.processing_jobs
  add constraint processing_jobs_status_check check (status in (
    'queued', 'running', 'succeeded', 'failed', 'cancelled', 'expired', 'reconcile_required'
  ));

alter table public.processing_jobs
  add column plan_id text references public.plans(id),
  add column source_type text check (
    source_type is null or source_type in ('paste_prose', 'google_sheets_semantic', 'docx', 'pdf', 'typing')
  ),
  add column physical_call_limit integer not null default 1 check (physical_call_limit between 1 and 100),
  add column physical_calls integer not null default 0 check (physical_calls >= 0),
  add column input_characters bigint not null default 0 check (input_characters >= 0),
  add column output_items integer not null default 0 check (output_items >= 0),
  add column provider_input_tokens bigint not null default 0 check (provider_input_tokens >= 0),
  add column provider_output_tokens bigint not null default 0 check (provider_output_tokens >= 0),
  add column last_heartbeat_at timestamptz not null default now();

create table public.processing_job_reservations (
  job_id uuid not null references public.processing_jobs(id) on delete cascade,
  reservation_id uuid not null references public.quota_reservations(id) on delete restrict,
  purpose text not null check (purpose in ('content_credit', 'typing_review', 'heavy_monthly', 'heavy_rolling_day')),
  created_at timestamptz not null default now(),
  primary key (job_id, purpose),
  unique (reservation_id)
);

create table public.typing_ai_job_results (
  job_id uuid not null references public.processing_jobs(id) on delete cascade,
  item_id uuid not null,
  correct boolean not null,
  created_at timestamptz not null default now(),
  primary key (job_id, item_id)
);

create table public.processing_job_outputs (
  job_id uuid not null references public.processing_jobs(id) on delete cascade,
  output_kind text not null check (output_kind in ('flashcards', 'document_analysis')),
  payload jsonb not null,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now(),
  primary key (job_id, output_kind),
  check (octet_length(payload::text) <= 10 * 1024 * 1024)
);

alter table public.processing_job_reservations enable row level security;
alter table public.typing_ai_job_results enable row level security;
alter table public.processing_job_outputs enable row level security;

create policy "processing_job_reservations_select_own"
on public.processing_job_reservations for select to authenticated
using (exists (
  select 1 from public.processing_jobs j where j.id = job_id and j.user_id = auth.uid()
));

create policy "typing_ai_job_results_select_own"
on public.typing_ai_job_results for select to authenticated
using (exists (
  select 1 from public.processing_jobs j where j.id = job_id and j.user_id = auth.uid()
));

create policy "processing_job_outputs_select_own"
on public.processing_job_outputs for select to authenticated
using (exists (
  select 1 from public.processing_jobs j where j.id = job_id and j.user_id = auth.uid()
));

revoke all on table public.processing_job_reservations, public.typing_ai_job_results,
  public.processing_job_outputs
  from public, anon, authenticated;
grant select on table public.processing_job_reservations, public.typing_ai_job_results,
  public.processing_job_outputs
  to authenticated;
grant all privileges on table public.processing_job_reservations, public.typing_ai_job_results,
  public.processing_job_outputs
  to service_role;

create or replace function public.start_processing_job(
  p_user_id uuid,
  p_job_kind text,
  p_source_type text,
  p_idempotency_key uuid,
  p_correlation_id uuid
)
returns table(job_id uuid, job_status text, replayed boolean, physical_call_limit integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.processing_jobs%rowtype;
  v_plan_id text;
  v_call_limit integer;
begin
  if p_user_id is null or p_idempotency_key is null or p_correlation_id is null
     or p_job_kind not in ('paste_generate','google_sheets_generate','document_pipeline','typing_ai_review')
     or p_source_type not in ('paste_prose','google_sheets_semantic','docx','pdf','typing') then
    raise exception using errcode = '22023', message = 'invalid processing job input';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_job_kind || ':' || p_idempotency_key::text, 0));
  select * into v_existing from public.processing_jobs
  where user_id = p_user_id and job_kind = p_job_kind and idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.id, v_existing.status, true, v_existing.physical_call_limit;
    return;
  end if;

  v_plan_id := public.get_effective_plan(p_user_id);
  v_call_limit := case when v_plan_id = 'free' then 5 else 20 end;
  insert into public.processing_jobs(
    user_id, job_kind, status, idempotency_key, correlation_id, provider,
    plan_id, source_type, physical_call_limit, last_heartbeat_at
  ) values (
    p_user_id, p_job_kind, 'queued', p_idempotency_key, p_correlation_id, 'gemini',
    v_plan_id, p_source_type, v_call_limit, now()
  ) returning id into job_id;

  return query select job_id, 'queued'::text, false, v_call_limit;
end;
$$;

create or replace function public.begin_processing_job_phase(p_job_id uuid, p_user_id uuid)
returns table(job_status text, concurrent_limit integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.processing_jobs%rowtype;
  v_limit integer;
  v_running integer;
begin
  if p_job_id is null or p_user_id is null then
    raise exception using errcode = '22023', message = 'invalid processing phase input';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':heavy-concurrency', 0));

  update public.processing_jobs set status = 'reconcile_required', updated_at = now()
  where user_id = p_user_id and status = 'running'
    and last_heartbeat_at < now() - interval '15 minutes' and physical_calls > 0;
  update public.processing_jobs set status = 'expired', finished_at = now(), updated_at = now()
  where user_id = p_user_id and status = 'running'
    and last_heartbeat_at < now() - interval '15 minutes' and physical_calls = 0;

  select * into v_job from public.processing_jobs
  where id = p_job_id and user_id = p_user_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'processing job not found'; end if;
  if v_job.status not in ('queued','running') then
    raise exception using errcode = '22023', message = 'processing job is not active';
  end if;

  v_limit := coalesce((public.get_effective_entitlement(p_user_id, 'jobs.heavy.concurrent')->>'integer_value')::integer, 1);
  select count(*)::integer into v_running from public.processing_jobs
  where user_id = p_user_id and status = 'running' and id <> p_job_id
    and last_heartbeat_at >= now() - interval '15 minutes';
  if v_running >= v_limit then
    raise exception using errcode = 'P0001', message = 'processing job concurrency exceeded';
  end if;

  update public.processing_jobs set status = 'running', started_at = coalesce(started_at, now()),
    last_heartbeat_at = now(), updated_at = now() where id = p_job_id;
  return query select 'running'::text, v_limit;
end;
$$;

create or replace function public.record_processing_job_call(
  p_job_id uuid,
  p_user_id uuid,
  p_input_characters bigint
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_calls integer;
begin
  if p_job_id is null or p_user_id is null or p_input_characters is null or p_input_characters < 0 then
    raise exception using errcode = '22023', message = 'invalid provider call input';
  end if;
  update public.processing_jobs
  set physical_calls = physical_calls + 1,
      input_characters = input_characters + p_input_characters,
      last_heartbeat_at = now(), updated_at = now()
  where id = p_job_id and user_id = p_user_id and status = 'running'
    and physical_calls < physical_call_limit
  returning physical_calls into v_calls;
  if v_calls is null then
    raise exception using errcode = 'P0001', message = 'physical provider call limit exceeded';
  end if;
  return v_calls;
end;
$$;

create or replace function public.pause_processing_job(p_job_id uuid, p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.processing_jobs set status = 'queued', last_heartbeat_at = now(), updated_at = now()
  where id = p_job_id and user_id = p_user_id and status = 'running';
$$;

create or replace function public.finish_processing_job(
  p_job_id uuid,
  p_user_id uuid,
  p_status text,
  p_error_code text default null,
  p_output_items integer default 0,
  p_provider_input_tokens bigint default 0,
  p_provider_output_tokens bigint default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_job_id is null or p_user_id is null or p_status not in ('succeeded','failed','cancelled','expired','reconcile_required')
     or p_output_items < 0 or p_provider_input_tokens < 0 or p_provider_output_tokens < 0
     or (p_error_code is not null and p_error_code !~ '^[A-Z0-9_.-]{1,80}$') then
    raise exception using errcode = '22023', message = 'invalid processing job completion';
  end if;
  update public.processing_jobs set status = p_status, error_code = p_error_code,
    output_items = p_output_items, provider_input_tokens = p_provider_input_tokens,
    provider_output_tokens = p_provider_output_tokens, finished_at = now(),
    last_heartbeat_at = now(), updated_at = now()
  where id = p_job_id and user_id = p_user_id;
  if not found then raise exception using errcode = 'P0002', message = 'processing job not found'; end if;
end;
$$;

create or replace function public.link_processing_job_reservation(
  p_job_id uuid,
  p_user_id uuid,
  p_reservation_id uuid,
  p_purpose text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_purpose not in ('content_credit','typing_review','heavy_monthly','heavy_rolling_day') then
    raise exception using errcode = '22023', message = 'invalid reservation purpose';
  end if;
  if not exists (select 1 from public.processing_jobs where id = p_job_id and user_id = p_user_id)
     or not exists (select 1 from public.quota_reservations where id = p_reservation_id and user_id = p_user_id) then
    raise exception using errcode = '42501', message = 'reservation ownership mismatch';
  end if;
  insert into public.processing_job_reservations(job_id, reservation_id, purpose)
  values (p_job_id, p_reservation_id, p_purpose)
  on conflict (job_id, purpose) do nothing;
end;
$$;

create or replace function public.store_typing_ai_job_results(
  p_job_id uuid,
  p_user_id uuid,
  p_results jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_item jsonb;
begin
  if p_results is null or jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) > 100 then
    raise exception using errcode = '22023', message = 'invalid typing result batch';
  end if;
  if not exists (
    select 1 from public.processing_jobs
    where id = p_job_id and user_id = p_user_id and job_kind = 'typing_ai_review'
  ) then raise exception using errcode = '42501', message = 'typing job ownership mismatch'; end if;

  for v_item in select value from jsonb_array_elements(p_results) loop
    if jsonb_typeof(v_item->'correct') <> 'boolean' or (v_item->>'item_id') is null then
      raise exception using errcode = '22023', message = 'invalid typing result item';
    end if;
    insert into public.typing_ai_job_results(job_id, item_id, correct)
    values (p_job_id, (v_item->>'item_id')::uuid, (v_item->>'correct')::boolean)
    on conflict (job_id, item_id) do update set correct = excluded.correct;
  end loop;
end;
$$;

create or replace function public.reconcile_stale_processing_jobs()
returns table(expired_without_provider integer, requires_review integer)
language plpgsql
security definer
set search_path = ''
as $$
declare v_expired integer; v_review integer;
begin
  with stale as (
    update public.processing_jobs set status = 'expired', finished_at = now(), updated_at = now()
    where status in ('queued','running') and physical_calls = 0
      and last_heartbeat_at < now() - interval '2 hours'
    returning id
  ) select count(*)::integer into v_expired from stale;

  with stale as (
    update public.processing_jobs set status = 'reconcile_required', updated_at = now()
    where status in ('queued','running') and physical_calls > 0
      and last_heartbeat_at < now() - interval '2 hours'
    returning id
  ) select count(*)::integer into v_review from stale;

  update public.quota_reservations r set status = 'refunded', refunded_at = now(),
    refund_reason = 'job_expired_before_provider_call', updated_at = now()
  from public.processing_job_reservations jr
  join public.processing_jobs j on j.id = jr.job_id
  where r.id = jr.reservation_id and r.status = 'reserved' and j.status = 'expired'
    and j.physical_calls = 0;

  return query select v_expired, v_review;
end;
$$;

revoke all on function public.start_processing_job(uuid,text,text,uuid,uuid),
  public.begin_processing_job_phase(uuid,uuid),
  public.record_processing_job_call(uuid,uuid,bigint),
  public.pause_processing_job(uuid,uuid),
  public.finish_processing_job(uuid,uuid,text,text,integer,bigint,bigint),
  public.link_processing_job_reservation(uuid,uuid,uuid,text),
  public.store_typing_ai_job_results(uuid,uuid,jsonb),
  public.reconcile_stale_processing_jobs()
from public, anon, authenticated;

grant execute on function public.start_processing_job(uuid,text,text,uuid,uuid),
  public.begin_processing_job_phase(uuid,uuid),
  public.record_processing_job_call(uuid,uuid,bigint),
  public.pause_processing_job(uuid,uuid),
  public.finish_processing_job(uuid,uuid,text,text,integer,bigint,bigint),
  public.link_processing_job_reservation(uuid,uuid,uuid,text),
  public.store_typing_ai_job_results(uuid,uuid,jsonb),
  public.reconcile_stale_processing_jobs()
to service_role;

comment on function public.reconcile_stale_processing_jobs() is
  'Expires stale jobs with no provider evidence and marks jobs with provider calls for manual reconciliation; it never guesses usage after a provider call.';
