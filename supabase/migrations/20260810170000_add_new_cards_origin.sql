-- Add new_cards origin for the New Cards learning flow.
-- The trigger is updated to accept the new value; a dedicated service-role
-- wrapper sets the transaction-local config before creating the session.

alter table public.quiz_sessions
  drop constraint if exists quiz_sessions_origin_check;

alter table public.quiz_sessions
  add constraint quiz_sessions_origin_check
    check (origin in ('manual', 'smart_review', 'new_cards'));

create or replace function public.set_quiz_session_origin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origin text;
begin
  if tg_op = 'INSERT' then
    v_origin := coalesce(nullif(current_setting('flashlearn.quiz_session_origin', true), ''), 'manual');

    if v_origin not in ('manual', 'smart_review', 'new_cards') then
      raise exception 'invalid quiz session origin' using errcode = '22023';
    end if;

    new.origin := v_origin;
    return new;
  end if;

  if new.origin is distinct from old.origin then
    raise exception 'quiz session origin is immutable' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists quiz_sessions_set_origin on public.quiz_sessions;
create trigger quiz_sessions_set_origin
  before insert or update on public.quiz_sessions
  for each row
  execute function public.set_quiz_session_origin();

create or replace function public.create_owned_quiz_session_from_card_ids_new_cards(
  p_user_id uuid,
  p_card_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('flashlearn.quiz_session_origin', 'new_cards', true);
  return public.create_quiz_session_from_card_ids(p_card_ids);
end;
$$;

revoke all on function public.create_owned_quiz_session_from_card_ids_new_cards(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.create_owned_quiz_session_from_card_ids_new_cards(uuid, uuid[]) to service_role;

-- New Cards is an ownership-scoped read model.  Keep the anti-joins in
-- Postgres so Dashboard and session creation do not first materialize a user's
-- complete card/schedule/event graph in application memory.  The function has
-- no user-id argument: auth.uid() is the only owner boundary.
create index if not exists idx_flashcards_user_created_at_id
  on public.flashcards (user_id, created_at, id);

create index if not exists idx_card_review_events_schedulable_user_card
  on public.card_review_events (user_id, flashcard_id)
  where fsrs_rating between 1 and 4 or is_correct is not null;

create or replace function public.load_new_card_candidates(p_limit integer default 10)
returns table (
  total bigint,
  flashcard_id uuid,
  created_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  with genuine_new_cards as (
    select f.id, f.created_at
    from public.flashcards as f
    where f.user_id = auth.uid()
      and not exists (
        select 1
        from public.card_learning_schedule as schedule
        where schedule.user_id = auth.uid()
          and schedule.flashcard_id = f.id
      )
      and not exists (
        select 1
        from public.card_review_events as event
        where event.user_id = auth.uid()
          and event.flashcard_id = f.id
          and (
            event.fsrs_rating between 1 and 4
            or event.is_correct is not null
          )
      )
  ),
  counted as (
    select count(*)::bigint as total
    from genuine_new_cards
  )
  select counted.total, candidate.id, candidate.created_at
  from counted
  left join lateral (
    select id, created_at
    from genuine_new_cards
    order by created_at asc, id asc
    limit greatest(least(coalesce(p_limit, 10), 10), 0)
  ) as candidate on true
  order by candidate.created_at asc nulls last, candidate.id asc nulls last;
$$;

revoke all on function public.load_new_card_candidates(integer) from public, anon;
grant execute on function public.load_new_card_candidates(integer) to authenticated;
