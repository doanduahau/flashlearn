-- S5: persist completed Match results for classroom stats (S6/S7).
--
-- Additive migration: adds one table (match_attempts) and one service-role-only
-- SECURITY DEFINER RPC (save_match_attempt). No schema changes to existing
-- tables.
--
-- Semantics:
--   - A match_attempts row is the final snapshot of one completed Match
--     session: source scope, total pairs, correct pair count, incorrect
--     attempt count and elapsed time. The correct/incorrect counts are stored
--     as separate columns so classroom stats can rank students by correct
--     answers and compute accuracy from total answered questions.
--   - Coverage sessions stay untouched: match_attempts is written at the end
--     of a session independently, it is NOT merged with the coverage flow.
--   - Browser never writes this table directly. The server action calls the
--     RPC through the admin client, so grants are service_role only.
--   - Mirrors quiz_sessions for table grants (authenticated select-only) and
--     mirrors clone_shared_set (S4) for the service_role-only RPC.

create table public.match_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_set_ids uuid[] not null default '{}',
  source_collection_ids uuid[] not null default '{}',
  source_all boolean not null default false,
  total_pairs integer not null check (total_pairs > 0),
  correct_pair_count integer not null check (correct_pair_count >= 0 and correct_pair_count <= total_pairs),
  incorrect_attempt_count integer not null check (incorrect_attempt_count >= 0),
  elapsed_ms integer not null check (elapsed_ms >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (completed_at is null or completed_at >= started_at)
);

create index idx_match_attempts_user_completed on public.match_attempts(user_id, completed_at desc);

alter table public.match_attempts enable row level security;

create policy "match_attempts_select_own"
on public.match_attempts
for select
to authenticated
using (user_id = auth.uid());

revoke all on table public.match_attempts from public, anon, authenticated;
grant select on table public.match_attempts to authenticated;
grant all privileges on table public.match_attempts to service_role;

create or replace function public.save_match_attempt(
  p_user_id uuid,
  p_source_set_ids uuid[],
  p_source_collection_ids uuid[],
  p_source_all boolean,
  p_total_pairs integer,
  p_correct_pair_count integer,
  p_incorrect_attempt_count integer,
  p_elapsed_ms integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_set_ids uuid[] := coalesce(p_source_set_ids, '{}'::uuid[]);
  v_collection_ids uuid[] := coalesce(p_source_collection_ids, '{}'::uuid[]);
  v_attempt_id uuid;
begin
  if p_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_total_pairs is null or p_total_pairs <= 0
     or p_correct_pair_count is null or p_correct_pair_count < 0
     or p_correct_pair_count > p_total_pairs
     or p_incorrect_attempt_count is null or p_incorrect_attempt_count < 0
     or p_elapsed_ms is null or p_elapsed_ms < 0
     or array_position(v_set_ids, null) is not null
     or array_position(v_collection_ids, null) is not null then
    raise exception 'invalid match attempt' using errcode = '22023';
  end if;

  insert into public.match_attempts (
    user_id,
    source_set_ids,
    source_collection_ids,
    source_all,
    total_pairs,
    correct_pair_count,
    incorrect_attempt_count,
    elapsed_ms,
    started_at,
    completed_at
  )
  values (
    p_user_id,
    v_set_ids,
    v_collection_ids,
    coalesce(p_source_all, false),
    p_total_pairs,
    p_correct_pair_count,
    p_incorrect_attempt_count,
    p_elapsed_ms,
    now(),
    now()
  )
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

comment on function public.save_match_attempt(uuid, uuid[], uuid[], boolean, integer, integer, integer, integer) is
  'Records a completed Match attempt for the given user: source scope, total pairs, correct pair count, incorrect attempt count and elapsed time. Service-role only; the browser never writes match results directly.';

revoke all on function public.save_match_attempt(uuid, uuid[], uuid[], boolean, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.save_match_attempt(uuid, uuid[], uuid[], boolean, integer, integer, integer, integer) to service_role;