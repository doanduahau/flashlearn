-- Shared mode-specific coverage for learning/practice modes.
-- Coverage is committed only on session completion.
create table public.flashcard_coverage (
  user_id uuid not null,
  mode text not null check (mode in ('quiz', 'match', 'memory', 'runner')),
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  covered_at timestamptz not null default now(),
  primary key (user_id, mode, flashcard_id)
);

comment on table public.flashcard_coverage is
  'Mode-specific flashcard coverage committed only when a session completes.';

create index idx_flashcard_coverage_user_mode
  on public.flashcard_coverage(user_id, mode);

alter table public.flashcard_coverage enable row level security;

create policy "flashcard_coverage_select_own"
  on public.flashcard_coverage for select
  to authenticated
  using (user_id = auth.uid());

create policy "flashcard_coverage_insert_own"
  on public.flashcard_coverage for insert
  to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.flashcards f where f.id = flashcard_id and f.user_id = auth.uid()
  ));

create policy "flashcard_coverage_delete_own"
  on public.flashcard_coverage for delete
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.flashcard_coverage from public, anon;
grant select, insert, delete on table public.flashcard_coverage to authenticated;
