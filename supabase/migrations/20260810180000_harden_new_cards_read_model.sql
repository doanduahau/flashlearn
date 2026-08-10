-- Forward migration: move the D1 New Cards read-model hardening that was
-- originally appended to 20260810170000 into its own additive migration.
--
-- Production already applied 20260810170000 WITHOUT these additions. This
-- migration adds the read-model indexes and the ownership-scoped New Card
-- candidate RPC so production schema matches the intended D1 application code.

-- Index supporting "oldest created card first" candidate selection.
create index if not exists idx_flashcards_user_created_at_id
  on public.flashcards (user_id, created_at, id);

-- Partial index over schedulable review facts for the anti-join exclusion.
create index if not exists idx_card_review_events_schedulable_user_card
  on public.card_review_events (user_id, flashcard_id)
  where fsrs_rating between 1 and 4 or is_correct is not null;

-- New Cards is an ownership-scoped read model.  Keep the anti-joins in
-- Postgres so Dashboard and session creation do not first materialize a user's
-- complete card/schedule/event graph in application memory.  The function has
-- no user-id argument: auth.uid() is the only owner boundary.
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
