-- Task W3: Push notifications backend foundation.
--
-- Additive migration:
--   1. push_subscriptions       — one row per browser push subscription
--      (endpoint + VAPID keys), written/deleted by the server actions in W4
--      through the admin client.
--   2. notification_preferences — one row per user: master toggle, two
--      independent reminder toggles (streak + review) each with a chosen
--      local time (default 19:00).
--   3. push_notifications_log   — audit + dedupe: one notification per
--      (user, kind, local_date), inserted by the send-reminders edge function.
--   4. get_due_review_card_count — count of cards whose LATEST answer is
--      wrong, merged across quiz (quiz_questions, completed sessions) and
--      match/typing (mode_answer_events) — mirrors the app-side
--      loadWrongAnswerCardIds used by the dashboard "Cần ôn" metric.
--   5. pg_cron + pg_net extensions so the hosted platform can schedule the
--      edge function. The cron JOB itself is intentionally NOT created here:
--      its function URL and auth secret differ per environment, so it lives
--      in supabase/cron/send-reminders.sql (runbook) instead.
--
-- Browser never writes these tables directly: W4 server actions use the admin
-- client (service_role). Table grants mirror quiz_sessions / match_attempts:
-- authenticated select-only, service_role all. push_notifications_log is
-- service_role only (audit — users never read it in this MVP).

-- ---------------------------------------------------------------------------
-- 0. Extensions (idempotent; hosted Supabase ships both)
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- 1. push_subscriptions
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

comment on table public.push_subscriptions is
  'Browser web-push subscriptions (endpoint + VAPID keys). Written and deleted by W4 server actions via the admin client; read by the send-reminders edge function.';

create index idx_push_subscriptions_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own"
on public.push_subscriptions
for select
to authenticated
using (user_id = auth.uid());

drop trigger if exists set_updated_at on public.push_subscriptions;
create trigger set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

revoke all on table public.push_subscriptions from public, anon, authenticated;
grant select on table public.push_subscriptions to authenticated;
grant all privileges on table public.push_subscriptions to service_role;

-- ---------------------------------------------------------------------------
-- 2. notification_preferences
-- ---------------------------------------------------------------------------

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default false,
  streak_enabled boolean not null default true,
  streak_time time not null default '19:00',
  review_enabled boolean not null default true,
  review_time time not null default '19:00',
  updated_at timestamptz not null default now()
);

comment on table public.notification_preferences is
  'Per-user notification settings: master push toggle, and independent streak / review reminders each with a chosen local send time (default 19:00).';

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_select_own"
on public.notification_preferences
for select
to authenticated
using (user_id = auth.uid());

drop trigger if exists set_updated_at on public.notification_preferences;
create trigger set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

revoke all on table public.notification_preferences from public, anon, authenticated;
grant select on table public.notification_preferences to authenticated;
grant all privileges on table public.notification_preferences to service_role;

-- ---------------------------------------------------------------------------
-- 3. push_notifications_log (audit + dedupe; service_role only)
-- ---------------------------------------------------------------------------

create table public.push_notifications_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('streak', 'review')),
  local_date date not null,
  sent_at timestamptz not null default now(),
  unique (user_id, kind, local_date)
);

comment on table public.push_notifications_log is
  'Audit + dedupe log written by the send-reminders edge function: at most one streak and one review notification per user per local day.';

create index idx_push_notifications_log_user on public.push_notifications_log(user_id, local_date);

alter table public.push_notifications_log enable row level security;

revoke all on table public.push_notifications_log from public, anon, authenticated;
grant all privileges on table public.push_notifications_log to service_role;

-- ---------------------------------------------------------------------------
-- 4. get_due_review_card_count
-- ---------------------------------------------------------------------------

-- Mirrors the app-side loadWrongAnswerCardIds (dashboard "Cần ôn"): a card is
-- due for review when its most recent answer across any quiz mode is wrong.
-- Security invoker: only ever called by the edge function as service_role,
-- which bypasses RLS, and the user id is passed explicitly.
create or replace function public.get_due_review_card_count(p_user_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from (
    select distinct on (flashcard_id) flashcard_id, is_correct
    from (
      select q.flashcard_id, q.is_correct, q.answered_at as answered_at, q.id::text as event_id
      from public.quiz_questions q
      join public.quiz_sessions s on s.id = q.session_id
      where q.user_id = p_user_id
        and q.flashcard_id is not null
        and q.is_correct is not null
        and q.answered_at is not null
        and s.completed_at is not null
      union all
      select m.flashcard_id, m.is_correct, m.answered_at as answered_at, m.id::text as event_id
      from public.mode_answer_events m
      where m.user_id = p_user_id
        and m.is_correct is not null
        and m.answered_at is not null
    ) answers
    order by flashcard_id, answered_at desc, event_id desc
  ) latest
  where latest.is_correct = false;
$$;

comment on function public.get_due_review_card_count(uuid) is
  'Count of the user''s cards whose latest answer across quiz / match / typing is wrong (the "Cần ôn" set). Returns 0 for unknown users.';

revoke all on function public.get_due_review_card_count(uuid) from public, anon, authenticated;
grant execute on function public.get_due_review_card_count(uuid) to service_role;
