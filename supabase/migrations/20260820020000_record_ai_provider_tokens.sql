create or replace function public.record_processing_job_tokens(
  p_job_id uuid,
  p_user_id uuid,
  p_provider_input_tokens bigint,
  p_provider_output_tokens bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_job_id is null or p_user_id is null
     or p_provider_input_tokens is null or p_provider_input_tokens < 0
     or p_provider_output_tokens is null or p_provider_output_tokens < 0 then
    raise exception using errcode = '22023', message = 'invalid provider token usage';
  end if;

  update public.processing_jobs
  set provider_input_tokens = provider_input_tokens + p_provider_input_tokens,
      provider_output_tokens = provider_output_tokens + p_provider_output_tokens,
      last_heartbeat_at = now(),
      updated_at = now()
  where id = p_job_id and user_id = p_user_id
    and status in ('running', 'queued');

  if not found then
    raise exception using errcode = 'P0002', message = 'processing job not found';
  end if;
end;
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

  update public.processing_jobs
  set status = p_status,
      error_code = p_error_code,
      output_items = p_output_items,
      provider_input_tokens = provider_input_tokens + p_provider_input_tokens,
      provider_output_tokens = provider_output_tokens + p_provider_output_tokens,
      finished_at = now(),
      last_heartbeat_at = now(),
      updated_at = now()
  where id = p_job_id and user_id = p_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'processing job not found';
  end if;
end;
$$;

revoke all on function public.record_processing_job_tokens(uuid,uuid,bigint,bigint)
from public, anon, authenticated;
grant execute on function public.record_processing_job_tokens(uuid,uuid,bigint,bigint)
to service_role;

comment on function public.record_processing_job_tokens(uuid,uuid,bigint,bigint) is
  'Accumulates provider-reported token usage for cost observability without exposing prompts or responses.';
