begin;
select plan(77);

-- ---------------------------------------------------------------------------
-- Setup: users A, B, C; sets A and B; clone sets for B and C; profiles.
-- ---------------------------------------------------------------------------

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'share.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'share.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'share.c@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update public.profiles set display_name = 'Owner A' where id = 'aaaaaaaa-4444-4444-4444-444444444444';
update public.profiles set display_name = 'User B' where id = 'bbbbbbbb-4444-4444-4444-444444444444';
update public.profiles set display_name = 'User C' where id = 'cccccccc-4444-4444-4444-444444444444';

insert into public.flashcard_sets (id, user_id, name, description) values
  ('a1a1a1a1-4444-4444-4444-444444444444', 'aaaaaaaa-4444-4444-4444-444444444444', 'Shared A', 'Set A description'),
  ('b1b1b1b1-4444-4444-4444-444444444444', 'bbbbbbbb-4444-4444-4444-444444444444', 'Set B', null),
  ('b2b2b2b2-4444-4444-4444-444444444444', 'bbbbbbbb-4444-4444-4444-444444444444', 'Clone B1', null),
  ('b3b3b3b3-4444-4444-4444-444444444444', 'bbbbbbbb-4444-4444-4444-444444444444', 'Clone B2', null),
  ('c1c1c1c1-4444-4444-4444-444444444444', 'cccccccc-4444-4444-4444-444444444444', 'Clone C', null);

-- User A: three cards in the shared set.
insert into public.flashcards (id, user_id, set_id, front, back, position) values
  ('ca000001-4444-4000-8000-000000000001', 'aaaaaaaa-4444-4444-4444-444444444444', 'a1a1a1a1-4444-4444-4444-444444444444', 'QA1', 'AA1', 1),
  ('ca000002-4444-4000-8000-000000000002', 'aaaaaaaa-4444-4444-4444-444444444444', 'a1a1a1a1-4444-4444-4444-444444444444', 'QA2', 'AA2', 2),
  ('ca000003-4444-4000-8000-000000000003', 'aaaaaaaa-4444-4444-4444-444444444444', 'a1a1a1a1-4444-4444-4444-444444444444', 'QA3', 'AA3', 3);

-- User B: one card that must never leak into user A's shared set.
insert into public.flashcards (id, user_id, set_id, front, back, position) values
  ('cb000001-4444-4000-8000-000000000001', 'bbbbbbbb-4444-4444-4444-444444444444', 'b1b1b1b1-4444-4444-4444-444444444444', 'QB', 'AB', 1);

-- ---------------------------------------------------------------------------
-- 1. Security boundary: all six RPCs are SECURITY DEFINER with empty
--    search_path, and grants match the documented roles.
-- ---------------------------------------------------------------------------

select ok(
  (select prosecdef from pg_proc where oid = 'public.create_set_share_token(uuid,uuid)'::regprocedure),
  'create_set_share_token is SECURITY DEFINER'
);
select ok(
  (select proconfig[1] = 'search_path=""' from pg_proc where oid = 'public.create_set_share_token(uuid,uuid)'::regprocedure),
  'create_set_share_token has empty search_path'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.revoke_set_share_token(uuid,uuid)'::regprocedure),
  'revoke_set_share_token is SECURITY DEFINER'
);
select ok(
  (select proconfig[1] = 'search_path=""' from pg_proc where oid = 'public.revoke_set_share_token(uuid,uuid)'::regprocedure),
  'revoke_set_share_token has empty search_path'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.get_shared_set_by_token(text)'::regprocedure),
  'get_shared_set_by_token is SECURITY DEFINER'
);
select ok(
  (select proconfig[1] = 'search_path=""' from pg_proc where oid = 'public.get_shared_set_by_token(text)'::regprocedure),
  'get_shared_set_by_token has empty search_path'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.get_shared_set_cards(text)'::regprocedure),
  'get_shared_set_cards is SECURITY DEFINER'
);
select ok(
  (select proconfig[1] = 'search_path=""' from pg_proc where oid = 'public.get_shared_set_cards(text)'::regprocedure),
  'get_shared_set_cards has empty search_path'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.set_set_classroom_enabled(uuid,uuid,boolean)'::regprocedure),
  'set_set_classroom_enabled is SECURITY DEFINER'
);
select ok(
  (select proconfig[1] = 'search_path=""' from pg_proc where oid = 'public.set_set_classroom_enabled(uuid,uuid,boolean)'::regprocedure),
  'set_set_classroom_enabled has empty search_path'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.register_set_membership(text,uuid,uuid)'::regprocedure),
  'register_set_membership is SECURITY DEFINER'
);
select ok(
  (select proconfig[1] = 'search_path=""' from pg_proc where oid = 'public.register_set_membership(text,uuid,uuid)'::regprocedure),
  'register_set_membership has empty search_path'
);

-- Grants: mutations are service-role only; shared reads are authenticated only.
select is(
  has_function_privilege('authenticated', 'public.create_set_share_token(uuid,uuid)', 'execute'),
  false,
  'authenticated cannot execute create_set_share_token'
);
select is(
  has_function_privilege('anon', 'public.create_set_share_token(uuid,uuid)', 'execute'),
  false,
  'anon cannot execute create_set_share_token'
);
select is(
  has_function_privilege('service_role', 'public.create_set_share_token(uuid,uuid)', 'execute'),
  true,
  'service_role can execute create_set_share_token'
);
select is(
  has_function_privilege('authenticated', 'public.revoke_set_share_token(uuid,uuid)', 'execute'),
  false,
  'authenticated cannot execute revoke_set_share_token'
);
select is(
  has_function_privilege('anon', 'public.revoke_set_share_token(uuid,uuid)', 'execute'),
  false,
  'anon cannot execute revoke_set_share_token'
);
select is(
  has_function_privilege('service_role', 'public.revoke_set_share_token(uuid,uuid)', 'execute'),
  true,
  'service_role can execute revoke_set_share_token'
);
select is(
  has_function_privilege('authenticated', 'public.get_shared_set_by_token(text)', 'execute'),
  true,
  'authenticated can execute get_shared_set_by_token'
);
select is(
  has_function_privilege('anon', 'public.get_shared_set_by_token(text)', 'execute'),
  false,
  'anon cannot execute get_shared_set_by_token'
);
select is(
  has_function_privilege('service_role', 'public.get_shared_set_by_token(text)', 'execute'),
  true,
  'service_role can execute get_shared_set_by_token (anon preview path)'
);
select is(
  has_function_privilege('authenticated', 'public.get_shared_set_cards(text)', 'execute'),
  true,
  'authenticated can execute get_shared_set_cards'
);
select is(
  has_function_privilege('anon', 'public.get_shared_set_cards(text)', 'execute'),
  false,
  'anon cannot execute get_shared_set_cards'
);
select is(
  has_function_privilege('service_role', 'public.get_shared_set_cards(text)', 'execute'),
  true,
  'service_role can execute get_shared_set_cards (anon preview path)'
);
select is(
  has_function_privilege('authenticated', 'public.set_set_classroom_enabled(uuid,uuid,boolean)', 'execute'),
  false,
  'authenticated cannot execute set_set_classroom_enabled'
);
select is(
  has_function_privilege('anon', 'public.set_set_classroom_enabled(uuid,uuid,boolean)', 'execute'),
  false,
  'anon cannot execute set_set_classroom_enabled'
);
select is(
  has_function_privilege('service_role', 'public.set_set_classroom_enabled(uuid,uuid,boolean)', 'execute'),
  true,
  'service_role can execute set_set_classroom_enabled'
);
select is(
  has_function_privilege('authenticated', 'public.register_set_membership(text,uuid,uuid)', 'execute'),
  false,
  'authenticated cannot execute register_set_membership'
);
select is(
  has_function_privilege('anon', 'public.register_set_membership(text,uuid,uuid)', 'execute'),
  false,
  'anon cannot execute register_set_membership'
);
select is(
  has_function_privilege('service_role', 'public.register_set_membership(text,uuid,uuid)', 'execute'),
  true,
  'service_role can execute register_set_membership'
);

-- ---------------------------------------------------------------------------
-- 2. create_set_share_token
-- ---------------------------------------------------------------------------

select set_config('share.token_a', public.create_set_share_token(
  'aaaaaaaa-4444-4444-4444-444444444444',
  'a1a1a1a1-4444-4444-4444-444444444444'
), false);
select ok(
  current_setting('share.token_a') ~ '^[0-9a-f]{32}$',
  'owner creates a 32-hex token'
);
select is(
  (select share_token from public.flashcard_sets where id = 'a1a1a1a1-4444-4444-4444-444444444444'),
  current_setting('share.token_a'),
  'created token is stored on the set'
);
select is(
  (select share_classroom_enabled from public.flashcard_sets where id = 'a1a1a1a1-4444-4444-4444-444444444444'),
  false,
  'creating a token does not enable classroom mode'
);

select throws_ok(
  $$select public.create_set_share_token('bbbbbbbb-4444-4444-4444-444444444444', 'a1a1a1a1-4444-4444-4444-444444444444')$$,
  '42501', 'set not owned',
  'non-owner cannot create a token for another set'
);
select throws_ok(
  $$select public.create_set_share_token('aaaaaaaa-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000')$$,
  '42501', 'set not owned',
  'create token for a nonexistent set is rejected'
);
select set_config('share.token_rotated', public.create_set_share_token(
  'aaaaaaaa-4444-4444-4444-444444444444',
  'a1a1a1a1-4444-4444-4444-444444444444'
), false);
select ok(
  current_setting('share.token_rotated') <> current_setting('share.token_a'),
  'second call rotates to a different token'
);

-- ---------------------------------------------------------------------------
-- 3. revoke_set_share_token
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.revoke_set_share_token('bbbbbbbb-4444-4444-4444-444444444444', 'a1a1a1a1-4444-4444-4444-444444444444')$$,
  '42501', 'set not owned',
  'non-owner cannot revoke another set'
);

-- Turn classroom on first to prove revoke also clears the flag.
select public.set_set_classroom_enabled(
  'aaaaaaaa-4444-4444-4444-444444444444',
  'a1a1a1a1-4444-4444-4444-444444444444',
  true
);
select public.revoke_set_share_token(
  'aaaaaaaa-4444-4444-4444-444444444444',
  'a1a1a1a1-4444-4444-4444-444444444444'
);
select is(
  (select count(*)::integer from public.get_shared_set_by_token(current_setting('share.token_rotated'))),
  0,
  'revoked token resolves to an empty set'
);
select is(
  (select share_token from public.flashcard_sets where id = 'a1a1a1a1-4444-4444-4444-444444444444'),
  null,
  'revoke clears the stored token'
);
select is(
  (select share_classroom_enabled from public.flashcard_sets where id = 'a1a1a1a1-4444-4444-4444-444444444444'),
  false,
  'revoke also disables classroom mode'
);

-- Re-create a token for the read/isolation/classroom tests below.
select set_config('share.token_active', public.create_set_share_token(
  'aaaaaaaa-4444-4444-4444-444444444444',
  'a1a1a1a1-4444-4444-4444-444444444444'
), false);

-- ---------------------------------------------------------------------------
-- 4. get_shared_set_by_token
-- ---------------------------------------------------------------------------

select is(
  (select set_id::text from public.get_shared_set_by_token(current_setting('share.token_active'))),
  'a1a1a1a1-4444-4444-4444-444444444444',
  'valid token returns the correct set id'
);
select is(
  (select name from public.get_shared_set_by_token(current_setting('share.token_active'))),
  'Shared A',
  'valid token returns the set name'
);
select is(
  (select description from public.get_shared_set_by_token(current_setting('share.token_active'))),
  'Set A description',
  'valid token returns the set description'
);
select is(
  (select owner_display_name from public.get_shared_set_by_token(current_setting('share.token_active'))),
  'Owner A',
  'valid token returns the owner display name'
);
select is(
  (select card_count::integer from public.get_shared_set_by_token(current_setting('share.token_active'))),
  3,
  'valid token returns the card count'
);
select is(
  (select share_classroom_enabled from public.get_shared_set_by_token(current_setting('share.token_active'))),
  false,
  'preview RPC reports classroom mode off when it is off'
);
select throws_ok(
  $$select user_id from public.get_shared_set_by_token(current_setting('share.token_active'))$$,
  '42703', NULL,
  'get_shared_set_by_token does not expose the owner user_id'
);
select is(
  (select count(*)::integer from public.get_shared_set_by_token(repeat('a', 32))),
  0,
  'unknown token returns an empty set without raising'
);
select throws_ok(
  $$select public.get_shared_set_by_token('not-a-token')$$,
  '22023', NULL,
  'malformed token raises 22023'
);

-- ---------------------------------------------------------------------------
-- 5. get_shared_set_cards
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from public.get_shared_set_cards(current_setting('share.token_active'))),
  3,
  'cards RPC returns all cards of the shared set'
);
select is(
  (select string_agg(position::text, ',' order by position)
   from public.get_shared_set_cards(current_setting('share.token_active'))),
  '1,2,3',
  'cards are returned ordered by position'
);
select is(
  (select count(*)::integer from public.get_shared_set_cards(repeat('b', 32))),
  0,
  'cards RPC returns empty for an unknown token'
);
select throws_ok(
  $$select public.get_shared_set_cards('SHORT')$$,
  '22023', NULL,
  'cards RPC rejects a malformed token'
);

-- ---------------------------------------------------------------------------
-- 6. Ownership isolation: user B can read through the token, but never
--    through the tables directly.
-- ---------------------------------------------------------------------------

set local role authenticated; set local request.jwt.claim.sub = 'bbbbbbbb-4444-4444-4444-444444444444';
select is(
  (select name from public.get_shared_set_by_token(current_setting('share.token_active'))),
  'Shared A',
  'another user reads the shared set through the token'
);
select is(
  (select count(*)::integer from public.flashcard_sets where id = 'a1a1a1a1-4444-4444-4444-444444444444'),
  0,
  'RLS still blocks direct table reads for a non-owner'
);
reset role;
set local role anon;
select throws_ok(
  $$select * from public.flashcard_sets where id = 'a1a1a1a1-4444-4444-4444-444444444444'$$,
  '42501', NULL,
  'anon cannot read the set table directly'
);
select throws_ok(
  $$select * from public.flashcards where set_id = 'a1a1a1a1-4444-4444-4444-444444444444'$$,
  '42501', NULL,
  'anon cannot read the cards table directly'
);
reset role;

-- User B sharing their own set must not expose user A cards through a B token.
select set_config('share.token_b', public.create_set_share_token(
  'bbbbbbbb-4444-4444-4444-444444444444',
  'b1b1b1b1-4444-4444-4444-444444444444'
), false);
select is(
  (select set_id::text from public.get_shared_set_by_token(current_setting('share.token_b'))),
  'b1b1b1b1-4444-4444-4444-444444444444',
  'user B token resolves to user B set'
);
select is(
  (select front from public.get_shared_set_cards(current_setting('share.token_b'))),
  'QB',
  'user B token returns only user B cards'
);

-- ---------------------------------------------------------------------------
-- 7. set_set_classroom_enabled
-- ---------------------------------------------------------------------------

select public.set_set_classroom_enabled(
  'aaaaaaaa-4444-4444-4444-444444444444',
  'a1a1a1a1-4444-4444-4444-444444444444',
  true
);
select is(
  (select share_classroom_enabled from public.flashcard_sets where id = 'a1a1a1a1-4444-4444-4444-444444444444'),
  true,
  'owner can enable classroom mode'
);
select is(
  (select share_classroom_enabled from public.get_shared_set_by_token(current_setting('share.token_active'))),
  true,
  'preview RPC reports classroom mode on when it is on'
);
select public.set_set_classroom_enabled(
  'aaaaaaaa-4444-4444-4444-444444444444',
  'a1a1a1a1-4444-4444-4444-444444444444',
  false
);
select is(
  (select share_classroom_enabled from public.flashcard_sets where id = 'a1a1a1a1-4444-4444-4444-444444444444'),
  false,
  'owner can disable classroom mode'
);
select throws_ok(
  $$select public.set_set_classroom_enabled('bbbbbbbb-4444-4444-4444-444444444444', 'a1a1a1a1-4444-4444-4444-444444444444', true)$$,
  '42501', 'set not owned',
  'non-owner cannot toggle classroom mode'
);
-- Leave classroom ON for the membership tests.
select public.set_set_classroom_enabled(
  'aaaaaaaa-4444-4444-4444-444444444444',
  'a1a1a1a1-4444-4444-4444-444444444444',
  true
);

-- ---------------------------------------------------------------------------
-- 8. register_set_membership
-- ---------------------------------------------------------------------------

select ok(
  public.register_set_membership(
    current_setting('share.token_active'),
    'b2b2b2b2-4444-4444-4444-444444444444',
    'bbbbbbbb-4444-4444-4444-444444444444'
  ) is not null,
  'classroom clone registers a membership'
);
select is(
  (select count(*)::integer from public.shared_set_memberships
   where set_id = 'a1a1a1a1-4444-4444-4444-444444444444' and member_user_id = 'bbbbbbbb-4444-4444-4444-444444444444'),
  1,
  'one membership row is created'
);
select is(
  (select set_id from public.shared_set_memberships
   where member_user_id = 'bbbbbbbb-4444-4444-4444-444444444444'),
  'a1a1a1a1-4444-4444-4444-444444444444',
  'membership references the shared set'
);
select is(
  (select clone_set_id from public.shared_set_memberships
   where member_user_id = 'bbbbbbbb-4444-4444-4444-444444444444'),
  'b2b2b2b2-4444-4444-4444-444444444444',
  'membership references the first clone set'
);

-- Backdate the membership so the upsert's joined_at refresh is observable
-- (now() is transaction-stable, so two calls in one transaction return the
-- same value).
update public.shared_set_memberships
set joined_at = now() - interval '1 hour'
where member_user_id = 'bbbbbbbb-4444-4444-4444-444444444444';
select set_config('share.joined_before',
  (select joined_at::text from public.shared_set_memberships
   where member_user_id = 'bbbbbbbb-4444-4444-4444-444444444444'), false);
select ok(
  public.register_set_membership(
    current_setting('share.token_active'),
    'b3b3b3b3-4444-4444-4444-444444444444',
    'bbbbbbbb-4444-4444-4444-444444444444'
  ) is not null,
  're-clone registers successfully'
);
select is(
  (select count(*)::integer from public.shared_set_memberships
   where member_user_id = 'bbbbbbbb-4444-4444-4444-444444444444'),
  1,
  're-clone upserts instead of duplicating the row'
);
select is(
  (select clone_set_id from public.shared_set_memberships
   where member_user_id = 'bbbbbbbb-4444-4444-4444-444444444444'),
  'b3b3b3b3-4444-4444-4444-444444444444',
  're-clone updates clone_set_id to the newest snapshot'
);
select ok(
  (select joined_at > current_setting('share.joined_before')::timestamptz
   from public.shared_set_memberships
   where member_user_id = 'bbbbbbbb-4444-4444-4444-444444444444'),
  're-clone refreshes joined_at'
);

-- Classroom OFF must refuse to record a membership.
select public.set_set_classroom_enabled(
  'aaaaaaaa-4444-4444-4444-444444444444',
  'a1a1a1a1-4444-4444-4444-444444444444',
  false
);
select throws_ok(
  $$select public.register_set_membership(current_setting('share.token_active'), 'c1c1c1c1-4444-4444-4444-444444444444', 'cccccccc-4444-4444-4444-444444444444')$$,
  '42501', 'set is not in classroom mode',
  'membership is refused when classroom mode is off'
);
select is(
  (select count(*)::integer from public.shared_set_memberships
   where member_user_id = 'cccccccc-4444-4444-4444-444444444444'),
  0,
  'no membership row is created when classroom mode is off'
);
select public.set_set_classroom_enabled(
  'aaaaaaaa-4444-4444-4444-444444444444',
  'a1a1a1a1-4444-4444-4444-444444444444',
  true
);

-- Unknown token is rejected without recording anything.
select throws_ok(
  $$select public.register_set_membership(repeat('f', 32), 'c1c1c1c1-4444-4444-4444-444444444444', 'cccccccc-4444-4444-4444-444444444444')$$,
  '42501', 'link not found or disabled',
  'unknown token raises for membership registration'
);

-- A clone set that does not belong to the member is rejected.
select throws_ok(
  $$select public.register_set_membership(current_setting('share.token_active'), 'a1a1a1a1-4444-4444-4444-444444444444', 'cccccccc-4444-4444-4444-444444444444')$$,
  '42501', 'clone set not owned',
  'member cannot register a clone set owned by someone else'
);

-- Members cannot read the memberships table; the owner can.
set local role authenticated; set local request.jwt.claim.sub = 'bbbbbbbb-4444-4444-4444-444444444444';
select is(
  (select count(*)::integer from public.shared_set_memberships),
  0,
  'member cannot read the memberships table'
);
reset role;
set local role authenticated; set local request.jwt.claim.sub = 'aaaaaaaa-4444-4444-4444-444444444444';
select is(
  (select count(*)::integer from public.shared_set_memberships),
  1,
  'set owner can read the memberships table'
);
reset role;

select * from finish();
rollback;