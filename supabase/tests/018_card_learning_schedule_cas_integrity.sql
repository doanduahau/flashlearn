-- card_learning_schedule CAS/integrity/ownership tests.

begin;

select plan(19);

-- fixtures ------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'authenticated', 'authenticated', 'cas.a@example.com', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'authenticated', 'authenticated', 'cas.b@example.com', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

insert into public.flashcard_sets (id, user_id, name)
values ('11111111-1111-1111-1111-1111111111aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Set A');
insert into public.flashcard_sets (id, user_id, name)
values ('55555555-5555-5555-5555-5555555555aa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Set B');

insert into public.flashcards (id, user_id, set_id, front, back)
values ('22222222-2222-2222-2222-2222222222aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-1111111111aa', 'A front', 'A back');
insert into public.flashcards (id, user_id, set_id, front, back)
values ('66666666-6666-6666-6666-6666666666aa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-5555555555aa', 'B front', 'B back');

insert into public.card_review_events (id, user_id, flashcard_id, source, is_correct, reviewed_at)
values ('e0000000-0000-4000-8000-000000000c01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-2222222222aa', 'smart_review', true, '2026-08-09 12:00:00+00');
insert into public.card_review_events (id, user_id, flashcard_id, source, is_correct, reviewed_at)
values ('e0000000-0000-4000-8000-000000000c02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-2222222222aa', 'smart_review', false, '2026-08-09 12:05:00+00');
insert into public.card_review_events (id, user_id, flashcard_id, source, reviewed_at)
values ('e0000000-0000-4000-8000-000000000c04', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-2222222222aa', 'study_recall', '2026-08-09 12:15:00+00');

-- typed wrapper so call sites avoid ambiguous literal resolution
create or replace function pg_temp.ups(
  p_uid uuid, p_cid uuid, p_rev bigint,
  p_st smallint, p_sb double precision, p_df double precision,
  p_du timestamptz, p_sd double precision, p_ls integer, p_rp integer, p_lp integer,
  p_lr timestamptz, p_ec bigint, p_lra timestamptz, p_le uuid,
  p_alg text, p_impl text, p_ps text
) returns bigint language sql as $$
  select public.upsert_card_learning_schedule(
    p_uid, p_cid, p_rev, p_st, p_sb, p_df, p_du, p_sd, p_ls, p_rp, p_lp,
    p_lr, p_ec, p_lra, p_le, p_alg, p_impl, p_ps
  );
$$;

-- A: initial valid insert ---------------------------------------------------
select lives_ok(
  $$select pg_temp.ups('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '22222222-2222-2222-2222-2222222222aa'::uuid, (-1)::bigint, 1::smallint, 2.3065::double precision, 2.1181::double precision, '2026-08-09 12:10:00+00'::timestamptz, 0::double precision, 1, 1, 0, '2026-08-09 12:00:00+00'::timestamptz, 2::bigint, '2026-08-09 12:05:00+00'::timestamptz, 'e0000000-0000-4000-8000-000000000c02'::uuid, 'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1')$$
);

select is(
  (select projection_revision from public.card_learning_schedule where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  0::bigint
);

-- B: current revision write -------------------------------------------------
select lives_ok(
  $$select pg_temp.ups('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '22222222-2222-2222-2222-2222222222aa'::uuid, 0::bigint, 2::smallint, 5.0::double precision, 3.5::double precision, '2026-08-10 12:00:00+00'::timestamptz, 1::double precision, 0, 2, 0, '2026-08-09 12:05:00+00'::timestamptz, 2::bigint, '2026-08-09 12:05:00+00'::timestamptz, 'e0000000-0000-4000-8000-000000000c02'::uuid, 'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1')$$
);

select is(
  (select projection_revision from public.card_learning_schedule where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  1::bigint
);

select is(
  (select state from public.card_learning_schedule where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  2::smallint
);

-- C: stale expected revision ------------------------------------------------
select throws_ok(
  $$select pg_temp.ups('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '22222222-2222-2222-2222-2222222222aa'::uuid, 0::bigint, 2::smallint, 5.0::double precision, 3.5::double precision, '2026-08-10 12:00:00+00'::timestamptz, 1::double precision, 0, 2, 0, '2026-08-09 12:05:00+00'::timestamptz, 2::bigint, '2026-08-09 12:05:00+00'::timestamptz, 'e0000000-0000-4000-8000-000000000c02'::uuid, 'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1')$$,
  '22023', 'cas conflict: expected revision 0, current is 1'
);

select is(
  (select projection_revision from public.card_learning_schedule where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  1::bigint
);

-- D: exact already-current repeat (no-op) -----------------------------------
select lives_ok(
  $$select pg_temp.ups('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '22222222-2222-2222-2222-2222222222aa'::uuid, 1::bigint, 2::smallint, 5.0::double precision, 3.5::double precision, '2026-08-10 12:00:00+00'::timestamptz, 1::double precision, 0, 2, 0, '2026-08-09 12:05:00+00'::timestamptz, 2::bigint, '2026-08-09 12:05:00+00'::timestamptz, 'e0000000-0000-4000-8000-000000000c02'::uuid, 'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1')$$
);

select is(
  (select projection_revision from public.card_learning_schedule where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  1::bigint
);

-- E: new event committed after snapshot (freshness guard) -------------------
insert into public.card_review_events (id, user_id, flashcard_id, source, is_correct, reviewed_at)
values ('e0000000-0000-4000-8000-000000000c03', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-2222222222aa', 'smart_review', true, '2026-08-09 12:10:00+00');

select throws_ok(
  $$select pg_temp.ups('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '22222222-2222-2222-2222-2222222222aa'::uuid, 1::bigint, 2::smallint, 5.0::double precision, 3.5::double precision, '2026-08-10 12:00:00+00'::timestamptz, 1::double precision, 0, 2, 0, '2026-08-09 12:10:00+00'::timestamptz, 2::bigint, '2026-08-09 12:05:00+00'::timestamptz, 'e0000000-0000-4000-8000-000000000c02'::uuid, 'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1')$$,
  '22023', 'stale projection: event count mismatch'
);

select is(
  (select projection_revision from public.card_learning_schedule where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  1::bigint
);

-- F: cursor event id mismatch -----------------------------------------------
select throws_ok(
  $$select pg_temp.ups('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '22222222-2222-2222-2222-2222222222aa'::uuid, 1::bigint, 2::smallint, 5.0::double precision, 3.5::double precision, '2026-08-10 12:00:00+00'::timestamptz, 1::double precision, 0, 2, 0, '2026-08-09 12:10:00+00'::timestamptz, 3::bigint, '2026-08-09 12:05:00+00'::timestamptz, 'e0000000-0000-4000-8000-000000000c02'::uuid, 'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1')$$,
  '22023', 'stale projection: final event id mismatch'
);

-- G: cursor reviewed_at mismatch --------------------------------------------
select throws_ok(
  $$select pg_temp.ups('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '22222222-2222-2222-2222-2222222222aa'::uuid, 1::bigint, 2::smallint, 5.0::double precision, 3.5::double precision, '2026-08-10 12:00:00+00'::timestamptz, 1::double precision, 0, 2, 0, '2026-08-09 12:10:00+00'::timestamptz, 3::bigint, '2026-08-09 12:00:00+00'::timestamptz, 'e0000000-0000-4000-8000-000000000c03'::uuid, 'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1')$$,
  '22023', 'stale projection: final event time mismatch'
);

-- H: processed_event_count = 0 -----------------------------------------------
select throws_ok(
  $$select pg_temp.ups('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '22222222-2222-2222-2222-2222222222aa'::uuid, (-1)::bigint, 1::smallint, 2.3::double precision, 2.1::double precision, '2026-08-10 12:00:00+00'::timestamptz, 0::double precision, 1, 1, 0, '2026-08-09 12:10:00+00'::timestamptz, 0::bigint, '2026-08-09 12:10:00+00'::timestamptz, 'e0000000-0000-4000-8000-000000000c03'::uuid, 'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1')$$,
  '22023', 'processed_event_count must be at least 1'
);

-- I: non-schedulable event as cursor ----------------------------------------
select throws_ok(
  $$select pg_temp.ups('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '22222222-2222-2222-2222-2222222222aa'::uuid, 1::bigint, 2::smallint, 5.0::double precision, 3.5::double precision, '2026-08-10 12:00:00+00'::timestamptz, 1::double precision, 0, 2, 0, '2026-08-09 12:15:00+00'::timestamptz, 3::bigint, '2026-08-09 12:15:00+00'::timestamptz, 'e0000000-0000-4000-8000-000000000c04'::uuid, 'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1')$$,
  '22023', NULL
);

-- J: foreign flashcard (B card, A claim) ------------------------------------
select throws_ok(
  $$select pg_temp.ups('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '66666666-6666-6666-6666-6666666666aa'::uuid, (-1)::bigint, 1::smallint, 2.3::double precision, 2.1::double precision, '2026-08-10 12:00:00+00'::timestamptz, 0::double precision, 1, 1, 0, '2026-08-09 12:10:00+00'::timestamptz, 0::bigint, '2026-08-09 12:10:00+00'::timestamptz, 'e0000000-0000-4000-8000-000000000c03'::uuid, 'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1')$$,
  '22023', 'flashcard not owned'
);

-- K: cursor event must be chronological final (wrong cursor id) -------------
select throws_ok(
  $$select pg_temp.ups('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '22222222-2222-2222-2222-2222222222aa'::uuid, 1::bigint, 2::smallint, 5.0::double precision, 3.5::double precision, '2026-08-10 12:00:00+00'::timestamptz, 1::double precision, 0, 2, 0, '2026-08-09 12:10:00+00'::timestamptz, 3::bigint, '2026-08-09 12:00:00+00'::timestamptz, 'e0000000-0000-4000-8000-000000000c01'::uuid, 'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1')$$,
  '22023', 'stale projection: final event id mismatch'
);

-- L: deletion cascade + event survival -------------------------------------
delete from public.flashcards where id = '22222222-2222-2222-2222-2222222222aa';
select is(
  (select count(*) from public.card_learning_schedule where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  0::bigint
);
select is(
  (select count(*) from public.card_review_events where flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  4::bigint
);

drop function pg_temp.ups;

select * from finish();
rollback;
