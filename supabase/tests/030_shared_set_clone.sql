begin;
select plan(34);

-- ---------------------------------------------------------------------------
-- Setup: users A (owner) and B (clone recipient); a shared set with 3 cards
-- and a large set (2001 cards) for the limit guard. A review event is added
-- to a source card so we can prove the clone does not copy learning history.
-- ---------------------------------------------------------------------------

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'clone.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'clone.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update public.profiles set display_name = 'Owner A' where id = 'aaaaaaaa-4444-4444-4444-444444444444';
update public.profiles set display_name = 'User B' where id = 'bbbbbbbb-4444-4444-4444-444444444444';

insert into public.flashcard_sets (id, user_id, name, description) values
  ('a1a1a1a1-5555-5555-5555-555555555555', 'aaaaaaaa-4444-4444-4444-444444444444', 'Shared A', 'Set A description'),
  ('a2a2a2a2-5555-5555-5555-555555555555', 'aaaaaaaa-4444-4444-4444-444444444444', 'Big A', null);

insert into public.flashcards (id, user_id, set_id, front, back, position) values
  ('ca000001-5555-4000-8000-000000000001', 'aaaaaaaa-4444-4444-4444-444444444444', 'a1a1a1a1-5555-5555-5555-555555555555', 'QA1', 'AA1', 1),
  ('ca000002-5555-4000-8000-000000000002', 'aaaaaaaa-4444-4444-4444-444444444444', 'a1a1a1a1-5555-5555-5555-555555555555', 'QA2', 'AA2', 2),
  ('ca000003-5555-4000-8000-000000000003', 'aaaaaaaa-4444-4444-4444-444444444444', 'a1a1a1a1-5555-5555-5555-555555555555', 'QA3', 'AA3', 3);

-- A review event on a source card must never be copied to the clone.
insert into public.card_review_events (user_id, flashcard_id, source, is_correct, reviewed_at)
values ('aaaaaaaa-4444-4444-4444-444444444444', 'ca000001-5555-4000-8000-000000000001', 'study_recall', true, now());

-- 2001 cards to exercise the >2000 guard.
insert into public.flashcards (user_id, set_id, front, back, position)
select 'aaaaaaaa-4444-4444-4444-444444444444', 'a2a2a2a2-5555-5555-5555-555555555555', 'F' || g, 'B' || g, g
from generate_series(1, 2001) as g;

select set_config('share.token_a', public.create_set_share_token(
  'aaaaaaaa-4444-4444-4444-444444444444',
  'a1a1a1a1-5555-5555-5555-555555555555'
), false);
select set_config('share.token_big', public.create_set_share_token(
  'aaaaaaaa-4444-4444-4444-444444444444',
  'a2a2a2a2-5555-5555-5555-555555555555'
), false);

-- ---------------------------------------------------------------------------
-- 1. Security boundary: SECURITY DEFINER, empty search_path, service_role only.
-- ---------------------------------------------------------------------------

select ok(
  (select prosecdef from pg_proc where oid = 'public.clone_shared_set(text,uuid)'::regprocedure),
  'clone_shared_set is SECURITY DEFINER'
);
select ok(
  (select proconfig[1] = 'search_path=""' from pg_proc where oid = 'public.clone_shared_set(text,uuid)'::regprocedure),
  'clone_shared_set has empty search_path'
);
select is(
  has_function_privilege('authenticated', 'public.clone_shared_set(text,uuid)', 'execute'),
  false,
  'authenticated cannot execute clone_shared_set'
);
select is(
  has_function_privilege('anon', 'public.clone_shared_set(text,uuid)', 'execute'),
  false,
  'anon cannot execute clone_shared_set'
);
select is(
  has_function_privilege('service_role', 'public.clone_shared_set(text,uuid)', 'execute'),
  true,
  'service_role can execute clone_shared_set'
);

-- ---------------------------------------------------------------------------
-- 2. Input validation.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.clone_shared_set('not-a-token', 'bbbbbbbb-4444-4444-4444-444444444444')$$,
  '22023', NULL,
  'malformed token raises 22023'
);
select throws_ok(
  $$select public.clone_shared_set(NULL, 'bbbbbbbb-4444-4444-4444-444444444444')$$,
  '22023', NULL,
  'null token raises 22023'
);
select throws_ok(
  $$select public.clone_shared_set(current_setting('share.token_a'), NULL)$$,
  '42501', NULL,
  'null user raises 42501'
);
select throws_ok(
  $$select public.clone_shared_set(repeat('f', 32), 'bbbbbbbb-4444-4444-4444-444444444444')$$,
  '42501', 'link not found or disabled',
  'unknown token raises 42501 without revealing validity'
);

-- ---------------------------------------------------------------------------
-- 3. 2000-card limit.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.clone_shared_set(current_setting('share.token_big'), 'bbbbbbbb-4444-4444-4444-444444444444')$$,
  '22023', 'Bộ này vượt quá giới hạn 2000 thẻ',
  'cloning a set over 2000 cards raises 22023'
);

-- ---------------------------------------------------------------------------
-- 4. Clone (classroom OFF): creates an independent snapshot, no membership.
-- ---------------------------------------------------------------------------

select set_config('share.clone_id', (
  select new_set_id::text
  from public.clone_shared_set(current_setting('share.token_a'), 'bbbbbbbb-4444-4444-4444-444444444444')
), false);
select is(
  (select user_id::text from public.flashcard_sets where id = current_setting('share.clone_id')::uuid),
  'bbbbbbbb-4444-4444-4444-444444444444',
  'clone belongs to the requesting user'
);
select is(
  (select name from public.flashcard_sets where id = current_setting('share.clone_id')::uuid),
  'Shared A',
  'clone keeps the original set name'
);
select is(
  (select description from public.flashcard_sets where id = current_setting('share.clone_id')::uuid),
  'Set A description',
  'clone keeps the original description'
);
select is(
  (select share_token from public.flashcard_sets where id = current_setting('share.clone_id')::uuid),
  null,
  'clone is not shared'
);
select is(
  (select count(*)::integer from public.flashcards
   where set_id = current_setting('share.clone_id')::uuid),
  3,
  'clone copies all source cards'
);
select is(
  (select string_agg(position::text, ',' order by position)
   from public.flashcards where set_id = current_setting('share.clone_id')::uuid),
  '1,2,3',
  'clone preserves card positions'
);
select is(
  (select string_agg(front || '|' || back, ',' order by position)
   from public.flashcards where set_id = current_setting('share.clone_id')::uuid),
  'QA1|AA1,QA2|AA2,QA3|AA3',
  'clone copies front and back values'
);
select is(
  (select count(*)::integer from public.card_review_events e
   join public.flashcards c on c.id = e.flashcard_id
   where c.set_id = current_setting('share.clone_id')::uuid),
  0,
  'clone does not copy learning history'
);
select is(
  (select count(*)::integer from public.shared_set_memberships
   where member_user_id = 'bbbbbbbb-4444-4444-4444-444444444444'),
  0,
  'classroom OFF clone records no membership'
);
select is(
  (select count(*)::integer from public.flashcards
   where set_id = 'a1a1a1a1-5555-5555-5555-555555555555'),
  3,
  'cloning does not alter the source set'
);

-- Dedupe (plain link): the clone records its source, and a second save
-- returns the existing clone instead of creating a copy.
select is(
  (select source_share_token from public.flashcard_sets where id = current_setting('share.clone_id')::uuid),
  current_setting('share.token_a'),
  'clone records the source share token'
);
select set_config('share.reclone_plain', (
  select new_set_id::text
  from public.clone_shared_set(current_setting('share.token_a'), 'bbbbbbbb-4444-4444-4444-444444444444')
), false);
select is(
  current_setting('share.reclone_plain'),
  current_setting('share.clone_id'),
  'plain re-save returns the existing clone'
);
select is(
  (select already_exists from public.clone_shared_set(current_setting('share.token_a'), 'bbbbbbbb-4444-4444-4444-444444444444')),
  true,
  'plain re-save reports already_exists'
);
select is(
  (select count(*)::integer from public.flashcard_sets where user_id = 'bbbbbbbb-4444-4444-4444-444444444444'),
  1,
  'plain re-save creates no second copy'
);

-- Isolation: B reads through the token but still cannot touch A's tables.
set local role authenticated; set local request.jwt.claim.sub = 'bbbbbbbb-4444-4444-4444-444444444444';
select is(
  (select count(*)::integer from public.flashcard_sets where id = 'a1a1a1a1-5555-5555-5555-555555555555'),
  0,
  'RLS still blocks direct table reads for the clone recipient'
);
reset role;

-- ---------------------------------------------------------------------------
-- 5. Classroom ON: clone registers a membership and re-clone upserts.
-- ---------------------------------------------------------------------------

select public.set_set_classroom_enabled(
  'aaaaaaaa-4444-4444-4444-444444444444',
  'a1a1a1a1-5555-5555-5555-555555555555',
  true
);

select set_config('share.clone_id_2', (
  select new_set_id::text
  from public.clone_shared_set(current_setting('share.token_a'), 'bbbbbbbb-4444-4444-4444-444444444444')
), false);
select is(
  (select count(*)::integer from public.shared_set_memberships
   where set_id = 'a1a1a1a1-5555-5555-5555-555555555555' and member_user_id = 'bbbbbbbb-4444-4444-4444-444444444444'),
  1,
  'classroom ON clone creates one membership'
);
select is(
  (select clone_set_id::text from public.shared_set_memberships
   where set_id = 'a1a1a1a1-5555-5555-5555-555555555555' and member_user_id = 'bbbbbbbb-4444-4444-4444-444444444444'),
  current_setting('share.clone_id_2'),
  'membership points at the newest clone'
);

select is(
  (select source_share_token from public.flashcard_sets where id = current_setting('share.clone_id_2')::uuid),
  current_setting('share.token_a'),
  'classroom clone records the source share token'
);

-- Re-clone (classroom): the student already joined → the same clone is
-- returned, no new copy is created and the membership is not re-pointed.
select set_config('share.reclone', (
  select new_set_id::text
  from public.clone_shared_set(current_setting('share.token_a'), 'bbbbbbbb-4444-4444-4444-444444444444')
), false);
select is(
  current_setting('share.reclone'),
  current_setting('share.clone_id_2'),
  're-join returns the existing classroom clone'
);
select is(
  (select already_exists from public.clone_shared_set(current_setting('share.token_a'), 'bbbbbbbb-4444-4444-4444-444444444444')),
  true,
  're-join reports already_exists'
);
select is(
  (select count(*)::integer from public.shared_set_memberships
   where member_user_id = 'bbbbbbbb-4444-4444-4444-444444444444'),
  1,
  're-join keeps a single membership'
);
select is(
  (select clone_set_id::text from public.shared_set_memberships
   where set_id = 'a1a1a1a1-5555-5555-5555-555555555555' and member_user_id = 'bbbbbbbb-4444-4444-4444-444444444444'),
  current_setting('share.clone_id_2'),
  're-join does not re-point the membership'
);
select is(
  (select count(*)::integer from public.flashcard_sets where user_id = 'bbbbbbbb-4444-4444-4444-444444444444'),
  2,
  're-join creates no second set copy'
);

-- The original set is still untouched after classroom clones.
select is(
  (select count(*)::integer from public.flashcards
   where set_id = 'a1a1a1a1-5555-5555-5555-555555555555'),
  3,
  'source set cards remain unchanged after classroom clones'
);

select * from finish();
rollback;