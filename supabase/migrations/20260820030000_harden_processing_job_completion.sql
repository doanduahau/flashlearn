-- Task LP-08 remediation: Harden processing job completion.
--
-- Additive migration:
--   1. finish_processing_job gains a status guard: a job may only be finished
--      from an active state ('queued'/'running') or replayed with the exact
--      same terminal status (idempotent retry). A stale retry can no longer
--      overwrite a settled outcome such as 'expired' -> 'succeeded'.
--   2. reconcile_stale_processing_jobs() gains a periodic caller. The function
--      existed since the AI heavy-jobs migration but had no caller, so stale
--      'running' jobs were only caught lazily by begin_processing_job_phase.
--      Unlike the send-reminders cron (env-specific URL + secret), this job
--      needs no environment configuration, so the schedule lives here.
--
-- Security: redefining keeps the existing grants; the revoke/grant block below
-- is re-asserted so a fresh database ends up with the same ACL.

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
declare v_current text;
begin
  if p_job_id is null or p_user_id is null or p_status not in ('succeeded','failed','cancelled','expired','reconcile_required')
     or p_output_items < 0 or p_provider_input_tokens < 0 or p_provider_output_tokens < 0
     or (p_error_code is not null and p_error_code !~ '^[A-Z0-9_.-]{1,80}$') then
    raise exception using errcode = '22023', message = 'invalid processing job completion';
  end if;

  select status into v_current from public.processing_jobs
  where id = p_job_id and user_id = p_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'processing job not found';
  end if;

  if v_current not in ('queued','running') and v_current <> p_status then
    -- The job was already settled to a different terminal state (e.g. a stale
    -- retry after reconcile/expiry). Rejecting keeps the last write meaningful
    -- and prevents a late success from erasing an audit-visible failure.
    raise exception using errcode = '55000', message = 'processing job is already finished';
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
end;
$$;

select cron.unschedule('capystudy-reconcile-processing-jobs')
where exists (select 1 from cron.job where jobname = 'capystudy-reconcile-processing-jobs');

select cron.schedule(
  'capystudy-reconcile-processing-jobs',
  '*/30 * * * *',
  $cron$
  select public.reconcile_stale_processing_jobs()
  $cron$
);

revoke all on function public.finish_processing_job(uuid,uuid,text,text,integer,bigint,bigint)
from public, anon, authenticated;
grant execute on function public.finish_processing_job(uuid,uuid,text,text,integer,bigint,bigint)
to service_role;

comment on function public.finish_processing_job(uuid,uuid,text,text,integer,bigint,bigint) is
  'Completes a processing job. Only active jobs or idempotent replays of the same terminal status are accepted.';