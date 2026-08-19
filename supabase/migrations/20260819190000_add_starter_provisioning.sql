-- LP-05: durable, retryable starter provisioning and resumable backfill support.
-- Provisioning is deliberately not attached to the Auth trigger. The app or an
-- operator invokes it after confirmation so an unavailable catalog never breaks signup.

create table public.starter_provisioning_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'partial', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  installed_count integer not null default 0 check (installed_count between 0 and 3),
  last_error_code text check (last_error_code is null or last_error_code ~ '^[a-z0-9_]{1,80}$'),
  started_at timestamptz,
  completed_at timestamptz,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.starter_provisioning_states enable row level security;
create policy "starter_provisioning_states_read_own"
  on public.starter_provisioning_states for select to authenticated
  using (user_id = auth.uid());
revoke all on table public.starter_provisioning_states from public, anon, authenticated;
grant select on table public.starter_provisioning_states to authenticated;
grant all privileges on table public.starter_provisioning_states to service_role;
drop trigger if exists set_updated_at on public.starter_provisioning_states;
create trigger set_updated_at before update on public.starter_provisioning_states
for each row execute function public.set_updated_at();

create or replace function public.provision_starter_sets(p_user_id uuid)
returns table(
  provisioning_status text,
  created_sets integer,
  existing_sets integer,
  missing_sets integer,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.starter_provisioning_states%rowtype;
  v_catalog public.catalog_sets%rowtype;
  v_install record;
  v_created integer := 0;
  v_existing integer := 0;
  v_success integer := 0;
  v_starter_count integer;
  v_published_count integer;
  v_current_cards bigint;
  v_missing_cards bigint;
  v_current_sets bigint;
  v_missing_set_count bigint;
  v_card_limit bigint;
  v_set_limit bigint;
  v_error_code text;
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'user id is required';
  end if;
  if not exists (
    select 1 from auth.users u
    where u.id = p_user_id and u.email_confirmed_at is not null
  ) then
    raise exception using errcode = '22023', message = 'confirmed user not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('starter:' || p_user_id::text, 0));
  insert into public.starter_provisioning_states(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
  select * into v_state from public.starter_provisioning_states
  where user_id = p_user_id for update;

  -- Completion is durable. Deleting an installed starter is an explicit user
  -- choice and must not cause a later app load to recreate it.
  if v_state.status = 'completed' then
    return query select 'completed'::text, 0, v_state.installed_count, 0, v_state.attempt_count;
    return;
  end if;

  update public.starter_provisioning_states
  set status = 'running', attempt_count = attempt_count + 1,
      started_at = coalesce(started_at, now()), last_attempt_at = now(),
      last_error_code = null
  where user_id = p_user_id
  returning * into v_state;

  select count(*)::integer,
         count(*) filter (where status = 'published')::integer
    into v_starter_count, v_published_count
  from public.catalog_sets where is_starter;

  if v_starter_count <> 3 or v_published_count <> 3 then
    update public.starter_provisioning_states
    set status = 'failed', last_error_code = 'starter_catalog_unavailable'
    where user_id = p_user_id;
    return query select 'failed'::text, 0, 0, 3, v_state.attempt_count;
    return;
  end if;

  select count(*)::bigint into v_current_cards
  from public.flashcards where user_id = p_user_id;
  select count(*)::bigint into v_current_sets
  from public.flashcard_sets where user_id = p_user_id;
  select coalesce(sum(card_count), 0)::bigint, count(*)::bigint
    into v_missing_cards, v_missing_set_count
  from (
    select s.id, count(c.id)::bigint as card_count
    from public.catalog_sets s
    join public.catalog_cards c on c.catalog_set_id = s.id
    where s.is_starter and s.status = 'published'
      and not exists (
        select 1 from public.user_catalog_installs i
        join public.flashcard_sets f on f.id = i.installed_set_id and f.user_id = p_user_id
        where i.user_id = p_user_id and i.catalog_set_id = s.id and i.status = 'active'
      )
    group by s.id
  ) missing;

  -- Absolute database safety ceilings. Commercial limits may be lower, but a
  -- system provision may create a legacy floor so existing data is never locked.
  if v_current_cards + v_missing_cards > 30000 or v_current_sets + v_missing_set_count > 200 then
    update public.starter_provisioning_states
    set status = 'failed', last_error_code = 'hard_storage_ceiling'
    where user_id = p_user_id;
    return query select 'failed'::text, 0, 0, v_missing_set_count::integer, v_state.attempt_count;
    return;
  end if;

  v_card_limit := (public.get_effective_entitlement(p_user_id, 'cards.total.max')->>'integer_value')::bigint;
  v_set_limit := (public.get_effective_entitlement(p_user_id, 'sets.regular.max')->>'integer_value')::bigint;

  for v_catalog in
    select * from public.catalog_sets
    where is_starter and status = 'published'
    order by starter_order, id
  loop
    begin
      select * into v_install
      from public.install_catalog_set(p_user_id, v_catalog.id, gen_random_uuid());
      v_success := v_success + 1;
      if v_install.already_exists then
        v_existing := v_existing + 1;
      else
        v_created := v_created + 1;
      end if;
    exception
      when no_data_found then v_error_code := 'starter_catalog_unavailable';
      when data_exception then v_error_code := 'starter_catalog_invalid';
      when others then v_error_code := 'starter_install_failed';
    end;
  end loop;

  -- Floors are based on committed clones, not the optimistic estimate above.
  -- They are written in the same transaction, so no external quota check can
  -- observe the cloned rows before its matching legacy protection exists.
  select count(*)::bigint into v_current_cards from public.flashcards where user_id = p_user_id;
  select count(*)::bigint into v_current_sets from public.flashcard_sets where user_id = p_user_id;
  if v_current_cards > coalesce(v_card_limit, 0) then
    insert into public.entitlement_overrides(
      user_id, entitlement_key, value_type, integer_value, reason
    )
    select p_user_id, 'cards.total.max', 'integer', v_current_cards,
           'legacy_storage_floor_starter_provisioning'
    where not exists (
      select 1 from public.entitlement_overrides
      where user_id = p_user_id and entitlement_key = 'cards.total.max'
        and value_type = 'integer' and integer_value >= v_current_cards
        and (expires_at is null or expires_at > now())
    );
  end if;
  if v_current_sets > coalesce(v_set_limit, 0) then
    insert into public.entitlement_overrides(
      user_id, entitlement_key, value_type, integer_value, reason
    )
    select p_user_id, 'sets.regular.max', 'integer', v_current_sets,
           'legacy_storage_floor_starter_provisioning'
    where not exists (
      select 1 from public.entitlement_overrides
      where user_id = p_user_id and entitlement_key = 'sets.regular.max'
        and value_type = 'integer' and integer_value >= v_current_sets
        and (expires_at is null or expires_at > now())
    );
  end if;

  if v_success = 3 then
    update public.starter_provisioning_states
    set status = 'completed', installed_count = 3, completed_at = now(), last_error_code = null
    where user_id = p_user_id;
    return query select 'completed'::text, v_created, v_existing, 0, v_state.attempt_count;
  elsif v_success > 0 then
    update public.starter_provisioning_states
    set status = 'partial', installed_count = v_success,
        last_error_code = coalesce(v_error_code, 'starter_install_partial')
    where user_id = p_user_id;
    return query select 'partial'::text, v_created, v_existing, 3 - v_success, v_state.attempt_count;
  else
    update public.starter_provisioning_states
    set status = 'failed', installed_count = 0,
        last_error_code = coalesce(v_error_code, 'starter_install_failed')
    where user_id = p_user_id;
    return query select 'failed'::text, 0, 0, 3, v_state.attempt_count;
  end if;
end;
$$;

revoke all on function public.provision_starter_sets(uuid) from public, anon, authenticated;
grant execute on function public.provision_starter_sets(uuid) to service_role;

-- Read-only, cursor-based operator feed. It never provisions or changes state.
create or replace function public.get_starter_backfill_batch(
  p_after_created_at timestamptz default null,
  p_after_user_id uuid default null,
  p_limit integer default 25
)
returns table(
  user_id uuid,
  user_created_at timestamptz,
  provisioning_status text,
  missing_starter_sets integer,
  missing_starter_cards integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception using errcode = '22023', message = 'backfill batch limit must be between 1 and 100';
  end if;
  if (p_after_created_at is null) <> (p_after_user_id is null) then
    raise exception using errcode = '22023', message = 'backfill cursor is incomplete';
  end if;
  if (select count(*) from public.catalog_sets where is_starter and status = 'published') <> 3 then
    raise exception using errcode = 'P0002', message = 'starter catalog unavailable';
  end if;

  return query
  select u.id,
         u.created_at,
         coalesce(ps.status, 'pending'),
         case when ps.status = 'completed' then 0
              else count(s.id) filter (where f.id is null)::integer end,
         case when ps.status = 'completed' then 0
              else coalesce(sum(card_counts.card_count) filter (where f.id is null), 0)::integer end
  from auth.users u
  cross join public.catalog_sets s
  join lateral (
    select count(*)::integer as card_count
    from public.catalog_cards c where c.catalog_set_id = s.id
  ) card_counts on true
  left join public.starter_provisioning_states ps on ps.user_id = u.id
  left join public.user_catalog_installs i
    on i.user_id = u.id and i.catalog_set_id = s.id and i.status = 'active'
  left join public.flashcard_sets f
    on f.id = i.installed_set_id and f.user_id = u.id
  where u.email_confirmed_at is not null
    and s.is_starter and s.status = 'published'
    and (p_after_created_at is null or (u.created_at, u.id) > (p_after_created_at, p_after_user_id))
  group by u.id, u.created_at, ps.status
  order by u.created_at, u.id
  limit p_limit;
end;
$$;

revoke all on function public.get_starter_backfill_batch(timestamptz,uuid,integer) from public, anon, authenticated;
grant execute on function public.get_starter_backfill_batch(timestamptz,uuid,integer) to service_role;
