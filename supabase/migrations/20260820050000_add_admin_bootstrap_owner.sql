-- LP-09 part 2: audited admin owner bootstrap + role mutation hardening.
-- Additive: extends the Part 1 foundation with a service-role-only bootstrap
-- path (first owner) and idempotent revoke semantics for safe operator retries.

-- Resolve an admin candidate by exact normalized email. Service role only; this
-- is the operator bootstrap path and is never exposed to browsers. Exposing the
-- confirmation state lets the operator script fail before any write.
create or replace function public.get_admin_user_by_email(p_email text)
returns table (
  user_id uuid,
  email text,
  email_confirmed_at timestamptz,
  is_active_owner boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    u.email,
    u.email_confirmed_at,
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = u.id and ur.role = 'owner' and ur.revoked_at is null
    ) as is_active_owner
  from auth.users u
  where u.email = btrim(lower(p_email))
  limit 1;
$$;

revoke all on function public.get_admin_user_by_email(text) from public, anon, authenticated;
grant execute on function public.get_admin_user_by_email(text) to service_role;

-- Bootstrap the first owner. Service role only (operator command). Rules:
--   - the target user must exist and have a confirmed email.
--   - if the target is already an active owner this is an idempotent no-op.
--   - if another owner already exists, refuse: additional owners must go through
--     the audited grant RPC with an authenticated owner actor.
--   - every call (create or idempotent) writes an audit row with operator context.
create or replace function public.bootstrap_owner(
  p_email text,
  p_reason text,
  p_correlation_id uuid default null,
  p_actor_user_id uuid default null
)
returns table (role_id uuid, role text, granted_at timestamptz, bootstrap_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid;
  v_confirmed timestamptz;
  v_reason text;
  v_existing public.user_roles%rowtype;
  v_owner_count bigint;
begin
  if p_email is null or char_length(btrim(p_email)) = 0 then
    raise exception using errcode = '22023', message = 'email is required';
  end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) = 0 or char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'reason is required and must be 500 characters or fewer';
  end if;

  select u.id, u.email_confirmed_at into v_target, v_confirmed
  from auth.users u
  where u.email = btrim(lower(p_email))
  limit 1;

  if v_target is null then
    raise exception using errcode = 'P0002', message = 'user not found';
  end if;
  if v_confirmed is null then
    raise exception using errcode = 'P0002', message = 'user email is not confirmed';
  end if;

  select * into v_existing
  from public.user_roles ur
  where ur.user_id = v_target and ur.role = 'owner' and ur.revoked_at is null
  for update;

  if found then
    insert into public.admin_audit_logs(actor, action, target_type, target_id, correlation_id, reason, after_summary)
    values (p_actor_user_id, 'role.bootstrap.idempotent', 'user', v_target::text, p_correlation_id, v_reason,
            jsonb_build_object('role', 'owner', 'role_id', v_existing.id));
    return query select v_existing.id, v_existing.role, v_existing.created_at, 'idempotent';
    return;
  end if;

  select count(*) into v_owner_count
  from public.user_roles ur
  where ur.role = 'owner' and ur.revoked_at is null;

  if v_owner_count > 0 then
    raise exception using errcode = 'P0001', message = 'owner already bootstrapped; use the audited grant flow';
  end if;

  insert into public.user_roles(user_id, role, created_by)
  values (v_target, 'owner', p_actor_user_id)
  returning * into v_existing;

  insert into public.admin_audit_logs(actor, action, target_type, target_id, correlation_id, reason, before_summary, after_summary)
  values (p_actor_user_id, 'role.bootstrap', 'user', v_target::text, p_correlation_id, v_reason,
          jsonb_build_object('role', 'owner'),
          jsonb_build_object('role', 'owner', 'role_id', v_existing.id));

  return query select v_existing.id, v_existing.role, v_existing.created_at, 'created';
end;
$$;

revoke all on function public.bootstrap_owner(text,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_owner(text,text,uuid,uuid) to service_role;

-- Harden the role invariant trigger: role rows may only be revoked, never edited.
-- Changing role/user/created_by would allow silent escalation, so reject it at the
-- DB level (defense in depth beyond the authenticated-only mutation RPCs).
create or replace function public.user_roles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_count bigint;
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '42501', message = 'admin roles must be revoked, not deleted';
  end if;
  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role
       or new.user_id is distinct from old.user_id
       or new.created_by is distinct from old.created_by
    then
      raise exception using errcode = '42501', message = 'admin roles cannot be modified; revoke and re-grant instead';
    end if;
  end if;
  if tg_op = 'UPDATE'
     and old.role = 'owner'
     and old.revoked_at is null
     and new.revoked_at is not null
  then
    select count(*) into v_owner_count
    from public.user_roles ur
    where ur.role = 'owner' and ur.revoked_at is null;
    if v_owner_count <= 1 then
      raise exception using errcode = 'P0001', message = 'cannot revoke the last owner';
    end if;
  end if;
  return new;
end;
$$;

-- Idempotent revoke: retrying a successful revoke returns the last revoked row
-- instead of failing, so operator retries are safe. First revoke and last-owner
-- checks are unchanged from Part 1.
create or replace function public.revoke_admin_role(
  p_target_user_id uuid,
  p_role text,
  p_reason text,
  p_correlation_id uuid default null
)
returns table(role_id uuid, role text, revoked_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_existing public.user_roles%rowtype;
  v_last_revoked public.user_roles%rowtype;
  v_reason text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_target_user_id is null or p_role is null or p_role not in ('owner','content_admin','support','analyst') then
    raise exception using errcode = '22023', message = 'invalid role input';
  end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) = 0 or char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'reason is required and must be 500 characters or fewer';
  end if;
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_actor and ur.role = 'owner' and ur.revoked_at is null
  ) then
    raise exception using errcode = '42501', message = 'roles.manage permission required';
  end if;

  select * into v_existing
  from public.user_roles ur
  where ur.user_id = p_target_user_id and ur.role = p_role and ur.revoked_at is null
  for update;

  if not found then
    select * into v_last_revoked
    from public.user_roles ur
    where ur.user_id = p_target_user_id and ur.role = p_role
    order by ur.created_at desc
    limit 1;
    if v_last_revoked.id is null then
      raise exception using errcode = 'P0002', message = 'active role grant not found';
    end if;
    insert into public.admin_audit_logs(actor, action, target_type, target_id, correlation_id, reason, after_summary)
    values (v_actor, 'role.revoke.idempotent', 'user', p_target_user_id::text, p_correlation_id, v_reason,
            jsonb_build_object('role', p_role, 'role_id', v_last_revoked.id, 'revoked_at', v_last_revoked.revoked_at));
    return query select v_last_revoked.id, v_last_revoked.role, v_last_revoked.revoked_at;
    return;
  end if;

  if p_role = 'owner' then
    if (select count(*) from public.user_roles ur where ur.role = 'owner' and ur.revoked_at is null) <= 1 then
      raise exception using errcode = 'P0001', message = 'cannot revoke the last owner';
    end if;
  end if;

  update public.user_roles set revoked_at = now() where id = v_existing.id returning * into v_existing;

  insert into public.admin_audit_logs(actor, action, target_type, target_id, correlation_id, reason, before_summary, after_summary)
  values (v_actor, 'role.revoke', 'user', p_target_user_id::text, p_correlation_id, v_reason,
          jsonb_build_object('role', p_role, 'role_id', v_existing.id),
          jsonb_build_object('role', p_role, 'role_id', v_existing.id, 'revoked_at', v_existing.revoked_at));

  return query select v_existing.id, v_existing.role, v_existing.revoked_at;
end;
$$;

revoke all on function public.revoke_admin_role(uuid,text,text,uuid) from public, anon;
grant execute on function public.revoke_admin_role(uuid,text,text,uuid) to authenticated;