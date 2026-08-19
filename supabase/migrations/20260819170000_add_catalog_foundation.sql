-- LP-03: system-owned catalog and per-user clone provenance.

create table public.catalog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (btrim(name) <> '' and char_length(name) <= 100),
  description text check (description is null or char_length(description) <= 500),
  sort_order integer not null default 0 check (sort_order >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_sets (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.catalog_categories(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (btrim(title) <> '' and char_length(title) <= 120),
  description text check (description is null or char_length(description) <= 500),
  language_front text not null check (char_length(language_front) <= 32),
  language_back text not null check (char_length(language_back) <= 32),
  level text check (level is null or char_length(level) <= 32),
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  version integer not null default 1 check (version > 0),
  is_starter boolean not null default false,
  starter_order integer check (starter_order between 1 and 99),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'published') = (published_at is not null)),
  check (not is_starter or starter_order is not null)
);
create unique index catalog_sets_starter_order on public.catalog_sets(starter_order) where is_starter;
create index catalog_sets_published_lookup on public.catalog_sets(category_id, starter_order, title) where status = 'published';

create table public.catalog_cards (
  id uuid primary key default gen_random_uuid(),
  catalog_set_id uuid not null references public.catalog_sets(id) on delete cascade,
  front text not null check (btrim(front) <> '' and char_length(front) <= 50000),
  back text not null check (btrim(back) <> '' and char_length(back) <= 50000),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (catalog_set_id, position)
);

alter table public.flashcard_sets add column source_catalog_set_id uuid references public.catalog_sets(id) on delete set null;
alter table public.flashcard_sets add column source_catalog_version integer check (source_catalog_version is null or source_catalog_version > 0);
create index flashcard_sets_catalog_source on public.flashcard_sets(source_catalog_set_id) where source_catalog_set_id is not null;

create table public.user_catalog_installs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  catalog_set_id uuid not null references public.catalog_sets(id) on delete restrict,
  installed_set_id uuid references public.flashcard_sets(id) on delete set null,
  catalog_version integer not null check (catalog_version > 0),
  status text not null default 'active' check (status in ('active', 'deleted')),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, catalog_set_id, idempotency_key)
);
create unique index user_catalog_installs_one_active on public.user_catalog_installs(user_id, catalog_set_id) where status = 'active';

alter table public.catalog_categories enable row level security;
alter table public.catalog_sets enable row level security;
alter table public.catalog_cards enable row level security;
alter table public.user_catalog_installs enable row level security;
create policy "catalog_categories_read_active" on public.catalog_categories for select to authenticated using (active);
create policy "catalog_sets_read_published" on public.catalog_sets for select to authenticated using (status = 'published');
create policy "catalog_cards_read_published" on public.catalog_cards for select to authenticated using (exists (select 1 from public.catalog_sets s where s.id = catalog_set_id and s.status = 'published'));
create policy "user_catalog_installs_read_own" on public.user_catalog_installs for select to authenticated using (user_id = auth.uid());
revoke all on table public.catalog_categories, public.catalog_sets, public.catalog_cards, public.user_catalog_installs from public, anon, authenticated;
grant select on table public.catalog_categories, public.catalog_sets, public.catalog_cards, public.user_catalog_installs to authenticated;
grant all privileges on table public.catalog_categories, public.catalog_sets, public.catalog_cards, public.user_catalog_installs to service_role;
drop trigger if exists set_updated_at on public.catalog_categories;
create trigger set_updated_at before update on public.catalog_categories for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.catalog_sets;
create trigger set_updated_at before update on public.catalog_sets for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.catalog_cards;
create trigger set_updated_at before update on public.catalog_cards for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.user_catalog_installs;
create trigger set_updated_at before update on public.user_catalog_installs for each row execute function public.set_updated_at();

-- Service-role only. The caller must obtain p_user_id from an authenticated
-- server session. An advisory lock makes double-click/retry/concurrent calls
-- serialize per user/template, while the active-install index is a second
-- database-level guard.
create or replace function public.install_catalog_set(
  p_user_id uuid,
  p_catalog_set_id uuid,
  p_idempotency_key uuid
)
returns table(set_id uuid, already_exists boolean, card_count integer, catalog_version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_catalog public.catalog_sets%rowtype;
  v_existing public.user_catalog_installs%rowtype;
  v_set_id uuid;
  v_card_count integer;
begin
  if p_user_id is null or p_catalog_set_id is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'invalid catalog install input';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_catalog_set_id::text, 0));
  select * into v_catalog from public.catalog_sets where id = p_catalog_set_id and status = 'published';
  if not found then raise exception using errcode = 'P0002', message = 'published catalog set not found'; end if;
  select count(*)::integer into v_card_count from public.catalog_cards where catalog_set_id = p_catalog_set_id;
  if v_card_count = 0 then raise exception using errcode = '22023', message = 'catalog set has no cards'; end if;
  select * into v_existing from public.user_catalog_installs
  where user_id = p_user_id and catalog_set_id = p_catalog_set_id and status = 'active'
  for update;
  if found and v_existing.installed_set_id is not null and exists (select 1 from public.flashcard_sets where id = v_existing.installed_set_id and user_id = p_user_id) then
    return query select v_existing.installed_set_id, true, v_card_count, v_existing.catalog_version;
    return;
  end if;
  if found then update public.user_catalog_installs set status = 'deleted' where id = v_existing.id; end if;
  insert into public.flashcard_sets(user_id, name, description, source_catalog_set_id, source_catalog_version)
  values (p_user_id, v_catalog.title, v_catalog.description, v_catalog.id, v_catalog.version)
  returning id into v_set_id;
  insert into public.flashcards(user_id, set_id, front, back, position)
  select p_user_id, v_set_id, front, back, position from public.catalog_cards where catalog_set_id = v_catalog.id order by position;
  insert into public.user_catalog_installs(user_id, catalog_set_id, installed_set_id, catalog_version, status, idempotency_key)
  values (p_user_id, v_catalog.id, v_set_id, v_catalog.version, 'active', p_idempotency_key);
  return query select v_set_id, false, v_card_count, v_catalog.version;
end;
$$;
revoke all on function public.install_catalog_set(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.install_catalog_set(uuid,uuid,uuid) to service_role;
