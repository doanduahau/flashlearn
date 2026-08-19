begin;
select plan(28);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-eeee-eeee-eeee-eeeeeeeeeeee', 'authenticated', 'authenticated', 'quota.a@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-eeee-eeee-eeee-eeeeeeeeeeee', 'authenticated', 'authenticated', 'quota.b@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

select is((select count(*)::integer from public.plans), 3, 'seeds the three approved plans');
select is(public.get_effective_plan('aaaaaaaa-eeee-eeee-eeee-eeeeeeeeeeee'), 'free', 'no subscription resolves to Free');
select is((public.get_effective_entitlement('aaaaaaaa-eeee-eeee-eeee-eeeeeeeeeeee', 'ai.content_credits.monthly')->>'integer_value')::integer, 20, 'Free content credit entitlement resolves');

insert into public.user_subscriptions(user_id, plan_id, status, current_period_start, current_period_end)
values ('bbbbbbbb-eeee-eeee-eeee-eeeeeeeeeeee', 'pro_yearly', 'active', now() - interval '1 day', now() + interval '30 days');
select is(public.get_effective_plan('bbbbbbbb-eeee-eeee-eeee-eeeeeeeeeeee'), 'pro_yearly', 'active annual subscription resolves');
select is((public.get_effective_entitlement('bbbbbbbb-eeee-eeee-eeee-eeeeeeeeeeee', 'ai.content_credits.monthly')->>'integer_value')::integer, 300, 'annual plan receives monthly Pro quota');

select ok((select relrowsecurity from pg_class where oid = 'public.quota_reservations'::regclass), 'reservation table enables RLS');
select is(has_table_privilege('authenticated', 'public.quota_reservations', 'insert'), false, 'authenticated cannot insert reservations');
select is(has_table_privilege('authenticated', 'public.usage_ledger', 'update'), false, 'authenticated cannot update append-only ledger');
select is(has_table_privilege('anon', 'public.user_subscriptions', 'select'), false, 'anon cannot read subscriptions');
select is(has_function_privilege('authenticated', 'public.reserve_usage(uuid,text,bigint,uuid,uuid)', 'execute'), false, 'authenticated cannot call reserve RPC');
select is(has_function_privilege('service_role', 'public.reserve_usage(uuid,text,bigint,uuid,uuid)', 'execute'), true, 'service role can call reserve RPC');

select lives_ok($$select * from public.reserve_usage('aaaaaaaa-eeee-eeee-eeee-eeeeeeeeeeee', 'ai.content_credits.monthly', 10, '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')$$, 'first reservation is accepted');
select is((select status from public.quota_reservations where idempotency_key = '11111111-1111-4111-8111-111111111111'::uuid), 'reserved', 'reservation records reserved state');
select is((select count(*)::integer from public.quota_reservations where user_id = 'aaaaaaaa-eeee-eeee-eeee-eeeeeeeeeeee'), 1, 'one reservation exists');
select is((select reservation_id from public.reserve_usage('aaaaaaaa-eeee-eeee-eeee-eeeeeeeeeeee', 'ai.content_credits.monthly', 10, '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')), (select id from public.quota_reservations where idempotency_key = '11111111-1111-4111-8111-111111111111'::uuid), 'same idempotency key returns existing reservation');
select is((select allowed from public.reserve_usage('aaaaaaaa-eeee-eeee-eeee-eeeeeeeeeeee', 'ai.content_credits.monthly', 11, '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444')), false, 'pending reservation prevents quota overspend');

select lives_ok($$select public.finalize_usage((select id from public.quota_reservations where idempotency_key = '11111111-1111-4111-8111-111111111111'::uuid), 7)$$, 'finalizes less than reserved usage');
select is((select status from public.quota_reservations where idempotency_key = '11111111-1111-4111-8111-111111111111'::uuid), 'finalized', 'reservation finalizes');
select is((select count(*)::integer from public.usage_ledger where entry_type = 'debit'), 1, 'finalize creates one debit ledger entry');
select lives_ok($$select public.finalize_usage((select id from public.quota_reservations where idempotency_key = '11111111-1111-4111-8111-111111111111'::uuid), 7)$$, 'finalize is idempotent');
select is((select count(*)::integer from public.usage_ledger where entry_type = 'debit'), 1, 'repeat finalize does not double debit');
select lives_ok($$select public.refund_usage((select id from public.quota_reservations where idempotency_key = '11111111-1111-4111-8111-111111111111'::uuid), 'provider_failed')$$, 'refund finalized reservation');
select is((select status from public.quota_reservations where idempotency_key = '11111111-1111-4111-8111-111111111111'::uuid), 'refunded', 'reservation records refund');
select is((select count(*)::integer from public.usage_ledger where entry_type = 'credit'), 1, 'refund creates one credit ledger entry');
select lives_ok($$select public.refund_usage((select id from public.quota_reservations where idempotency_key = '11111111-1111-4111-8111-111111111111'::uuid), 'retry')$$, 'refund is idempotent');
select is((select count(*)::integer from public.usage_ledger where entry_type = 'credit'), 1, 'repeat refund does not double credit');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-eeee-eeee-eeee-eeeeeeeeeeee';
select is((select count(*)::integer from public.quota_reservations), 1, 'RLS exposes only own reservation');
select is((select count(*)::integer from public.user_subscriptions), 0, 'RLS hides another user subscription');
reset role;

select * from finish();
rollback;
