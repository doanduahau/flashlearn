begin;
select plan(45);

insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', 'a8000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'ai.free@example.test', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a8000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'ai.pro@example.test', now(), '{}', '{}', now(), now());

insert into public.user_subscriptions(user_id, plan_id, status, current_period_start, current_period_end)
values ('a8000000-0000-4000-8000-000000000002', 'pro_monthly', 'active', now(), now() + interval '1 month');

select ok((select relrowsecurity from pg_class where oid = 'public.processing_job_outputs'::regclass), 'job outputs enable RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.typing_ai_job_results'::regclass), 'typing results enable RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.processing_job_reservations'::regclass), 'job reservation links enable RLS');
select is(has_table_privilege('authenticated', 'public.processing_job_outputs', 'insert'), false, 'browser cannot insert job outputs');
select is(has_function_privilege('authenticated', 'public.start_processing_job(uuid,text,text,uuid,uuid)', 'execute'), false, 'browser cannot start trusted jobs');
select is(has_function_privilege('service_role', 'public.start_processing_job(uuid,text,text,uuid,uuid)', 'execute'), true, 'service role can start trusted jobs');
select is(has_function_privilege('authenticated', 'public.record_processing_job_tokens(uuid,uuid,bigint,bigint)', 'execute'), false, 'browser cannot record trusted provider tokens');
select is(has_function_privilege('service_role', 'public.record_processing_job_tokens(uuid,uuid,bigint,bigint)', 'execute'), true, 'service role can record provider tokens');

select lives_ok($$select * from public.start_processing_job(
  'a8000000-0000-4000-8000-000000000001','document_pipeline','pdf',
  'a8000000-0000-4000-8000-000000000101','a8000000-0000-4000-8000-000000000201'
)$$, 'starts a Free document job');
select is((select plan_id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000101'), 'free', 'job snapshots effective plan');
select is((select physical_call_limit from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000101'), 5, 'Free physical-call cap is five');
select is(
  (select job_id from public.start_processing_job('a8000000-0000-4000-8000-000000000001','document_pipeline','pdf','a8000000-0000-4000-8000-000000000101','a8000000-0000-4000-8000-000000000202')),
  (select id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000101'),
  'same logical job replays its durable id'
);
select is((select count(*)::integer from public.processing_jobs where user_id = 'a8000000-0000-4000-8000-000000000001'), 1, 'job retry does not duplicate rows');
select lives_ok($$select * from public.begin_processing_job_phase(
  (select id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000101'),
  'a8000000-0000-4000-8000-000000000001'
)$$, 'begins first Free phase');
select lives_ok($$select * from public.start_processing_job(
  'a8000000-0000-4000-8000-000000000001','paste_generate','paste_prose',
  'a8000000-0000-4000-8000-000000000102','a8000000-0000-4000-8000-000000000203'
)$$, 'queues a second Free job');
select throws_ok($$select * from public.begin_processing_job_phase(
  (select id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000102'),
  'a8000000-0000-4000-8000-000000000001'
)$$, 'P0001', 'processing job concurrency exceeded', 'Free cannot run a second concurrent heavy job');

select is(public.record_processing_job_call((select id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000101'),'a8000000-0000-4000-8000-000000000001',10), 1, 'records physical call one');
select is(public.record_processing_job_call((select id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000101'),'a8000000-0000-4000-8000-000000000001',10), 2, 'records physical call two');
select is(public.record_processing_job_call((select id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000101'),'a8000000-0000-4000-8000-000000000001',10), 3, 'records physical call three');
select is(public.record_processing_job_call((select id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000101'),'a8000000-0000-4000-8000-000000000001',10), 4, 'records physical call four');
select is(public.record_processing_job_call((select id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000101'),'a8000000-0000-4000-8000-000000000001',10), 5, 'records physical call five');
select throws_ok($$select public.record_processing_job_call(
  (select id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000101'),
  'a8000000-0000-4000-8000-000000000001',10
)$$, 'P0001', 'physical provider call limit exceeded', 'sixth Free physical call is blocked');
select lives_ok($$select public.pause_processing_job(
  (select id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000101'),
  'a8000000-0000-4000-8000-000000000001'
)$$, 'pause releases the DB phase');
select lives_ok($$select * from public.begin_processing_job_phase(
  (select id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000102'),
  'a8000000-0000-4000-8000-000000000001'
)$$, 'next Free job can begin after pause');
select lives_ok($$select public.finish_processing_job(
  (select id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000102'),
  'a8000000-0000-4000-8000-000000000001','succeeded'
)$$, 'finishes a job durably');

select lives_ok($$select * from public.start_processing_job(
  'a8000000-0000-4000-8000-000000000002','typing_ai_review','typing',
  'a8000000-0000-4000-8000-000000000103','a8000000-0000-4000-8000-000000000204'
)$$, 'starts a Pro typing job');
select is((select physical_call_limit from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000103'), 20, 'Pro physical-call cap is twenty');
select lives_ok($$select * from public.begin_processing_job_phase(
  (select id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000103'),
  'a8000000-0000-4000-8000-000000000002'
)$$, 'begins first Pro phase');
select lives_ok($$select * from public.start_processing_job(
  'a8000000-0000-4000-8000-000000000002','paste_generate','paste_prose',
  'a8000000-0000-4000-8000-000000000104','a8000000-0000-4000-8000-000000000205'
)$$, 'queues second Pro job');
select lives_ok($$select * from public.begin_processing_job_phase(
  (select id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000104'),
  'a8000000-0000-4000-8000-000000000002'
)$$, 'Pro may run two concurrent phases');
select lives_ok($$select public.store_typing_ai_job_results(
  (select id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000103'),
  'a8000000-0000-4000-8000-000000000002',
  '[{"item_id":"a8000000-0000-4000-8000-000000000301","correct":true}]'::jsonb
)$$, 'stores bounded typing batch results');
select is((select count(*)::integer from public.typing_ai_job_results), 1, 'typing batch result is durable');
select lives_ok($$select public.record_processing_job_tokens(
  (select id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000103'),
  'a8000000-0000-4000-8000-000000000002', 12, 4
)$$, 'records provider-reported token usage');
select is((select provider_input_tokens from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000103'), 12::bigint, 'stores provider input tokens');
select is((select provider_output_tokens from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000103'), 4::bigint, 'stores provider output tokens');
select lives_ok($$select public.finish_processing_job(
  (select id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000103'),
  'a8000000-0000-4000-8000-000000000002', 'succeeded'
)$$, 'finishing a job preserves accumulated token usage');
select is((select provider_input_tokens from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000103'), 12::bigint, 'finish does not erase provider input tokens');

select throws_ok($$select public.finish_processing_job(
  (select id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000102'),
  'a8000000-0000-4000-8000-000000000001', 'failed'
)$$, '55000', 'processing job is already finished', 'finish cannot overwrite a settled terminal status');
select lives_ok($$select public.finish_processing_job(
  (select id from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000102'),
  'a8000000-0000-4000-8000-000000000001', 'succeeded'
)$$, 'finish replays the same terminal status idempotently');

select lives_ok($$select * from public.start_processing_job(
  'a8000000-0000-4000-8000-000000000001','document_pipeline','pdf',
  'a8000000-0000-4000-8000-000000000105','a8000000-0000-4000-8000-000000000206'
)$$, 'queues a stale job for reconcile');
update public.processing_jobs
set last_heartbeat_at = now() - interval '3 hours', status = 'running', physical_calls = 2
where idempotency_key = 'a8000000-0000-4000-8000-000000000105';
select is((select status from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000105'), 'running', 'stale job is running before reconcile');
select lives_ok($$select * from public.reconcile_stale_processing_jobs()$$, 'reconcile function is callable');
select is((select status from public.processing_jobs where idempotency_key = 'a8000000-0000-4000-8000-000000000105'), 'reconcile_required', 'stale job with provider calls is marked for review');

set local role authenticated;
set local request.jwt.claim.sub = 'a8000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.processing_jobs), 3, 'RLS exposes only own processing jobs');
select is((select count(*)::integer from public.typing_ai_job_results), 0, 'RLS hides another user typing results');
reset role;

select * from finish();
rollback;
