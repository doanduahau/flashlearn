-- Regression coverage for complete projection equality and CAS/freshness guards.

begin;

select plan(29);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-1919-1919-1919-191919191919', 'authenticated', 'authenticated', 'hardening.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-1919-1919-1919-191919191919', 'authenticated', 'authenticated', 'hardening.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.flashcard_sets (id, user_id, name) values
  ('11111111-1919-1919-1919-191919191919', 'aaaaaaaa-1919-1919-1919-191919191919', 'Hardening A'),
  ('22222222-1919-1919-1919-191919191919', 'bbbbbbbb-1919-1919-1919-191919191919', 'Hardening B');

insert into public.flashcards (id, user_id, set_id, front, back) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-1919-1919-1919-191919191919', '11111111-1919-1919-1919-191919191919', 'A1', 'A1 answer'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-1919-1919-1919-191919191919', '11111111-1919-1919-1919-191919191919', 'A2', 'A2 answer'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-1919-1919-1919-191919191919', '22222222-1919-1919-1919-191919191919', 'B1', 'B1 answer');

insert into public.card_review_events (id, user_id, flashcard_id, source, is_correct, reviewed_at) values
  ('00000000-0000-4000-8000-000000000101', 'aaaaaaaa-1919-1919-1919-191919191919', 'aaaaaaaa-0000-4000-8000-000000000001', 'smart_review', true, '2026-08-09 12:00:00+00'),
  ('00000000-0000-4000-8000-000000000102', 'aaaaaaaa-1919-1919-1919-191919191919', 'aaaaaaaa-0000-4000-8000-000000000001', 'smart_review', false, '2026-08-09 12:05:00+00'),
  ('00000000-0000-4000-8000-000000000201', 'aaaaaaaa-1919-1919-1919-191919191919', 'aaaaaaaa-0000-4000-8000-000000000002', 'smart_review', true, '2026-08-09 12:30:00+00'),
  ('00000000-0000-4000-8000-000000000301', 'bbbbbbbb-1919-1919-1919-191919191919', 'bbbbbbbb-0000-4000-8000-000000000001', 'smart_review', true, '2026-08-09 12:30:00+00');

create or replace function pg_temp.ups(
  p_revision bigint, p_state smallint default 2, p_stability double precision default 5,
  p_difficulty double precision default 3.5, p_due timestamptz default '2026-08-10 12:00:00+00',
  p_scheduled_days double precision default 1, p_learning_steps integer default 0,
  p_reps integer default 2, p_lapses integer default 0,
  p_last_review timestamptz default '2026-08-09 12:05:00+00',
  p_event_count bigint default 2, p_cursor_at timestamptz default '2026-08-09 12:05:00+00',
  p_cursor_id uuid default '00000000-0000-4000-8000-000000000102',
  p_algorithm text default 'fsrs-6', p_implementation text default 'ts-fsrs@5.4.1',
  p_parameter_set text default 'flashlearn-v1'
) returns bigint language sql as $$
  select public.upsert_card_learning_schedule(
    'aaaaaaaa-1919-1919-1919-191919191919'::uuid,
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    p_revision, p_state, p_stability, p_difficulty, p_due, p_scheduled_days,
    p_learning_steps, p_reps, p_lapses, p_last_review, p_event_count,
    p_cursor_at, p_cursor_id, p_algorithm, p_implementation, p_parameter_set
  );
$$;

select is(pg_temp.ups((-1)::bigint), 0::bigint, 'initial projection insert creates revision zero');
select is((select projection_revision from public.card_learning_schedule), 0::bigint, 'negative sentinel is not persisted');

select is(pg_temp.ups(0::bigint), 0::bigint, 'an exact complete duplicate is a no-op');
select is((select projection_revision from public.card_learning_schedule), 0::bigint, 'exact duplicate does not increment revision');

select is(pg_temp.ups(0::bigint, p_scheduled_days => 2), 1::bigint, 'changed scheduled_days is not a no-op');
select is((select scheduled_days from public.card_learning_schedule), 2::double precision, 'changed scheduled_days persists');
select is(pg_temp.ups(1::bigint, p_scheduled_days => 2, p_learning_steps => 1), 2::bigint, 'changed learning_steps is not a no-op');
select is((select learning_steps from public.card_learning_schedule), 1, 'changed learning_steps persists');
select is(pg_temp.ups(2::bigint, p_scheduled_days => 2, p_learning_steps => 1, p_last_review => '2026-08-09 12:04:00+00'), 3::bigint, 'changed last_review is not a no-op');
select is((select last_review from public.card_learning_schedule), '2026-08-09 12:04:00+00'::timestamptz, 'changed last_review persists');
select is(pg_temp.ups(3::bigint, p_scheduled_days => 2, p_learning_steps => 1, p_last_review => '2026-08-09 12:04:00+00', p_algorithm => 'fsrs-6-alt'), 4::bigint, 'changed algorithm is not a no-op');
select is((select algorithm from public.card_learning_schedule), 'fsrs-6-alt', 'changed algorithm persists');
select is(pg_temp.ups(4::bigint, p_scheduled_days => 2, p_learning_steps => 1, p_last_review => '2026-08-09 12:04:00+00', p_algorithm => 'fsrs-6-alt', p_implementation => 'ts-fsrs@5.4.2'), 5::bigint, 'changed implementation is not a no-op');
select is(pg_temp.ups(5::bigint, p_scheduled_days => 2, p_learning_steps => 1, p_last_review => '2026-08-09 12:04:00+00', p_algorithm => 'fsrs-6-alt', p_implementation => 'ts-fsrs@5.4.2', p_parameter_set => 'flashlearn-v2'), 6::bigint, 'changed parameter_set is not a no-op');
select is((select parameter_set from public.card_learning_schedule), 'flashlearn-v2', 'changed parameter_set persists');

-- Two writers based on revision 6 compete: only the first can mutate.
select is(pg_temp.ups(6::bigint, p_scheduled_days => 2, p_learning_steps => 1, p_last_review => '2026-08-09 12:04:00+00', p_algorithm => 'fsrs-6-alt', p_implementation => 'ts-fsrs@5.4.2', p_parameter_set => 'flashlearn-v2', p_reps => 3), 7::bigint, 'first competing CAS writer mutates');
select throws_ok(
  $$select pg_temp.ups(6::bigint, p_scheduled_days => 2, p_learning_steps => 1, p_last_review => '2026-08-09 12:04:00+00', p_algorithm => 'fsrs-6-alt', p_implementation => 'ts-fsrs@5.4.2', p_parameter_set => 'flashlearn-v2', p_reps => 4)$$,
  '22023', 'cas conflict: expected revision 6, current is 7',
  'second competing CAS writer receives a conflict'
);
select is((select reps from public.card_learning_schedule), 3, 'failed competing write leaves the prior projection unchanged');

-- A later event invalidates an older complete replay.
insert into public.card_review_events (id, user_id, flashcard_id, source, is_correct, reviewed_at)
values ('00000000-0000-4000-8000-000000000103', 'aaaaaaaa-1919-1919-1919-191919191919', 'aaaaaaaa-0000-4000-8000-000000000001', 'smart_review', true, '2026-08-09 12:10:00+00');
select throws_ok($$select pg_temp.ups(7::bigint, p_scheduled_days => 2, p_learning_steps => 1, p_last_review => '2026-08-09 12:04:00+00', p_algorithm => 'fsrs-6-alt', p_implementation => 'ts-fsrs@5.4.2', p_parameter_set => 'flashlearn-v2', p_reps => 3)$$, '22023', 'stale projection: event count mismatch', 'new later event rejects a stale projection');
select is(pg_temp.ups(7::bigint, p_scheduled_days => 2, p_learning_steps => 1, p_last_review => '2026-08-09 12:10:00+00', p_event_count => 3, p_cursor_at => '2026-08-09 12:10:00+00', p_cursor_id => '00000000-0000-4000-8000-000000000103', p_algorithm => 'fsrs-6-alt', p_implementation => 'ts-fsrs@5.4.2', p_parameter_set => 'flashlearn-v2', p_reps => 3), 8::bigint, 'fresh complete replay after later event succeeds');

-- A late event before the cursor still invalidates the replay by count.
insert into public.card_review_events (id, user_id, flashcard_id, source, is_correct, reviewed_at)
values ('00000000-0000-4000-8000-000000000100', 'aaaaaaaa-1919-1919-1919-191919191919', 'aaaaaaaa-0000-4000-8000-000000000001', 'smart_review', true, '2026-08-09 11:00:00+00');
select throws_ok($$select pg_temp.ups(8::bigint, p_scheduled_days => 2, p_learning_steps => 1, p_last_review => '2026-08-09 12:10:00+00', p_event_count => 3, p_cursor_at => '2026-08-09 12:10:00+00', p_cursor_id => '00000000-0000-4000-8000-000000000103', p_algorithm => 'fsrs-6-alt', p_implementation => 'ts-fsrs@5.4.2', p_parameter_set => 'flashlearn-v2', p_reps => 3)$$, '22023', 'stale projection: event count mismatch', 'late earlier event rejects replay even when final cursor is unchanged');

-- Same timestamps use UUID order; cursor must be the UUID-greatest final event.
insert into public.card_review_events (id, user_id, flashcard_id, source, is_correct, reviewed_at) values
  ('00000000-0000-4000-8000-000000000104', 'aaaaaaaa-1919-1919-1919-191919191919', 'aaaaaaaa-0000-4000-8000-000000000001', 'smart_review', true, '2026-08-09 12:20:00+00'),
  ('00000000-0000-4000-8000-000000000105', 'aaaaaaaa-1919-1919-1919-191919191919', 'aaaaaaaa-0000-4000-8000-000000000001', 'smart_review', false, '2026-08-09 12:20:00+00');
select throws_ok($$select pg_temp.ups(8::bigint, p_scheduled_days => 2, p_learning_steps => 1, p_last_review => '2026-08-09 12:20:00+00', p_event_count => 6, p_cursor_at => '2026-08-09 12:20:00+00', p_cursor_id => '00000000-0000-4000-8000-000000000104', p_algorithm => 'fsrs-6-alt', p_implementation => 'ts-fsrs@5.4.2', p_parameter_set => 'flashlearn-v2', p_reps => 3)$$, '22023', 'stale projection: final event id mismatch', 'same-timestamp lower UUID is not accepted as final cursor');
select is(pg_temp.ups(8::bigint, p_scheduled_days => 2, p_learning_steps => 1, p_last_review => '2026-08-09 12:20:00+00', p_event_count => 6, p_cursor_at => '2026-08-09 12:20:00+00', p_cursor_id => '00000000-0000-4000-8000-000000000105', p_algorithm => 'fsrs-6-alt', p_implementation => 'ts-fsrs@5.4.2', p_parameter_set => 'flashlearn-v2', p_reps => 3), 9::bigint, 'same-timestamp UUID-greatest cursor succeeds');

-- A cursor-time mismatch in a pre-existing projection is semantic state, not a no-op.
update public.card_learning_schedule
set last_processed_reviewed_at = '2026-08-09 12:19:00+00';
select is(pg_temp.ups(9::bigint, p_scheduled_days => 2, p_learning_steps => 1, p_last_review => '2026-08-09 12:20:00+00', p_event_count => 6, p_cursor_at => '2026-08-09 12:20:00+00', p_cursor_id => '00000000-0000-4000-8000-000000000105', p_algorithm => 'fsrs-6-alt', p_implementation => 'ts-fsrs@5.4.2', p_parameter_set => 'flashlearn-v2', p_reps => 3), 10::bigint, 'changed cursor timestamp is not a no-op');
select is((select last_processed_reviewed_at from public.card_learning_schedule), '2026-08-09 12:20:00+00'::timestamptz, 'changed cursor timestamp is repaired');

-- Foreign, wrong-card, and non-schedulable cursor IDs can never become A1's cursor.
select throws_ok($$select pg_temp.ups(10::bigint, p_scheduled_days => 2, p_learning_steps => 1, p_last_review => '2026-08-09 12:20:00+00', p_event_count => 6, p_cursor_at => '2026-08-09 12:30:00+00', p_cursor_id => '00000000-0000-4000-8000-000000000301', p_algorithm => 'fsrs-6-alt', p_implementation => 'ts-fsrs@5.4.2', p_parameter_set => 'flashlearn-v2', p_reps => 3)$$, '22023', 'stale projection: final event id mismatch', 'foreign cursor event is rejected');
select throws_ok($$select pg_temp.ups(10::bigint, p_scheduled_days => 2, p_learning_steps => 1, p_last_review => '2026-08-09 12:20:00+00', p_event_count => 6, p_cursor_at => '2026-08-09 12:30:00+00', p_cursor_id => '00000000-0000-4000-8000-000000000201', p_algorithm => 'fsrs-6-alt', p_implementation => 'ts-fsrs@5.4.2', p_parameter_set => 'flashlearn-v2', p_reps => 3)$$, '22023', 'stale projection: final event id mismatch', 'wrong-card cursor event is rejected');

insert into public.card_review_events (id, user_id, flashcard_id, source, reviewed_at)
values ('00000000-0000-4000-8000-000000000106', 'aaaaaaaa-1919-1919-1919-191919191919', 'aaaaaaaa-0000-4000-8000-000000000001', 'study_recall', '2026-08-09 12:40:00+00');
select throws_ok($$select pg_temp.ups(10::bigint, p_scheduled_days => 2, p_learning_steps => 1, p_last_review => '2026-08-09 12:20:00+00', p_event_count => 6, p_cursor_at => '2026-08-09 12:40:00+00', p_cursor_id => '00000000-0000-4000-8000-000000000106', p_algorithm => 'fsrs-6-alt', p_implementation => 'ts-fsrs@5.4.2', p_parameter_set => 'flashlearn-v2', p_reps => 3)$$, '22023', 'stale projection: final event id mismatch', 'non-schedulable cursor event is rejected');

select throws_ok($$select pg_temp.ups(10::bigint, p_scheduled_days => 2, p_learning_steps => 1, p_last_review => '2026-08-09 12:20:00+00', p_event_count => 6, p_cursor_at => '2026-08-09 12:20:00+00', p_cursor_id => '00000000-0000-4000-8000-000000000105', p_algorithm => ' ', p_implementation => 'ts-fsrs@5.4.2', p_parameter_set => 'flashlearn-v2', p_reps => 3)$$, '23514', NULL, 'blank scheduler identity is rejected by the table constraints');

drop function pg_temp.ups;
select * from finish();
rollback;
