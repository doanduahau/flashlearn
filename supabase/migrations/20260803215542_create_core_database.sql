-- Core database foundation for FlashLearn
--
-- Tables:
--   public.profiles
--   public.flashcard_sets
--   public.flashcards
--   public.special_collections
--   public.special_collection_items
--
-- Includes:
--   - Ownership-integrity composite foreign keys
--   - updated_at trigger (set_updated_at)
--   - Auth profile creation trigger (handle_new_user)
--   - Row Level Security policies
--   - Explicit grants (authenticated only; anon denied)

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (
    display_name is null
    or (btrim(display_name) <> '' and char_length(display_name) <= 100)
  ),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  timezone text not null default 'Asia/Ho_Chi_Minh' check (char_length(timezone) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- flashcard_sets
-- ---------------------------------------------------------------------------
-- Duplicate set names are allowed in the MVP: the same name may be reused
-- across different users, and even by one user when a new import is created.
-- See docs/DECISIONS/001-core-data-ownership.md.

create table public.flashcard_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (btrim(name) <> '' and char_length(name) <= 120),
  description text check (description is null or char_length(description) <= 500),
  source_filename text check (source_filename is null or char_length(source_filename) <= 255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Composite key required as the target of the flashcards ownership FK.
  constraint flashcard_sets_user_id_id_key unique (user_id, id)
);

create index idx_flashcard_sets_user_created
  on public.flashcard_sets (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- flashcards
-- ---------------------------------------------------------------------------
-- Ownership integrity: (user_id, set_id) must reference a set owned by the
-- same user. This prevents a flashcard whose user and set owner disagree.

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  set_id uuid not null,
  front text not null check (btrim(front) <> '' and char_length(front) <= 50000),
  back text not null check (btrim(back) <> '' and char_length(back) <= 50000),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flashcards_user_id_id_key unique (user_id, id),
  constraint flashcards_user_set_fk
    foreign key (user_id, set_id)
    references public.flashcard_sets (user_id, id)
    on delete cascade
);

create index idx_flashcards_set_position on public.flashcards (set_id, position);
create index idx_flashcards_user on public.flashcards (user_id);

-- ---------------------------------------------------------------------------
-- special_collections
-- ---------------------------------------------------------------------------
-- Names are unique per user using a case-insensitive comparison (lower()).

create table public.special_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (btrim(name) <> '' and char_length(name) <= 60),
  icon text check (icon is null or char_length(icon) <= 32),
  color text check (color is null or char_length(color) <= 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint special_collections_user_id_id_key unique (user_id, id)
);

create unique index idx_special_collections_user_name
  on public.special_collections (user_id, lower(name));

create index idx_special_collections_user on public.special_collections (user_id);

-- ---------------------------------------------------------------------------
-- special_collection_items
-- ---------------------------------------------------------------------------
-- user_id is stored here for a strong integrity reason: it lets the database
-- enforce that a membership only ever links a collection and a flashcard owned
-- by the same user, via composite foreign keys. Cross-user insertions are
-- impossible at the database level, not just via RLS.
-- See docs/DECISIONS/001-core-data-ownership.md.

create table public.special_collection_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  collection_id uuid not null,
  flashcard_id uuid not null,
  created_at timestamptz not null default now(),
  constraint special_collection_items_pkey primary key (collection_id, flashcard_id),
  constraint special_collection_items_collection_fk
    foreign key (user_id, collection_id)
    references public.special_collections (user_id, id)
    on delete cascade,
  constraint special_collection_items_flashcard_fk
    foreign key (user_id, flashcard_id)
    references public.flashcards (user_id, id)
    on delete cascade
);

create index idx_special_collection_items_flashcard
  on public.special_collection_items (flashcard_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.flashcard_sets;
create trigger set_updated_at
  before update on public.flashcard_sets
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.flashcards;
create trigger set_updated_at
  before update on public.flashcards
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.special_collections;
create trigger set_updated_at
  before update on public.special_collections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth profile creation trigger
-- ---------------------------------------------------------------------------
-- Creates one profile per new Auth user. Only a safe, validated display_name
-- field is copied from the raw user metadata; unknown metadata is ignored.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
begin
  v_display_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');

  insert into public.profiles (id, display_name, timezone)
  values (new.id, v_display_name, 'Asia/Ho_Chi_Minh')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.flashcard_sets enable row level security;
alter table public.flashcards enable row level security;
alter table public.special_collections enable row level security;
alter table public.special_collection_items enable row level security;

-- profiles ----------------------------------------------------------------
-- Profile creation happens through the Auth trigger only; no INSERT policy is
-- granted so users cannot create a profile for another Auth user.

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- flashcard_sets -----------------------------------------------------------

create policy "flashcard_sets_select_own"
  on public.flashcard_sets for select
  to authenticated
  using (user_id = auth.uid());

create policy "flashcard_sets_insert_own"
  on public.flashcard_sets for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "flashcard_sets_update_own"
  on public.flashcard_sets for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "flashcard_sets_delete_own"
  on public.flashcard_sets for delete
  to authenticated
  using (user_id = auth.uid());

-- flashcards ---------------------------------------------------------------
-- A card is only manageable when it belongs to the current user and its set
-- also belongs to the current user. WITH CHECK covers new values during UPDATE.

create policy "flashcards_select_own"
  on public.flashcards for select
  to authenticated
  using (user_id = auth.uid());

create policy "flashcards_insert_own"
  on public.flashcards for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.flashcard_sets as fs
      where fs.id = set_id and fs.user_id = auth.uid()
    )
  );

create policy "flashcards_update_own"
  on public.flashcards for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.flashcard_sets as fs
      where fs.id = set_id and fs.user_id = auth.uid()
    )
  );

create policy "flashcards_delete_own"
  on public.flashcards for delete
  to authenticated
  using (user_id = auth.uid());

-- special_collections ------------------------------------------------------

create policy "special_collections_select_own"
  on public.special_collections for select
  to authenticated
  using (user_id = auth.uid());

create policy "special_collections_insert_own"
  on public.special_collections for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "special_collections_update_own"
  on public.special_collections for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "special_collections_delete_own"
  on public.special_collections for delete
  to authenticated
  using (user_id = auth.uid());

-- special_collection_items -------------------------------------------------
-- A membership is accessible only when the collection AND the flashcard belong
-- to the current user. No UPDATE policy: the table has no meaningful updatable
-- fields (primary key identifies the membership, created_at is automatic).

create policy "special_collection_items_select_own"
  on public.special_collection_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.special_collections as sc
      where sc.id = collection_id and sc.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.flashcards as f
      where f.id = flashcard_id and f.user_id = auth.uid()
    )
  );

create policy "special_collection_items_insert_own"
  on public.special_collection_items for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.special_collections as sc
      where sc.id = collection_id and sc.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.flashcards as f
      where f.id = flashcard_id and f.user_id = auth.uid()
    )
  );

create policy "special_collection_items_delete_own"
  on public.special_collection_items for delete
  to authenticated
  using (
    exists (
      select 1
      from public.special_collections as sc
      where sc.id = collection_id and sc.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.flashcards as f
      where f.id = flashcard_id and f.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Anonymous users get no table privileges. Authenticated users receive only
-- the operations their RLS policies support. The service_role keeps admin
-- access for server-side tasks; the browser never needs it.

revoke all on table public.profiles from anon, public;
revoke all on table public.flashcard_sets from anon, public;
revoke all on table public.flashcards from anon, public;
revoke all on table public.special_collections from anon, public;
revoke all on table public.special_collection_items from anon, public;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.flashcard_sets to authenticated;
grant select, insert, update, delete on table public.flashcards to authenticated;
grant select, insert, update, delete on table public.special_collections to authenticated;
grant select, insert, delete on table public.special_collection_items to authenticated;

grant all privileges on table public.profiles to service_role;
grant all privileges on table public.flashcard_sets to service_role;
grant all privileges on table public.flashcards to service_role;
grant all privileges on table public.special_collections to service_role;
grant all privileges on table public.special_collection_items to service_role;

-- Future tables created by the migration role are automatically granted to the
-- authenticated role so subsequent phases do not need repeated grants.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
