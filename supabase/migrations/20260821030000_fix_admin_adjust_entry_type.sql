-- Fix: admin_adjust_user_usage now uses credit/debit entry types
-- instead of admin_adjust, so quota calculation works correctly.
-- Positive adjustment → credit (reduces consumption = gives budget)
-- Negative adjustment → debit (increases consumption = takes budget)

create or replace function public.admin_adjust_user_usage(
  p_actor_user_id uuid, p_target_user_id uuid, p_usage_key text, p_amount integer, p_reason text,
  p_idempotency_key uuid default null
) returns void
language plpgsql security definer set search_path = '' as $fn$
declare v_reason text; v_idem uuid;
begin
  if p_actor_user_id is null then raise exception using errcode = '42501', message = 'actor user id required'; end if;
  if not public.check_admin_permission(p_actor_user_id, 'usage.adjust') then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;
  if p_target_user_id is null then raise exception using errcode = '22023', message = 'target user required'; end if;
  if p_amount is null or p_amount = 0 or p_amount < -10000 or p_amount > 10000 then
    raise exception using errcode = '22023', message = 'amount must be between -10000 and 10000 (non-zero)';
  end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) = 0 or char_length(v_reason) > 500 then raise exception using errcode = '22023', message = 'reason required (1-500 chars)'; end if;
  v_idem := coalesce(p_idempotency_key, md5(p_actor_user_id::text || p_target_user_id::text || p_usage_key || p_amount::text || v_reason)::uuid);
  if exists(select 1 from public.usage_ledger ul where ul.idempotency_key = v_idem) then return; end if;
  -- Use credit/debit entry types so quota calculation works correctly:
  -- positive adjustment → credit (reduces consumption = gives budget)
  -- negative adjustment → debit (increases consumption = takes budget)
  insert into public.usage_ledger(user_id, entry_type, usage_key, amount, reason, idempotency_key, created_by)
  values (p_target_user_id, case when p_amount > 0 then 'credit' else 'debit' end, p_usage_key, abs(p_amount), v_reason, v_idem, p_actor_user_id);
  insert into public.admin_audit_logs(actor, action, target_type, target_id, reason, after_summary)
  values (p_actor_user_id, 'usage.adjust', 'user', p_target_user_id::text, v_reason,
    jsonb_build_object('usage_key', p_usage_key, 'amount', p_amount));
  return;
end;
$fn$;

revoke all on function public.admin_adjust_user_usage(uuid, uuid, text, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_adjust_user_usage(uuid, uuid, text, integer, text, uuid) to service_role;
grant execute on function public.admin_adjust_user_usage(uuid, uuid, text, integer, text, uuid) to authenticated;
