-- LP-07 review follow-up: durable would-block observations and one DB-owned storage mode.

create table public.storage_quota_observations (
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_key text not null check (resource_key in (
    'sets.regular.max',
    'cards.total.max',
    'collections.max',
    'card.side_chars.soft_max',
    'imports.request.cards',
    'imports.request.source_bytes',
    'imports.request.source_chars'
  )),
  operation text not null check (operation ~ '^[a-z0-9_.]{1,80}$'),
  enforcement_mode text not null check (enforcement_mode in ('observe','warn')),
  current_value bigint not null check (current_value >= 0),
  limit_value bigint not null check (limit_value >= 0),
  observed_hour timestamptz not null,
  occurrence_count bigint not null default 1 check (occurrence_count > 0),
  first_observed_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  primary key(user_id,resource_key,operation,enforcement_mode,observed_hour)
);

create index storage_quota_observations_recent_idx
  on public.storage_quota_observations(user_id,last_observed_at desc);

alter table public.storage_quota_observations enable row level security;
revoke all on table public.storage_quota_observations from public,anon,authenticated;
grant all privileges on table public.storage_quota_observations to service_role;

create or replace function public.storage_enforcement_mode()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select storage_enforcement_mode from public.quota_runtime_settings where singleton),
    'observe'
  );
$$;

create or replace function public.record_storage_quota_observation(
  p_user_id uuid,
  p_resource_key text,
  p_operation text,
  p_mode text,
  p_current_value bigint,
  p_limit_value bigint
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_hour timestamptz := date_trunc('hour',clock_timestamp());
begin
  if p_user_id is null or p_mode not in ('observe','warn')
     or p_current_value is null or p_current_value < 0
     or p_limit_value is null or p_limit_value < 0 then
    raise exception using errcode='22023',message='invalid storage quota observation';
  end if;
  delete from public.storage_quota_observations
  where user_id=p_user_id and last_observed_at < clock_timestamp()-interval '35 days';
  insert into public.storage_quota_observations(
    user_id,resource_key,operation,enforcement_mode,current_value,limit_value,observed_hour
  ) values(
    p_user_id,p_resource_key,p_operation,p_mode,p_current_value,p_limit_value,v_hour
  )
  on conflict(user_id,resource_key,operation,enforcement_mode,observed_hour)
  do update set
    current_value=excluded.current_value,
    limit_value=excluded.limit_value,
    occurrence_count=public.storage_quota_observations.occurrence_count+1,
    last_observed_at=clock_timestamp();
end;
$$;

create or replace function public.assert_storage_totals(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_mode text := public.storage_enforcement_mode();
  v_sets bigint;
  v_cards bigint;
  v_collections bigint;
  v_set_limit bigint;
  v_card_limit bigint;
  v_collection_limit bigint;
  v_floor public.legacy_storage_floors%rowtype;
begin
  if p_user_id is null then raise exception using errcode='22023',message='user id is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('storage:' || p_user_id::text,0));

  select count(*) into v_sets from public.flashcard_sets where user_id=p_user_id;
  select count(*) into v_cards from public.flashcards where user_id=p_user_id;
  select count(*) into v_collections from public.special_collections where user_id=p_user_id;
  select * into v_floor from public.legacy_storage_floors where user_id=p_user_id;
  v_set_limit := (public.get_effective_entitlement(p_user_id,'sets.regular.max')->>'integer_value')::bigint;
  v_card_limit := (public.get_effective_entitlement(p_user_id,'cards.total.max')->>'integer_value')::bigint;
  v_collection_limit := (public.get_effective_entitlement(p_user_id,'collections.max')->>'integer_value')::bigint;
  if v_set_limit is null or v_card_limit is null or v_collection_limit is null then
    raise exception using errcode='P0001',message='storage_entitlement_unavailable';
  end if;
  v_set_limit := greatest(v_set_limit,coalesce(v_floor.regular_sets,0));
  v_card_limit := greatest(v_card_limit,coalesce(v_floor.cards,0));
  v_collection_limit := greatest(v_collection_limit,coalesce(v_floor.collections,0));

  if v_sets > v_set_limit then
    if v_mode='block' then raise exception using errcode='P0001',message='storage_quota_exceeded'; end if;
    perform public.record_storage_quota_observation(
      p_user_id,'sets.regular.max','storage.total',v_mode,v_sets,v_set_limit
    );
  end if;
  if v_cards > v_card_limit then
    if v_mode='block' then raise exception using errcode='P0001',message='storage_quota_exceeded'; end if;
    perform public.record_storage_quota_observation(
      p_user_id,'cards.total.max','storage.total',v_mode,v_cards,v_card_limit
    );
  end if;
  if v_collections > v_collection_limit then
    if v_mode='block' then raise exception using errcode='P0001',message='storage_quota_exceeded'; end if;
    perform public.record_storage_quota_observation(
      p_user_id,'collections.max','storage.total',v_mode,v_collections,v_collection_limit
    );
  end if;
end;
$$;

create or replace function public.enforce_card_side_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_mode text := public.storage_enforcement_mode();
  v_limit bigint;
  v_current bigint;
  v_is_growth boolean;
begin
  v_limit := (public.get_effective_entitlement(new.user_id,'card.side_chars.soft_max')->>'integer_value')::bigint;
  if v_limit is null then raise exception using errcode='P0001',message='storage_entitlement_unavailable'; end if;
  v_current := greatest(char_length(new.front),char_length(new.back));
  v_is_growth := tg_op='INSERT' or (
    (char_length(new.front)>v_limit and char_length(new.front)>char_length(old.front))
    or (char_length(new.back)>v_limit and char_length(new.back)>char_length(old.back))
  );
  if v_current > v_limit and v_is_growth then
    if v_mode='block' then
      if tg_op='INSERT' then
        raise exception using errcode='P0001',message='storage_card_side_limit';
      end if;
      raise exception using errcode='P0001',message='storage_growth_blocked';
    end if;
    perform public.record_storage_quota_observation(
      new.user_id,'card.side_chars.soft_max','flashcards.write',v_mode,v_current,v_limit
    );
  end if;
  return new;
end;
$$;

create or replace function public.commit_flashcard_import(
  p_name text,p_cards jsonb,p_idempotency_key uuid,p_source_type text,
  p_source_bytes bigint,p_source_chars bigint,p_ai_used boolean
)
returns table(set_id uuid,imported_count integer,already_exists boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.flashcard_import_commits%rowtype;
  v_mode text := public.storage_enforcement_mode();
  v_plan text;
  v_max_cards integer;
  v_max_source_bytes bigint;
  v_max_source_chars bigint;
  v_card_count bigint;
  v_result record;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication required'; end if;
  if p_idempotency_key is null or p_source_type not in ('manual','csv_xlsx','google_sheets','paste_structured','paste_prose','docx','pdf')
     or p_source_bytes is null or p_source_bytes < 0
     or p_source_chars is null or p_source_chars < 0 or p_ai_used is null then
    raise exception using errcode='22023',message='invalid import commit';
  end if;
  if p_source_type in ('manual','csv_xlsx','google_sheets','paste_structured') and p_ai_used then
    raise exception using errcode='22023',message='deterministic import cannot use ai';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('storage:' || v_user_id::text,0));
  select * into v_existing from public.flashcard_import_commits
  where user_id=v_user_id and idempotency_key=p_idempotency_key;
  if found then return query select v_existing.set_id,v_existing.imported_count,true; return; end if;

  v_plan := public.get_effective_plan(v_user_id);
  v_max_cards := case
    when p_source_type in ('paste_prose','docx','pdf') then case when v_plan='free' then 100 else 500 end
    else case when v_plan='free' then 500 else 2000 end end;
  v_max_source_bytes := case
    when p_source_type in ('csv_xlsx','docx','pdf') then case when v_plan='free' then 5242880 else 15728640 end
    else null end;
  v_max_source_chars := case
    when p_source_type='paste_structured' then case when v_plan='free' then 50000 else 200000 end
    when p_source_type='paste_prose' then case when v_plan='free' then 25000 else 100000 end
    when p_source_type in ('docx','pdf') then case when v_plan='free' then 30000 else 100000 end
    else null end;
  v_card_count := case when jsonb_typeof(p_cards)='array' then jsonb_array_length(p_cards) else 0 end;

  if v_card_count > v_max_cards then
    if v_mode='block' then raise exception using errcode='P0001',message='import_per_request_limit'; end if;
    perform public.record_storage_quota_observation(
      v_user_id,'imports.request.cards','import.' || p_source_type,v_mode,v_card_count,v_max_cards
    );
  end if;
  if v_max_source_bytes is not null and p_source_bytes > v_max_source_bytes then
    if v_mode='block' then raise exception using errcode='P0001',message='import_per_request_limit'; end if;
    perform public.record_storage_quota_observation(
      v_user_id,'imports.request.source_bytes','import.' || p_source_type,v_mode,p_source_bytes,v_max_source_bytes
    );
  end if;
  if v_max_source_chars is not null and p_source_chars > v_max_source_chars then
    if v_mode='block' then raise exception using errcode='P0001',message='import_per_request_limit'; end if;
    perform public.record_storage_quota_observation(
      v_user_id,'imports.request.source_chars','import.' || p_source_type,v_mode,p_source_chars,v_max_source_chars
    );
  end if;

  select * into v_result from public.import_flashcard_set(p_name,p_cards);
  insert into public.flashcard_import_commits(
    user_id,idempotency_key,source_type,set_id,imported_count,ai_used,source_bytes,source_chars
  ) values(
    v_user_id,p_idempotency_key,p_source_type,v_result.set_id,v_result.imported_count,
    p_ai_used,p_source_bytes,p_source_chars
  );
  return query select v_result.set_id,v_result.imported_count,false;
end;
$$;

drop function public.clone_shared_set_with_quota(text,uuid,text);
create function public.clone_shared_set_with_quota(p_token text,p_user_id uuid)
returns table(new_set_id uuid,already_exists boolean)
language sql security definer set search_path = '' as $$
  select * from public.clone_shared_set(p_token,p_user_id);
$$;

drop function public.provision_starter_sets_with_quota(uuid,text);
create function public.provision_starter_sets_with_quota(p_user_id uuid)
returns table(provisioning_status text,created_sets integer,existing_sets integer,missing_sets integer,attempts integer)
language sql security definer set search_path = '' as $$
  select * from public.provision_starter_sets(p_user_id);
$$;

drop function public.install_catalog_set_for_user(uuid,uuid,uuid,text);
create function public.install_catalog_set_for_user(
  p_user_id uuid,p_catalog_set_id uuid,p_idempotency_key uuid
)
returns table(set_id uuid,already_exists boolean,card_count integer,catalog_version integer)
language sql security definer set search_path = '' as $$
  select * from public.install_catalog_set(p_user_id,p_catalog_set_id,p_idempotency_key);
$$;

create function public.get_my_storage_quota_status()
returns table(enforcement_mode text,has_recent_warning boolean,last_warning_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select public.storage_enforcement_mode(),
    exists(
      select 1 from public.storage_quota_observations o
      where o.user_id=auth.uid() and o.enforcement_mode='warn'
        and o.last_observed_at >= now()-interval '30 days'
    ),
    (
      select max(o.last_observed_at) from public.storage_quota_observations o
      where o.user_id=auth.uid() and o.enforcement_mode='warn'
        and o.last_observed_at >= now()-interval '30 days'
    );
$$;

revoke all on function public.clone_shared_set_with_quota(text,uuid),
  public.provision_starter_sets_with_quota(uuid),
  public.install_catalog_set_for_user(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.clone_shared_set_with_quota(text,uuid),
  public.provision_starter_sets_with_quota(uuid),
  public.install_catalog_set_for_user(uuid,uuid,uuid) to service_role;

revoke all on function public.get_my_storage_quota_status() from public,anon;
grant execute on function public.get_my_storage_quota_status() to authenticated;

revoke all on function public.storage_enforcement_mode(),
  public.record_storage_quota_observation(uuid,text,text,text,bigint,bigint),
  public.assert_storage_totals(uuid),public.enforce_card_side_limit()
from public,anon,authenticated;
