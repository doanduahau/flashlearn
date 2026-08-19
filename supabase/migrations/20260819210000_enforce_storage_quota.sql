-- LP-07: atomic storage limits, deterministic import idempotency and legacy floors.

create table public.legacy_storage_floors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  regular_sets bigint not null check (regular_sets >= 0),
  cards bigint not null check (cards >= 0),
  collections bigint not null check (collections >= 0),
  captured_at timestamptz not null default now()
);

insert into public.legacy_storage_floors(user_id, regular_sets, cards, collections)
select u.id,
  (select count(*) from public.flashcard_sets s where s.user_id = u.id),
  (select count(*) from public.flashcards f where f.user_id = u.id),
  (select count(*) from public.special_collections c where c.user_id = u.id)
from auth.users u;

create table public.flashcard_import_commits (
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  source_type text not null check (source_type in ('manual','csv_xlsx','google_sheets','paste_structured','paste_prose','docx','pdf')),
  set_id uuid not null,
  imported_count integer not null check (imported_count > 0),
  ai_used boolean not null,
  source_bytes bigint not null check (source_bytes >= 0),
  source_chars bigint not null check (source_chars >= 0),
  created_at timestamptz not null default now(),
  primary key(user_id, idempotency_key)
);

create table public.quota_runtime_settings (
  singleton boolean primary key default true check (singleton),
  storage_enforcement_mode text not null check (storage_enforcement_mode in ('observe','warn','block')),
  updated_at timestamptz not null default now()
);
insert into public.quota_runtime_settings(singleton,storage_enforcement_mode) values(true,'observe');

alter table public.legacy_storage_floors enable row level security;
alter table public.flashcard_import_commits enable row level security;
alter table public.quota_runtime_settings enable row level security;
revoke all on table public.legacy_storage_floors, public.flashcard_import_commits, public.quota_runtime_settings from public, anon, authenticated;
grant all privileges on table public.legacy_storage_floors, public.flashcard_import_commits, public.quota_runtime_settings to service_role;

alter table public.flashcards
  add constraint flashcards_front_hard_length check (char_length(front) <= 50000) not valid,
  add constraint flashcards_back_hard_length check (char_length(back) <= 50000) not valid;
alter table public.flashcards validate constraint flashcards_front_hard_length;
alter table public.flashcards validate constraint flashcards_back_hard_length;

create or replace function public.storage_enforcement_mode()
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_request_mode text:=current_setting('capystudy.quota_mode',true); v_mode text;
begin
  if v_request_mode in ('observe','warn','block') then return v_request_mode; end if;
  select storage_enforcement_mode into v_mode from public.quota_runtime_settings where singleton;
  return coalesce(v_mode,'observe');
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
  if p_user_id is null then raise exception using errcode='22023', message='user id is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('storage:' || p_user_id::text, 0));
  if v_mode <> 'block' then return; end if;

  select count(*) into v_sets from public.flashcard_sets where user_id=p_user_id;
  select count(*) into v_cards from public.flashcards where user_id=p_user_id;
  select count(*) into v_collections from public.special_collections where user_id=p_user_id;
  select * into v_floor from public.legacy_storage_floors where user_id=p_user_id;
  v_set_limit := (public.get_effective_entitlement(p_user_id,'sets.regular.max')->>'integer_value')::bigint;
  v_card_limit := (public.get_effective_entitlement(p_user_id,'cards.total.max')->>'integer_value')::bigint;
  v_collection_limit := (public.get_effective_entitlement(p_user_id,'collections.max')->>'integer_value')::bigint;
  if v_set_limit is null or v_card_limit is null or v_collection_limit is null then
    raise exception using errcode='P0001', message='storage_entitlement_unavailable';
  end if;
  if v_sets > greatest(v_set_limit,coalesce(v_floor.regular_sets,0))
     or v_cards > greatest(v_card_limit,coalesce(v_floor.cards,0))
     or v_collections > greatest(v_collection_limit,coalesce(v_floor.collections,0)) then
    raise exception using errcode='P0001', message='storage_quota_exceeded';
  end if;
end;
$$;

create or replace function public.enforce_set_storage_statement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid;
begin
  for v_user_id in select distinct user_id from new_storage_rows loop
    perform public.assert_storage_totals(v_user_id);
  end loop;
  return null;
end;
$$;
create trigger enforce_set_storage_after_insert after insert on public.flashcard_sets
referencing new table as new_storage_rows for each statement execute function public.enforce_set_storage_statement();

create or replace function public.enforce_card_storage_statement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid;
begin
  for v_user_id in select distinct user_id from new_storage_rows loop
    perform public.assert_storage_totals(v_user_id);
  end loop;
  return null;
end;
$$;
create trigger enforce_card_storage_after_insert after insert on public.flashcards
referencing new table as new_storage_rows for each statement execute function public.enforce_card_storage_statement();

create or replace function public.enforce_collection_storage_statement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid;
begin
  for v_user_id in select distinct user_id from new_storage_rows loop
    perform public.assert_storage_totals(v_user_id);
  end loop;
  return null;
end;
$$;
create trigger enforce_collection_storage_after_insert after insert on public.special_collections
referencing new table as new_storage_rows for each statement execute function public.enforce_collection_storage_statement();

create or replace function public.enforce_card_side_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_limit bigint;
begin
  if public.storage_enforcement_mode() <> 'block' then return new; end if;
  v_limit := (public.get_effective_entitlement(new.user_id,'card.side_chars.soft_max')->>'integer_value')::bigint;
  if v_limit is null then raise exception using errcode='P0001', message='storage_entitlement_unavailable'; end if;
  if tg_op = 'INSERT' and (char_length(new.front)>v_limit or char_length(new.back)>v_limit) then
    raise exception using errcode='P0001', message='storage_card_side_limit';
  end if;
  if tg_op = 'UPDATE' and (
      (char_length(new.front)>v_limit and char_length(new.front)>char_length(old.front))
      or (char_length(new.back)>v_limit and char_length(new.back)>char_length(old.back))
    ) then
    raise exception using errcode='P0001', message='storage_growth_blocked';
  end if;
  return new;
end;
$$;
create trigger enforce_card_side_before_write before insert or update of front,back on public.flashcards
for each row execute function public.enforce_card_side_limit();

create or replace function public.commit_flashcard_import(
  p_name text, p_cards jsonb, p_idempotency_key uuid, p_source_type text,
  p_source_bytes bigint, p_source_chars bigint, p_ai_used boolean
)
returns table(set_id uuid, imported_count integer, already_exists boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.flashcard_import_commits%rowtype;
  v_enforcement_mode text := public.storage_enforcement_mode();
  v_plan text;
  v_max_cards integer;
  v_max_source_bytes bigint;
  v_max_source_chars bigint;
  v_result record;
begin
  if v_user_id is null then raise exception using errcode='42501', message='authentication required'; end if;
  if p_idempotency_key is null or p_source_type not in ('manual','csv_xlsx','google_sheets','paste_structured','paste_prose','docx','pdf')
     or p_source_bytes is null or p_source_bytes < 0
     or p_source_chars is null or p_source_chars < 0 or p_ai_used is null then
    raise exception using errcode='22023', message='invalid import commit';
  end if;
  if p_source_type in ('manual','csv_xlsx','google_sheets','paste_structured') and p_ai_used then
    raise exception using errcode='22023', message='deterministic import cannot use ai';
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
    when p_source_type='csv_xlsx' then case when v_plan='free' then 5242880 else 15728640 end
    when p_source_type in ('docx','pdf') then case when v_plan='free' then 5242880 else 15728640 end
    else null end;
  v_max_source_chars := case
    when p_source_type='paste_structured' then case when v_plan='free' then 50000 else 200000 end
    when p_source_type='paste_prose' then case when v_plan='free' then 25000 else 100000 end
    when p_source_type in ('docx','pdf') then case when v_plan='free' then 30000 else 100000 end
    else null end;
  if v_enforcement_mode='block' and (
      jsonb_typeof(p_cards)<>'array' or jsonb_array_length(p_cards)>v_max_cards
      or (v_max_source_bytes is not null and p_source_bytes>v_max_source_bytes)
      or (v_max_source_chars is not null and p_source_chars>v_max_source_chars)
    ) then raise exception using errcode='P0001', message='import_per_request_limit'; end if;

  select * into v_result from public.import_flashcard_set(p_name,p_cards);
  insert into public.flashcard_import_commits(user_id,idempotency_key,source_type,set_id,imported_count,ai_used,source_bytes,source_chars)
  values(v_user_id,p_idempotency_key,p_source_type,v_result.set_id,v_result.imported_count,p_ai_used,p_source_bytes,p_source_chars);
  return query select v_result.set_id,v_result.imported_count,false;
end;
$$;

create or replace function public.add_flashcard_with_quota(
  p_set_id uuid,p_front text,p_back text
)
returns table(flashcard_id uuid,"position" integer)
language plpgsql security definer set search_path = '' as $$
begin
  return query select * from public.add_flashcard(p_set_id,p_front,p_back);
end;
$$;

create or replace function public.update_flashcard_with_quota(
  p_card_id uuid,p_set_id uuid,p_front text,p_back text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid:=auth.uid(); v_id uuid;
begin
  if v_user_id is null then raise exception using errcode='42501',message='authentication required'; end if;
  if p_front is null or btrim(p_front)='' or char_length(btrim(p_front))>50000
     or p_back is null or btrim(p_back)='' or char_length(btrim(p_back))>50000 then
    raise exception using errcode='22023',message='invalid flashcard';
  end if;
  update public.flashcards set front=btrim(p_front),back=btrim(p_back)
  where id=p_card_id and set_id=p_set_id and user_id=v_user_id returning id into v_id;
  if v_id is null then raise exception using errcode='P0002',message='flashcard not found'; end if;
  return v_id;
end;
$$;

create or replace function public.create_special_collection_with_quota(
  p_name text
)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  return public.create_special_collection(p_name,null,null);
end;
$$;

create or replace function public.clone_shared_set_with_quota(
  p_token text,p_user_id uuid,p_enforcement_mode text
)
returns table(new_set_id uuid,already_exists boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if p_enforcement_mode not in ('observe','warn','block') then raise exception using errcode='22023',message='invalid enforcement mode'; end if;
  perform set_config('capystudy.quota_mode',p_enforcement_mode,true);
  return query select * from public.clone_shared_set(p_token,p_user_id);
end;
$$;

create or replace function public.provision_starter_sets_with_quota(
  p_user_id uuid,p_enforcement_mode text
)
returns table(provisioning_status text,created_sets integer,existing_sets integer,missing_sets integer,attempts integer)
language plpgsql security definer set search_path = '' as $$
begin
  if p_enforcement_mode not in ('observe','warn','block') then raise exception using errcode='22023',message='invalid enforcement mode'; end if;
  perform set_config('capystudy.quota_mode',p_enforcement_mode,true);
  return query select * from public.provision_starter_sets(p_user_id);
end;
$$;

-- Ensure the LP-06 catalog wrapper also reaches the shared DB guard.
create or replace function public.install_catalog_set_for_user(
  p_user_id uuid,p_catalog_set_id uuid,p_idempotency_key uuid,p_enforcement_mode text
)
returns table(set_id uuid,already_exists boolean,card_count integer,catalog_version integer)
language plpgsql security definer set search_path = '' as $$
begin
  if p_enforcement_mode not in ('observe','warn','block') then raise exception using errcode='22023',message='invalid catalog install request'; end if;
  perform set_config('capystudy.quota_mode',p_enforcement_mode,true);
  return query select * from public.install_catalog_set(p_user_id,p_catalog_set_id,p_idempotency_key);
end;
$$;

revoke all on function public.import_flashcard_set(text,jsonb), public.add_flashcard(uuid,text,text),
  public.create_special_collection(text,text,text) from authenticated;
revoke update(front,back) on public.flashcards from authenticated;
grant update(front,back) on public.flashcards to authenticated;
revoke all on function public.commit_flashcard_import(text,jsonb,uuid,text,bigint,bigint,boolean),
  public.add_flashcard_with_quota(uuid,text,text),
  public.update_flashcard_with_quota(uuid,uuid,text,text),
  public.create_special_collection_with_quota(text) from public,anon;
grant execute on function public.commit_flashcard_import(text,jsonb,uuid,text,bigint,bigint,boolean),
  public.add_flashcard_with_quota(uuid,text,text),
  public.update_flashcard_with_quota(uuid,uuid,text,text),
  public.create_special_collection_with_quota(text) to authenticated;

revoke all on function public.clone_shared_set_with_quota(text,uuid,text),
  public.provision_starter_sets_with_quota(uuid,text) from public,anon,authenticated;
grant execute on function public.clone_shared_set_with_quota(text,uuid,text),
  public.provision_starter_sets_with_quota(uuid,text) to service_role;

revoke all on function public.storage_enforcement_mode(),public.assert_storage_totals(uuid),
  public.enforce_set_storage_statement(),public.enforce_card_storage_statement(),
  public.enforce_collection_storage_statement(),public.enforce_card_side_limit() from public,anon,authenticated;
