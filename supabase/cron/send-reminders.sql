-- CapyStudy — pg_cron job for the send-reminders edge function (RUNBOOK).
--
-- This file is NOT a migration: the job URL and auth secret differ per
-- environment, so it is applied manually after the function is deployed and
-- the secrets are set. Run it in the Supabase SQL editor (or `supabase db
-- execute` locally) with the real values substituted.
--
-- Steps before running this:
--   1. supabase functions deploy send-reminders
--   2. supabase secrets set --env-file .env.reminders   (CRON_SECRET,
--      VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)
--   3. Replace <PROJECT_REF> and <CRON_SECRET> below, then run this SQL.

-- The migration already created the pg_cron + pg_net extensions; keep the
-- job idempotent by unscheduling any previous job with the same name first.
select cron.unschedule('capystudy-send-reminders')
where exists (select 1 from cron.job where jobname = 'capystudy-send-reminders');

select cron.schedule(
  'capystudy-send-reminders',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'
  )
  $cron$
);

-- Verify:
--   select jobname, schedule from cron.job where jobname = 'capystudy-send-reminders';
--   select status, status_code from net._http_response order by created desc limit 5;
