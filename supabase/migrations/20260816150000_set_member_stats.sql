-- S6: classroom member stats RPC for the teacher.
--
-- Additive migration: adds a single SECURITY DEFINER RPC. No schema changes.
--
-- Semantics:
--   - Owner-only read: the set must belong to p_user_id, otherwise the RPC
--     raises a generic 42501 so a non-owner cannot probe which sets exist.
--   - Returns one row per member of the shared set (shared_set_memberships),
--     joining profiles for display data.
--   - Quiz stats are per-card: a question counts only when its flashcard
--     belongs to the member's clone set (flashcards.set_id = clone_set_id) and
--     the quiz session is completed. This is independent of the quiz session's
--     source scope, so sessions from "all cards" only contribute the questions
--     that actually touch the clone set.
--   - Match stats use the clone set in the source: source_set_ids must contain
--     the member's clone_set_id and the attempt must be completed. Each wrong
--     attempt counts in total_questions (correct + incorrect pairs).
--   - Ranking: correct desc -> total desc -> joined_at asc. Members with no
--     activity (total = 0) always sort after active members.
--   - Grants: authenticated + service_role only (owner UI reads through the
--     authenticated client; service_role is for server-side/admin flows).
--     Never granted to anon. RLS is untouched.
--
-- accuracy is a percentage 0-100 rounded to one decimal (72.2 = 72.2%), and
-- NULL when the member has no answered questions yet.

create or replace function public.get_set_members_with_stats(
  p_user_id uuid,
  p_set_id uuid
)
returns table (
  rank integer,
  member_user_id uuid,
  display_name text,
  avatar_url text,
  joined_at timestamptz,
  total_questions integer,
  correct_questions integer,
  accuracy numeric,
  last_activity_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_set_id is null then
    raise exception 'invalid set id' using errcode = '22023';
  end if;

  perform 1
  from public.flashcard_sets
  where id = p_set_id and user_id = p_user_id;
  if not found then
    raise exception 'not found or not owner' using errcode = '42501';
  end if;

  return query
  with quiz_stats as (
    select
      m.member_user_id,
      count(*) as quiz_total,
      count(*) filter (where q.is_correct) as quiz_correct,
      max(s.completed_at) as quiz_last
    from public.quiz_questions q
    join public.quiz_sessions s on s.id = q.session_id
    join public.flashcards f on f.id = q.flashcard_id
    join public.shared_set_memberships m
      on m.clone_set_id = f.set_id
     and m.member_user_id = q.user_id
    where m.set_id = p_set_id
      and s.completed_at is not null
      and q.is_correct is not null
    group by m.member_user_id
  ),
  match_stats as (
    select
      m.member_user_id,
      coalesce(sum(a.correct_pair_count), 0) as match_correct,
      coalesce(sum(a.correct_pair_count + a.incorrect_attempt_count), 0) as match_total,
      max(a.completed_at) as match_last
    from public.shared_set_memberships m
    left join public.match_attempts a
      on a.user_id = m.member_user_id
     and a.completed_at is not null
     and a.source_set_ids @> array[m.clone_set_id]
    where m.set_id = p_set_id
    group by m.member_user_id
  ),
  member_stats as (
    select
      m.member_user_id,
      m.joined_at,
      coalesce(q.quiz_total, 0)::integer as quiz_total,
      coalesce(q.quiz_correct, 0)::integer as quiz_correct,
      coalesce(mt.match_total, 0)::integer as match_total,
      coalesce(mt.match_correct, 0)::integer as match_correct,
      greatest(q.quiz_last, mt.match_last) as last_activity_at
    from public.shared_set_memberships m
    left join quiz_stats q on q.member_user_id = m.member_user_id
    left join match_stats mt on mt.member_user_id = m.member_user_id
    where m.set_id = p_set_id
  )
  select
    row_number() over (
      order by
        (case when (ms.quiz_total + ms.match_total) > 0 then 0 else 1 end),
        (ms.quiz_correct + ms.match_correct) desc,
        (ms.quiz_total + ms.match_total) desc,
        ms.joined_at asc
    )::integer as rank,
    ms.member_user_id,
    p.display_name,
    p.avatar_url,
    ms.joined_at,
    ms.quiz_total + ms.match_total as total_questions,
    ms.quiz_correct + ms.match_correct as correct_questions,
    case
      when ms.quiz_total + ms.match_total > 0
      then round(
        (ms.quiz_correct + ms.match_correct)::numeric
        / (ms.quiz_total + ms.match_total)
        * 100,
        1
      )
      else null
    end as accuracy,
    ms.last_activity_at
  from member_stats ms
  left join public.profiles p on p.id = ms.member_user_id
  order by rank;
end;
$$;

comment on function public.get_set_members_with_stats(uuid, uuid) is
  'Classroom stats per member of a shared set, owner-only. Returns rank, display info, total/correct questions and accuracy (percentage, one decimal) scoped to the member''s clone set for both quiz (per-card) and match (source contains clone set). Members with no activity rank last. Authenticated + service_role only.';

revoke all on function public.get_set_members_with_stats(uuid, uuid) from public, anon;
grant execute on function public.get_set_members_with_stats(uuid, uuid) to authenticated;
grant execute on function public.get_set_members_with_stats(uuid, uuid) to service_role;