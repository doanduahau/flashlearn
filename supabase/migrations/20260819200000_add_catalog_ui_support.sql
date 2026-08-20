-- LP-06: user-facing catalog install gate and one-time starter onboarding banner.

alter table public.starter_provisioning_states
  add column onboarding_announced_at timestamptz;

create or replace function public.claim_starter_onboarding_banner(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_claimed boolean;
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'user id is required';
  end if;
  update public.starter_provisioning_states
  set onboarding_announced_at = now()
  where user_id = p_user_id and status = 'completed' and onboarding_announced_at is null
  returning true into v_claimed;
  return coalesce(v_claimed, false);
end;
$$;
revoke all on function public.claim_starter_onboarding_banner(uuid) from public, anon, authenticated;
grant execute on function public.claim_starter_onboarding_banner(uuid) to service_role;

create or replace function public.install_catalog_set_for_user(
  p_user_id uuid,
  p_catalog_set_id uuid,
  p_idempotency_key uuid,
  p_enforcement_mode text
)
returns table(set_id uuid, already_exists boolean, card_count integer, catalog_version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.user_catalog_installs%rowtype;
  v_current_cards bigint;
  v_current_sets bigint;
  v_catalog_cards bigint;
  v_card_limit bigint;
  v_set_limit bigint;
begin
  if p_user_id is null or p_catalog_set_id is null or p_idempotency_key is null
     or p_enforcement_mode not in ('observe','warn','block') then
    raise exception using errcode = '22023', message = 'invalid catalog install request';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception using errcode = '22023', message = 'user not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('catalog-storage:' || p_user_id::text, 0));
  select * into v_existing from public.user_catalog_installs
  where user_id = p_user_id and catalog_set_id = p_catalog_set_id and status = 'active';
  if found and v_existing.installed_set_id is not null
     and exists (select 1 from public.flashcard_sets where id = v_existing.installed_set_id and user_id = p_user_id) then
    return query select * from public.install_catalog_set(p_user_id,p_catalog_set_id,p_idempotency_key);
    return;
  end if;

  select count(*)::bigint into v_catalog_cards from public.catalog_cards where catalog_set_id = p_catalog_set_id;
  if v_catalog_cards = 0 then
    raise exception using errcode = 'P0002', message = 'published catalog set not found';
  end if;
  select count(*)::bigint into v_current_cards from public.flashcards where user_id = p_user_id;
  select count(*)::bigint into v_current_sets from public.flashcard_sets where user_id = p_user_id;
  if v_current_cards + v_catalog_cards > 30000 or v_current_sets + 1 > 200 then
    raise exception using errcode = '54000', message = 'catalog_hard_storage_ceiling';
  end if;

  v_card_limit := (public.get_effective_entitlement(p_user_id,'cards.total.max')->>'integer_value')::bigint;
  v_set_limit := (public.get_effective_entitlement(p_user_id,'sets.regular.max')->>'integer_value')::bigint;
  if p_enforcement_mode = 'block'
     and (v_current_cards + v_catalog_cards > coalesce(v_card_limit,0)
          or v_current_sets + 1 > coalesce(v_set_limit,0)) then
    raise exception using errcode = 'P0001', message = 'catalog_storage_quota_exceeded';
  end if;

  return query select * from public.install_catalog_set(p_user_id,p_catalog_set_id,p_idempotency_key);
end;
$$;
revoke all on function public.install_catalog_set_for_user(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.install_catalog_set_for_user(uuid,uuid,uuid,text) to service_role;
