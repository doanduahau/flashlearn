-- card_learning_schedule is a rebuildable FSRS projection derived from
-- immutable card_review_events. If this state is lost or corrupt, it can
-- be rebuilt from review history + the frozen flashlearn-v1 scheduler
-- configuration. No row exists for a card with zero schedulable reviews.
create table public.card_learning_schedule (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id) on delete cascade,
  flashcard_id uuid not null
    references public.flashcards(id) on delete cascade,

  -- FSRS-6 state (ts-fsrs 5.4.1 Card projection)
  state smallint not null check (state between 0 and 3),
  stability double precision not null check (
    stability >= 0 and stability < 'Infinity'::double precision
  ),
  difficulty double precision not null check (
    difficulty >= 0 and difficulty < 'Infinity'::double precision
  ),
  due timestamptz not null,
  scheduled_days double precision not null default 0 check (
    scheduled_days >= 0 and scheduled_days < 'Infinity'::double precision
  ),
  learning_steps integer not null default 0 check (learning_steps >= 0),
  reps integer not null default 0 check (reps >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  last_review timestamptz not null,

  -- Projection cursor / optimistic concurrency
  projection_revision bigint not null default 0 check (projection_revision >= 0),
  processed_event_count bigint not null check (processed_event_count >= 1),
  last_processed_reviewed_at timestamptz not null,
  last_processed_review_event_id uuid not null,

  -- Frozen scheduler identity
  algorithm text not null check (btrim(algorithm) <> ''),
  implementation text not null check (btrim(implementation) <> ''),
  parameter_set text not null check (btrim(parameter_set) <> ''),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, flashcard_id)
);

comment on table public.card_learning_schedule is
  'Rebuildable FSRS-6 projection. Authoritative source: card_review_events.';
comment on column public.card_learning_schedule.processed_event_count is
  'Number of schedulable card_review_events included in this projection.';
comment on column public.card_learning_schedule.last_processed_review_event_id is
  'The chronologically final schedulable event applied to this projection.';
comment on column public.card_learning_schedule.projection_revision is
  'Optimistic-concurrency version incremented on every successful write.';

-- Indexes
create index idx_card_learning_schedule_user_due
  on public.card_learning_schedule (user_id, due, flashcard_id);

-- updated_at trigger (repository pattern)
create trigger set_updated_at before update on public.card_learning_schedule
  for each row execute function public.set_updated_at();

-- Add nullable fsrs_rating to immutable review events
alter table public.card_review_events
  add column fsrs_rating smallint,
  add constraint card_review_events_fsrs_rating_check
    check (fsrs_rating is null or fsrs_rating between 1 and 4);

comment on column public.card_review_events.fsrs_rating is
  'FSRS rating: 1=Again 2=Hard 3=Good 4=Easy. NULL for pre-FSRS events.';

-- RLS: schedule rows are readable only by their owner
alter table public.card_learning_schedule enable row level security;

create policy card_learning_schedule_select_own
  on public.card_learning_schedule for select
  to authenticated
  using (user_id = auth.uid());

-- Authenticated users have SELECT only. No direct INSERT / UPDATE / DELETE.
revoke all on table public.card_learning_schedule
  from public, anon, authenticated;
grant select on table public.card_learning_schedule
  to authenticated;
-- The service_role needs full table access for server-side reconciliation and
-- backfill reads, mirroring the explicit per-table grants in the core schema.
grant all privileges on table public.card_learning_schedule
  to service_role;

-- Private trusted CAS projection-write RPC. Callable only by the service
-- boundary that has already computed fresh FSRS state from ts-fsrs 5.4.1 via
-- the frozen flashlearn-v1 configuration.
create or replace function public.upsert_card_learning_schedule(
  p_user_id uuid,
  p_flashcard_id uuid,
  p_expected_projection_revision bigint,
  p_state smallint,
  p_stability double precision,
  p_difficulty double precision,
  p_due timestamptz,
  p_scheduled_days double precision,
  p_learning_steps integer,
  p_reps integer,
  p_lapses integer,
  p_last_review timestamptz,
  p_processed_event_count bigint,
  p_last_processed_reviewed_at timestamptz,
  p_last_processed_review_event_id uuid,
  p_algorithm text,
  p_implementation text,
  p_parameter_set text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_revision bigint;
  v_db_event_count bigint;
  v_db_last_event_id uuid;
  v_db_last_reviewed_at timestamptz;
  cur record;
begin
  -- Validate flashcard exists and belongs to the claimed owner.
  if not exists (
    select 1 from public.flashcards
    where id = p_flashcard_id and user_id = p_user_id
  ) then
    raise exception 'flashcard not owned' using errcode = '22023';
  end if;

  -- A schedule must represent at least one schedulable review.
  if p_processed_event_count < 1 then
    raise exception 'processed_event_count must be at least 1' using errcode = '22023';
  end if;

  -- Count current schedulable events and find the chronological final one.
  -- A schedulable event has a valid fsrs_rating (1–4) or a non-null is_correct.
  with schedulable as (
    select id, reviewed_at
    from public.card_review_events
    where user_id = p_user_id
      and flashcard_id = p_flashcard_id
      and (fsrs_rating between 1 and 4 or is_correct is not null)
    order by reviewed_at asc, id asc
  )
  select
    count(*),
    (array_agg(id order by reviewed_at asc, id asc))[count(*)],
    (array_agg(reviewed_at order by reviewed_at asc, id asc))[count(*)]
  into
    v_db_event_count, v_db_last_event_id, v_db_last_reviewed_at
  from schedulable;

  -- Freshness guard: the projection must match reality.
  if v_db_event_count <> p_processed_event_count then
    raise exception 'stale projection: event count mismatch'
      using errcode = '22023';
  end if;

  -- Validate the final cursor event.
  if v_db_event_count > 0 then
    if v_db_last_event_id is null
       or v_db_last_event_id <> p_last_processed_review_event_id then
      raise exception 'stale projection: final event id mismatch'
        using errcode = '22023';
    end if;

    if v_db_last_reviewed_at is null
       or v_db_last_reviewed_at <> p_last_processed_reviewed_at then
      raise exception 'stale projection: final event time mismatch'
        using errcode = '22023';
    end if;
  end if;

  -- Lookup current projection (if any).
  select * into cur
  from public.card_learning_schedule
  where user_id = p_user_id and flashcard_id = p_flashcard_id;

  if cur is null then
    -- Initial insert: caller must signal "no existing row" with revision -1.
    if p_expected_projection_revision <> -1 then
      raise exception 'expected no existing projection, found none'
        using errcode = '22023';
    end if;

    insert into public.card_learning_schedule (
      user_id, flashcard_id,
      state, stability, difficulty, due, scheduled_days,
      learning_steps, reps, lapses, last_review,
      projection_revision, processed_event_count,
      last_processed_reviewed_at, last_processed_review_event_id,
      algorithm, implementation, parameter_set
    ) values (
      p_user_id, p_flashcard_id,
      p_state, p_stability, p_difficulty, p_due, p_scheduled_days,
      p_learning_steps, p_reps, p_lapses, p_last_review,
      0, p_processed_event_count,
      p_last_processed_reviewed_at, p_last_processed_review_event_id,
      p_algorithm, p_implementation, p_parameter_set
    ) on conflict (user_id, flashcard_id) do nothing
    returning projection_revision into v_current_revision;

    -- A concurrent first writer must surface a retryable CAS conflict rather
    -- than overwrite the newly-created projection or leak a unique violation.
    if v_current_revision is null then
      raise exception 'cas conflict: projection was created concurrently'
        using errcode = '22023';
    end if;

    return v_current_revision;
  end if;

  v_current_revision := cur.projection_revision;

  -- Existing row: CAS check.
  if p_expected_projection_revision <> v_current_revision then
    raise exception 'cas conflict: expected revision %, current is %',
      p_expected_projection_revision, v_current_revision
      using errcode = '22023';
  end if;

  -- Idempotent exact repeat: every persisted projection field (except revision
  -- and write timestamps) must match. A matching cursor alone is never enough.
  if p_processed_event_count = cur.processed_event_count
     and p_last_processed_review_event_id = cur.last_processed_review_event_id
     and p_last_processed_reviewed_at = cur.last_processed_reviewed_at
     and p_state = cur.state
     and p_due = cur.due
     and p_stability = cur.stability
     and p_difficulty = cur.difficulty
     and p_scheduled_days = cur.scheduled_days
     and p_learning_steps = cur.learning_steps
     and p_reps = cur.reps
     and p_lapses = cur.lapses
     and p_last_review = cur.last_review
     and p_algorithm = cur.algorithm
     and p_implementation = cur.implementation
     and p_parameter_set = cur.parameter_set then
    return v_current_revision;
  end if;

  -- Apply CAS update: increment revision.
  update public.card_learning_schedule
  set
    state = p_state,
    stability = p_stability,
    difficulty = p_difficulty,
    due = p_due,
    scheduled_days = p_scheduled_days,
    learning_steps = p_learning_steps,
    reps = p_reps,
    lapses = p_lapses,
    last_review = p_last_review,
    projection_revision = v_current_revision + 1,
    processed_event_count = p_processed_event_count,
    last_processed_reviewed_at = p_last_processed_reviewed_at,
    last_processed_review_event_id = p_last_processed_review_event_id,
    algorithm = p_algorithm,
    implementation = p_implementation,
    parameter_set = p_parameter_set
  where user_id = p_user_id
    and flashcard_id = p_flashcard_id
    and projection_revision = v_current_revision;

  if not found then
    raise exception 'cas conflict: projection changed concurrently'
      using errcode = '22023';
  end if;

  return v_current_revision + 1;
end;
$$;

-- The browser must never call this RPC. Only the TypeScript server boundary
-- that has already computed authentic FSRS state may invoke it.
revoke all on function public.upsert_card_learning_schedule(
  uuid, uuid, bigint, smallint, double precision, double precision, timestamptz,
  double precision, integer, integer, integer, timestamptz,
  bigint, timestamptz, uuid,
  text, text, text
) from public, anon, authenticated;
grant execute on function public.upsert_card_learning_schedule(
  uuid, uuid, bigint, smallint, double precision, double precision, timestamptz,
  double precision, integer, integer, integer, timestamptz,
  bigint, timestamptz, uuid,
  text, text, text
) to service_role;
