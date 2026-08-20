-- LP-09 part 1: audited admin role foundation.
-- Additive: no existing table is modified.
--
-- Adds:
--   public.user_roles          - admin role grants (multi-role per user, revocable)
--   public.admin_audit_logs    - append-only admin audit trail
--   trusted RPCs: get_effective_admin_roles, grant_admin_role, revoke_admin_role,
--                 get_admin_audit_logs
--   last-owner invariant guards (DB-level, cannot be bypassed by direct SQL)

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','content_admin','support','analyst')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (revoked_at is null or revoked_at >= created_at)
);

-- A user may hold many roles, but only one active grant per (user, role).
create unique index user_roles_active_unique
  on public.user_roles (user_id, role) where revoked_at is null;
create index user_roles_user_lookup on public.user_roles (user_id, revoked_at);
create index user_roles_role_lookup on public.user_roles (role, revoked_at);

-- clock_timestamp() preserves true insertion order even within one transaction,
-- so "most recent" audit reads are meaningful.
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor uuid references auth.users(id) on delete set null,
  action text not null check (action ~ '^[a-z][a-z0-9_.]{1,80}$'),
  target_type text not null check (target_type ~ '^[a-z][a-z0-9_.]{1,80}$'),
  target_id text not null check (char_length(target_id) <= 200),
  correlation_id uuid,
  reason text check (reason is null or (char_length(btrim(reason)) between 1 and 500)),
  before_summary jsonb,
  after_summary jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create index admin_audit_logs_created_lookup on public.admin_audit_logs (created_at desc);
create index admin_audit_logs_actor_lookup on public.admin_audit_logs (actor, created_at desc);
create index admin_audit_logs_target_lookup
  on public.admin_audit_logs (target_type, target_id, created_at desc);

alter table public.user_roles enable row level security;
alter table public.admin_audit_logs enable row level security;

-- No policies for anon/authenticated => deny by default. Role and audit data are
-- reachable only through trusted security definer RPCs, never through the REST API.
revoke all on table public.user_roles, public.admin_audit_logs from public, anon, authenticated;
grant all privileges on table public.user_roles, public.admin_audit_logs to service_role;

-- Append-only audit: even service_role cannot UPDATE or DELETE audit rows.
create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'admin audit log is append-only';
end;
$$;
create trigger admin_audit_logs_append_only
  before update or delete on public.admin_audit_logs
  for each row execute function public.prevent_audit_log_mutation();

-- Last-owner invariant and role lifecycle guards:
--   - admin role rows are revoked, never hard-deleted.
--   - the final active owner can never be revoked, at the DB level.
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
create trigger user_roles_invariant_guard
  before delete or update on public.user_roles
  for each row execute function public.user_roles_guard();

-- Active (non-revoked) roles for a user. Server reads this with the service role
-- after resolving the session identity; never called with a browser-supplied id.
create or replace function public.get_effective_admin_roles(p_user_id uuid)
returns table(role text, granted_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.role, r.created_at
  from public.user_roles r
  where r.user_id = p_user_id and r.revoked_at is null
  order by r.created_at;
$$;

revoke all on function public.get_effective_admin_roles(uuid) from public, anon, authenticated;
grant execute on function public.get_effective_admin_roles(uuid) to service_role;

-- Mutation boundary: grant an admin role. The actor is always auth.uid() from the
-- verified session; a forged p_target_user_id/p_role cannot escalate because the
-- actor must already hold the owner role and every input is validated here.
create or replace function public.grant_admin_role(
  p_target_user_id uuid,
  p_role text,
  p_reason text,
  p_correlation_id uuid default null
)
returns table(role_id uuid, role text, granted_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_existing public.user_roles%rowtype;
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
  if not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception using errcode = 'P0002', message = 'target user not found';
  end if;

  select * into v_existing
  from public.user_roles ur
  where ur.user_id = p_target_user_id and ur.role = p_role and ur.revoked_at is null
  for update;

  if found then
    insert into public.admin_audit_logs(actor, action, target_type, target_id, correlation_id, reason, after_summary)
    values (v_actor, 'role.grant.idempotent', 'user', p_target_user_id::text, p_correlation_id, v_reason,
            jsonb_build_object('role', p_role, 'role_id', v_existing.id));
    return query select v_existing.id, v_existing.role, v_existing.created_at;
    return;
  end if;

  insert into public.user_roles(user_id, role, created_by)
  values (p_target_user_id, p_role, v_actor)
  returning * into v_existing;

  insert into public.admin_audit_logs(actor, action, target_type, target_id, correlation_id, reason, before_summary, after_summary)
  values (v_actor, 'role.grant', 'user', p_target_user_id::text, p_correlation_id, v_reason,
          jsonb_build_object('role', p_role),
          jsonb_build_object('role', p_role, 'role_id', v_existing.id));

  return query select v_existing.id, v_existing.role, v_existing.created_at;
end;
$$;

-- Mutation boundary: revoke an admin role. Enforces the last-owner invariant via
-- an explicit pre-check (clear error) and the user_roles_invariant_guard trigger
-- (defense in depth against direct SQL).
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
    raise exception using errcode = 'P0002', message = 'active role grant not found';
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

revoke all on function public.grant_admin_role(uuid,text,text,uuid), public.revoke_admin_role(uuid,text,text,uuid) from public, anon;
grant execute on function public.grant_admin_role(uuid,text,text,uuid), public.revoke_admin_role(uuid,text,text,uuid) to authenticated;

-- Audit read for authorized admins. The server enforces the audit.read permission
-- first (via the typed permission map), then reads with the service role.
create or replace function public.get_admin_audit_logs(
  p_limit integer default 100,
  p_target_type text default null,
  p_target_id text default null,
  p_actor uuid default null
)
returns table(
  id uuid,
  actor uuid,
  action text,
  target_type text,
  target_id text,
  correlation_id uuid,
  reason text,
  before_summary jsonb,
  after_summary jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.actor, a.action, a.target_type, a.target_id, a.correlation_id, a.reason, a.before_summary, a.after_summary, a.created_at
  from public.admin_audit_logs a
  where (p_target_type is null or a.target_type = p_target_type)
    and (p_target_id is null or a.target_id = p_target_id)
    and (p_actor is null or a.actor = p_actor)
  order by a.created_at desc, a.id
  limit greatest(least(coalesce(p_limit, 100), 500), 1);
$$;

revoke all on function public.get_admin_audit_logs(integer,text,text,uuid) from public, anon, authenticated;
grant execute on function public.get_admin_audit_logs(integer,text,text,uuid) to service_role;