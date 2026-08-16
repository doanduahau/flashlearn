-- Set sharing foundation: share tokens + classroom membership.
--
-- Scope:
--   - share_token on flashcard_sets (32-hex, generated server-side, rotated on
--     each create call so revoke is just re-create or null-out).
--   - share_classroom_enabled flag: only links created under classroom mode
--     record memberships.
--   - shared_set_memberships: which user cloned which set (owner-visible only).
--   - Six SECURITY DEFINER RPCs. Public/anon can NEVER read the tables
--     directly; shared reads go only through get_shared_set_by_token /
--     get_shared_set_cards (authenticated). Every mutation (create/revoke/
--     classroom/register membership) is service-role only.
--
-- RLS on flashcard_sets/flashcards is intentionally untouched: existing
-- *_select_own policies remain the only direct read path.

-- ---------------------------------------------------------------------------
-- 1.1 share_token column
-- ---------------------------------------------------------------------------

alter table public.flashcard_sets
  add column share_token text;

create unique index idx_flashcard_sets_share_token
  on public.flashcard_sets (share_token)
  where share_token is not null;

-- ---------------------------------------------------------------------------
-- 1.2 RPC 1 — create_set_share_token (rotate/idempotent-ish)
-- ---------------------------------------------------------------------------
-- Generates a brand-new 32-hex token on every call. Calling again when a token
-- already exists rotates it (the previous token becomes invalid immediately),
-- which is also how a user re-creates a link after revoking.

create or replace function public.create_set_share_token(
  p_user_id uuid,
  p_set_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
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
    raise exception 'set not owned' using errcode = '42501';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '');

  update public.flashcard_sets
  set share_token = v_token
  where id = p_set_id and user_id = p_user_id;

  return v_token;
end;
$$;

comment on function public.create_set_share_token(uuid, uuid) is
  'Creates or rotates a 32-hex share token for an owned set. Every call mints a new token, so an existing token is invalidated immediately. Service-role only.';

revoke all on function public.create_set_share_token(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_set_share_token(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 1.3 RPC 2 — revoke_set_share_token
-- ---------------------------------------------------------------------------
-- Nulls the token and simultaneously disables classroom mode, so no new
-- membership can be recorded even if the link is re-created later.

create or replace function public.revoke_set_share_token(
  p_user_id uuid,
  p_set_id uuid
)
returns void
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
    raise exception 'set not owned' using errcode = '42501';
  end if;

  update public.flashcard_sets
  set share_token = null,
      share_classroom_enabled = false
  where id = p_set_id and user_id = p_user_id;
end;
$$;

comment on function public.revoke_set_share_token(uuid, uuid) is
  'Revokes a share link by clearing the token and disabling classroom mode for the set. Service-role only.';

revoke all on function public.revoke_set_share_token(uuid, uuid) from public, anon, authenticated;
grant execute on function public.revoke_set_share_token(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 1.4 RPC 3 — get_shared_set_by_token
-- ---------------------------------------------------------------------------
-- Public metadata read through a token. Invalid token shape raises 22023;
-- a valid-shaped token that matches nothing returns an empty set (never a
-- raise) so the UI can render "link not found or disabled" without leaking
-- whether a token is valid. Owner user_id is never returned.

create or replace function public.get_shared_set_by_token(p_token text)
returns table (
  set_id uuid,
  name text,
  description text,
  created_at timestamptz,
  owner_display_name text,
  card_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    raise exception 'invalid share token' using errcode = '22023';
  end if;

  return query
    select
      s.id,
      s.name,
      s.description,
      s.created_at,
      p.display_name,
      (
        select count(*)::bigint
        from public.flashcards f
        where f.set_id = s.id and f.user_id = s.user_id
      ) as card_count
    from public.flashcard_sets s
    left join public.profiles p on p.id = s.user_id
    where s.share_token = p_token;
end;
$$;

comment on function public.get_shared_set_by_token(text) is
  'Returns public metadata for the set behind a valid share token: id, name, description, created_at, owner display name and card count. Owner user_id is never returned. Invalid token shape raises 22023; an unknown token returns an empty set. Authenticated only.';

revoke all on function public.get_shared_set_by_token(text) from public, anon;
grant execute on function public.get_shared_set_by_token(text) to authenticated;
-- The public /share/[token] preview page calls this RPC server-side via the
-- service-role client (anonymous visitors have no session), so service_role
-- needs execute too. It is never granted to anon.
grant execute on function public.get_shared_set_by_token(text) to service_role;

-- ---------------------------------------------------------------------------
-- 1.5 RPC 4 — get_shared_set_cards
-- ---------------------------------------------------------------------------
-- All cards of the set matching the token, ordered by position. Ownership is
-- double-checked via the composite (user_id, set_id) join, so cards from other
-- sets/users can never leak. Unknown token -> empty result (no raise).

create or replace function public.get_shared_set_cards(p_token text)
returns table (
  card_id uuid,
  front text,
  back text,
  "position" integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    raise exception 'invalid share token' using errcode = '22023';
  end if;

  return query
    select f.id, f.front, f.back, f.position
    from public.flashcard_sets s
    join public.flashcards f
      on f.set_id = s.id and f.user_id = s.user_id
    where s.share_token = p_token
    order by f.position asc;
end;
$$;

comment on function public.get_shared_set_cards(text) is
  'Returns all flashcards of the set behind a valid share token, ordered by position. Unknown token returns an empty set; invalid token shape raises 22023. Authenticated only.';

revoke all on function public.get_shared_set_cards(text) from public, anon;
grant execute on function public.get_shared_set_cards(text) to authenticated;
-- Same rationale as get_shared_set_by_token: service_role reads through the
-- token for anonymous visitors. Never granted to anon.
grant execute on function public.get_shared_set_cards(text) to service_role;

-- ---------------------------------------------------------------------------
-- 1.6 share_classroom_enabled column
-- ---------------------------------------------------------------------------

alter table public.flashcard_sets
  add column share_classroom_enabled boolean not null default false;

-- ---------------------------------------------------------------------------
-- 1.7 shared_set_memberships table
-- ---------------------------------------------------------------------------
-- Records that a user cloned a shared set. Only the set owner may read it
-- (RLS select below); members never need to. All writes happen through
-- register_set_membership (service-role), never from the browser.

create table public.shared_set_memberships (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.flashcard_sets(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  clone_set_id uuid not null references public.flashcard_sets(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (set_id, member_user_id)
);

create index idx_shared_set_memberships_set on public.shared_set_memberships(set_id);

alter table public.shared_set_memberships enable row level security;

-- Owner-only read: the set behind the row belongs to the current user.
-- No insert/update/delete policies exist, so the browser can never write;
-- RPC 6 (service-role, SECURITY DEFINER) is the sole write path.
create policy "shared_set_memberships_select_owner"
  on public.shared_set_memberships
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.flashcard_sets fs
      where fs.id = shared_set_memberships.set_id
        and fs.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 1.8 RPC 5 — set_set_classroom_enabled
-- ---------------------------------------------------------------------------
-- Owner toggles classroom mode on an existing share link. Does not mint a
-- token; the link must already exist via create_set_share_token.

create or replace function public.set_set_classroom_enabled(
  p_user_id uuid,
  p_set_id uuid,
  p_enabled boolean
)
returns void
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
    raise exception 'set not owned' using errcode = '42501';
  end if;

  update public.flashcard_sets
  set share_classroom_enabled = coalesce(p_enabled, false)
  where id = p_set_id and user_id = p_user_id;
end;
$$;

comment on function public.set_set_classroom_enabled(uuid, uuid, boolean) is
  'Enables or disables classroom mode for an owned set. Does not create a token. Service-role only.';

revoke all on function public.set_set_classroom_enabled(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_set_classroom_enabled(uuid, uuid, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- 1.9 RPC 6 — register_set_membership
-- ---------------------------------------------------------------------------
-- Records a classroom membership when a user clones a shared set. Refuses to
-- record unless the link exists and classroom mode is ON. Validates that the
-- clone set actually belongs to the member. Upserts on (set_id, member_user_id)
-- so a re-clone keeps the latest snapshot as the source of stats.

create or replace function public.register_set_membership(
  p_token text,
  p_clone_set_id uuid,
  p_member_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_set_id uuid;
  v_classroom_enabled boolean;
  v_membership_id uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    raise exception 'invalid share token' using errcode = '22023';
  end if;

  if p_clone_set_id is null or p_member_user_id is null then
    raise exception 'invalid membership input' using errcode = '22023';
  end if;

  select s.id, s.share_classroom_enabled
  into v_set_id, v_classroom_enabled
  from public.flashcard_sets s
  where s.share_token = p_token;

  if not found then
    raise exception 'link not found or disabled' using errcode = '42501';
  end if;

  if not v_classroom_enabled then
    raise exception 'set is not in classroom mode' using errcode = '42501';
  end if;

  perform 1
  from public.flashcard_sets
  where id = p_clone_set_id and user_id = p_member_user_id;
  if not found then
    raise exception 'clone set not owned' using errcode = '42501';
  end if;

  insert into public.shared_set_memberships (set_id, member_user_id, clone_set_id)
  values (v_set_id, p_member_user_id, p_clone_set_id)
  on conflict (set_id, member_user_id)
  do update
    set clone_set_id = excluded.clone_set_id,
        joined_at = now()
  returning id into v_membership_id;

  return v_membership_id;
end;
$$;

comment on function public.register_set_membership(text, uuid, uuid) is
  'Registers a classroom membership for a clone of a shared set. Requires the link to exist with classroom mode enabled and the clone set to be owned by the member. Upserts on (set_id, member_user_id). Service-role only.';

revoke all on function public.register_set_membership(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.register_set_membership(text, uuid, uuid) to service_role;