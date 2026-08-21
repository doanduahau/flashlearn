-- LP-10 Part 2A pgTAP: V2 Catalog Mutation Domain, State Machine, Versioning, Concurrency, and Starter Invariant Tests

begin;
select plan(71);

-- ============================================================
-- FIXTURES
-- ============================================================

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-aaaa-bbbb-cccc-000000000048', 'authenticated', 'authenticated', 'owner048@test.com', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-aaaa-bbbb-cccc-000000000048', 'authenticated', 'authenticated', 'user048@test.com', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.user_roles (user_id, role, created_by)
values ('11111111-aaaa-bbbb-cccc-000000000048', 'owner', '11111111-aaaa-bbbb-cccc-000000000048');

insert into public.catalog_categories (id, name, slug)
values ('00000000-0000-4000-a000-000000000048'::uuid, 'Category048', 'category-048')
on conflict (slug) do nothing;

-- ============================================================
-- TEST 1: CREATE DRAFT SET (3 assertions)
-- ============================================================

select lives_ok(
  $$select * from public.admin_create_catalog_set(
    '11111111-aaaa-bbbb-cccc-000000000048'::uuid,
    '00000000-0000-4000-a000-000000000048'::uuid,
    'test-set-048',
    'Test Set 048 Title',
    'Description for test 048'
  )$$,
  'admin_create_catalog_set succeeds'
);

select is((select count(*)::integer from public.catalog_sets where slug = 'test-set-048'), 1, 'Draft set created in DB');
select is((select status from public.catalog_sets where slug = 'test-set-048'), 'draft', 'Status is draft');

-- ============================================================
-- TEST 2: CARD REPLACEMENT (EMPTY DRAFT ALLOWED & CARDS INSERTION) (4 assertions)
-- ============================================================

-- Replace with empty array (allowed for draft)
select lives_ok(
  $$select * from public.admin_replace_catalog_cards(
    '11111111-aaaa-bbbb-cccc-000000000048'::uuid,
    (select id from public.catalog_sets where slug = 'test-set-048'),
    NULL,
    '[]'::jsonb,
    'Save empty draft'
  )$$,
  'Replace cards with empty array is allowed for draft'
);
select is((select count(*)::integer from public.catalog_cards where catalog_set_id = (select id from public.catalog_sets where slug = 'test-set-048')), 0, 'Card count is 0');

-- Replace with 2 valid cards
select lives_ok(
  $$select * from public.admin_replace_catalog_cards(
    '11111111-aaaa-bbbb-cccc-000000000048'::uuid,
    (select id from public.catalog_sets where slug = 'test-set-048'),
    NULL,
    '[{"front":"Apple","back":"Quả táo"},{"front":"Banana","back":"Quả chuối"}]'::jsonb,
    'Add 2 fruit cards'
  )$$,
  'Replace cards with 2 items succeeds'
);
select is((select count(*)::integer from public.catalog_cards where catalog_set_id = (select id from public.catalog_sets where slug = 'test-set-048')), 2, 'Card count is 2');

-- ============================================================
-- TEST 3: PUBLISHED SET IMMUTABILITY & VERSION CANONICAL RULES (8 assertions)
-- ============================================================

-- First publish
select lives_ok(
  $$select * from public.admin_publish_catalog_set(
    '11111111-aaaa-bbbb-cccc-000000000048'::uuid,
    (select id from public.catalog_sets where slug = 'test-set-048'),
    NULL,
    'First publish release v1'
  )$$,
  'admin_publish_catalog_set first publish succeeds'
);

select is((select version from public.catalog_sets where slug = 'test-set-048'), 1, 'First publish version is 1');
select is((select published_revision_count from public.catalog_sets where slug = 'test-set-048'), 1, 'published_revision_count is 1');
select is((select status from public.catalog_sets where slug = 'test-set-048'), 'published', 'Status is published');

-- Immutability: Mutating published set is blocked
select throws_ok(
  $$select * from public.admin_update_catalog_set(
    '11111111-aaaa-bbbb-cccc-000000000048'::uuid,
    (select id from public.catalog_sets where slug = 'test-set-048'),
    NULL,
    'Attempted Title Change'
  )$$,
  '22023', 'cannot mutate published catalog set; unpublish to draft first',
  'Cannot update metadata of published set'
);

select throws_ok(
  $$select * from public.admin_replace_catalog_cards(
    '11111111-aaaa-bbbb-cccc-000000000048'::uuid,
    (select id from public.catalog_sets where slug = 'test-set-048'),
    NULL,
    '[{"front":"Orange","back":"Quả cam"}]'::jsonb,
    'Attempted card mutation'
  )$$,
  '22023', 'cannot mutate published catalog set; unpublish to draft first',
  'Cannot replace cards of published set'
);

-- Unpublish to draft
select lives_ok(
  $$select * from public.admin_unpublish_catalog_set(
    '11111111-aaaa-bbbb-cccc-000000000048'::uuid,
    (select id from public.catalog_sets where slug = 'test-set-048'),
    NULL,
    'Unpublish to prepare v2'
  )$$,
  'Unpublish to draft succeeds'
);
select is((select status from public.catalog_sets where slug = 'test-set-048'), 'draft', 'Status is back to draft');

-- ============================================================
-- TEST 4: REPUBLISH REVISION INCREMENT (3 assertions)
-- ============================================================

-- Republish (Revision 2)
select lives_ok(
  $$select * from public.admin_publish_catalog_set(
    '11111111-aaaa-bbbb-cccc-000000000048'::uuid,
    (select id from public.catalog_sets where slug = 'test-set-048'),
    NULL,
    'Republish revision v2'
  )$$,
  'Republish succeeds'
);
select is((select version from public.catalog_sets where slug = 'test-set-048'), 2, 'Version incremented to 2');
select is((select published_revision_count from public.catalog_sets where slug = 'test-set-048'), 2, 'published_revision_count is 2');

-- ============================================================
-- TEST 5: ARCHIVE AND RESTORE STATE MACHINE (4 assertions)
-- ============================================================

-- Archive
select lives_ok(
  $$select * from public.admin_archive_catalog_set(
    '11111111-aaaa-bbbb-cccc-000000000048'::uuid,
    (select id from public.catalog_sets where slug = 'test-set-048'),
    NULL,
    'Archive set'
  )$$,
  'Archive set succeeds'
);
select is((select status from public.catalog_sets where slug = 'test-set-048'), 'archived', 'Status is archived');

-- Illegal transition: archived -> publish (must restore first)
select throws_ok(
  $$select * from public.admin_publish_catalog_set(
    '11111111-aaaa-bbbb-cccc-000000000048'::uuid,
    (select id from public.catalog_sets where slug = 'test-set-048'),
    NULL,
    'Illegal publish'
  )$$,
  '22023', 'cannot publish archived catalog set; restore to draft first',
  'Cannot publish archived set directly'
);

-- Restore to draft
select lives_ok(
  $$select * from public.admin_restore_catalog_set(
    '11111111-aaaa-bbbb-cccc-000000000048'::uuid,
    (select id from public.catalog_sets where slug = 'test-set-048'),
    NULL,
    'Restore to draft'
  )$$,
  'Restore to draft succeeds'
);

-- ============================================================
-- TEST 6: OPTIMISTIC CONCURRENCY PRECONDITION (P0004) (2 assertions)
-- ============================================================

select throws_ok(
  $$select * from public.admin_update_catalog_set(
    '11111111-aaaa-bbbb-cccc-000000000048'::uuid,
    (select id from public.catalog_sets where slug = 'test-set-048'),
    '2020-01-01 00:00:00+00'::timestamptz,
    'Stale Title'
  )$$,
  'P0004', NULL, 'Stale expected_updated_at throws P0004'
);

select lives_ok(
  $$select * from public.admin_update_catalog_set(
    '11111111-aaaa-bbbb-cccc-000000000048'::uuid,
    (select id from public.catalog_sets where slug = 'test-set-048'),
    (select updated_at from public.catalog_sets where slug = 'test-set-048'),
    'Fresh Title Updated'
  )$$,
  'Matching expected_updated_at succeeds'
);

-- ============================================================
-- TEST 7: ATOMIC STARTER SWAP & INVARIANTS (Scenario 7A: Republished set; Scenario 7B: Never-published set)
-- ============================================================

-- Direct unpublish of active starter is blocked (protects count = 3)
select throws_ok(
  $$select * from public.admin_unpublish_catalog_set(
    '11111111-aaaa-bbbb-cccc-000000000048'::uuid,
    (select id from public.catalog_sets where is_starter = true and starter_order = 1),
    NULL,
    'Attempt to unpublish starter'
  )$$,
  '22023', 'cannot unpublish active starter: system requires 3 published starters (use admin_swap_starter_set)',
  'Direct unpublish of active starter is blocked'
);

-- SCENARIO 7A: Swap with a Republished Draft (test-set-048 was published, unpublished, updated, published v2, archived, restored to draft)
-- Pre-swap assertions for test-set-048:
select is((select published_revision_count from public.catalog_sets where slug = 'test-set-048'), 2, 'Pre-swap revision count is 2');
select is((select version from public.catalog_sets where slug = 'test-set-048'), 2, 'Pre-swap version is 2');
select is((select status from public.catalog_sets where slug = 'test-set-048'), 'draft', 'Pre-swap status is draft');
select is((select published_at from public.catalog_sets where slug = 'test-set-048'), NULL, 'Pre-swap published_at is NULL');
select isnt((select first_published_at from public.catalog_sets where slug = 'test-set-048'), NULL, 'Pre-swap first_published_at is non-null');

-- Capture exact pre-swap snapshot for test-set-048
create temporary table _test_048_pre_swap_meta on commit drop as
select id, version, published_revision_count, published_at, first_published_at
from public.catalog_sets
where slug = 'test-set-048';

-- Execute atomic swap: Starter 1 (tu-vung-trai-cay-vi-en) is replaced by test-set-048
select lives_ok(
  $$select * from public.admin_swap_starter_set(
    '11111111-aaaa-bbbb-cccc-000000000048'::uuid,
    (select id from public.catalog_sets where is_starter = true and starter_order = 1),
    (select id from public.catalog_sets where slug = 'test-set-048'),
    (select updated_at from public.catalog_sets where is_starter = true and starter_order = 1),
    (select updated_at from public.catalog_sets where slug = 'test-set-048'),
    'Atomic swap of starter 1'
  )$$,
  'admin_swap_starter_set 7A succeeds'
);

-- Assert Old set 1: status remains published, is_starter = false, starter_order = null, version/publication metadata untouched
select is((select is_starter from public.catalog_sets where slug = 'tu-vung-trai-cay-vi-en'), false, 'Old starter 1 is_starter = false');
select is((select starter_order from public.catalog_sets where slug = 'tu-vung-trai-cay-vi-en'), NULL, 'Old starter 1 starter_order is NULL');
select is((select status from public.catalog_sets where slug = 'tu-vung-trai-cay-vi-en'), 'published', 'Old starter 1 status remains published (normal set)');
select is((select version from public.catalog_sets where slug = 'tu-vung-trai-cay-vi-en'), 1, 'Old starter 1 version remains 1');
select is((select published_revision_count from public.catalog_sets where slug = 'tu-vung-trai-cay-vi-en'), 1, 'Old starter 1 published_revision_count remains 1');
select is((select published_at from public.catalog_sets where slug = 'tu-vung-trai-cay-vi-en'), '2026-08-19 18:00:00+00'::timestamptz, 'Old starter 1 published_at untouched');
select is((select first_published_at from public.catalog_sets where slug = 'tu-vung-trai-cay-vi-en'), '2026-08-19 18:00:00+00'::timestamptz, 'Old starter 1 first_published_at untouched');

-- Assert New set 1: status = published, is_starter = true, starter_order = 1, version and publication revision incremented
select is((select is_starter from public.catalog_sets where slug = 'test-set-048'), true, 'New set 1 is_starter = true');
select is((select starter_order from public.catalog_sets where slug = 'test-set-048'), 1, 'New set 1 starter_order = 1');
select is((select status from public.catalog_sets where slug = 'test-set-048'), 'published', 'New set 1 status is published');
select is((select published_revision_count from public.catalog_sets where slug = 'test-set-048'), 3, 'New set 1 published_revision_count incremented to 3');
select is((select version from public.catalog_sets where slug = 'test-set-048'), 3, 'New set 1 version is 3');
select isnt((select published_at from public.catalog_sets where slug = 'test-set-048'), NULL, 'New set 1 published_at is populated');
select is(
  (select first_published_at from public.catalog_sets where slug = 'test-set-048'),
  (select first_published_at from _test_048_pre_swap_meta),
  'New set 1 post-swap first_published_at exactly equals pre-swap first_published_at'
);
select is((select count(*)::integer from public.catalog_sets where is_starter = true and status = 'published'), 3, 'Total published starters is exactly 3 after swap 7A');

-- SCENARIO 7B: Swap with a Fresh NEVER-PUBLISHED Draft Set
select lives_ok(
  $$select * from public.admin_create_catalog_set(
    '11111111-aaaa-bbbb-cccc-000000000048'::uuid,
    '00000000-0000-4000-a000-000000000048'::uuid,
    'never-pub-starter-048',
    'Never Published Starter 048',
    'Description for fresh starter'
  )$$,
  'Create fresh draft set never-pub-starter-048 succeeds'
);

select lives_ok(
  $$select * from public.admin_replace_catalog_cards(
    '11111111-aaaa-bbbb-cccc-000000000048'::uuid,
    (select id from public.catalog_sets where slug = 'never-pub-starter-048'),
    NULL,
    '[{"front":"Cat","back":"Mèo"},{"front":"Dog","back":"Chó"}]'::jsonb,
    'Add 2 animal cards'
  )$$,
  'Add cards to never-pub-starter-048 succeeds'
);

-- Pre-swap assertions for fresh never-published draft:
select is((select published_revision_count from public.catalog_sets where slug = 'never-pub-starter-048'), 0, 'Fresh draft revision count is 0');
select is((select first_published_at from public.catalog_sets where slug = 'never-pub-starter-048'), NULL, 'Fresh draft first_published_at is NULL');

-- Execute atomic swap: Starter 2 (tu-vung-dong-vat-vi-en) is replaced by never-pub-starter-048
select lives_ok(
  $$select * from public.admin_swap_starter_set(
    '11111111-aaaa-bbbb-cccc-000000000048'::uuid,
    (select id from public.catalog_sets where is_starter = true and starter_order = 2),
    (select id from public.catalog_sets where slug = 'never-pub-starter-048'),
    (select updated_at from public.catalog_sets where is_starter = true and starter_order = 2),
    (select updated_at from public.catalog_sets where slug = 'never-pub-starter-048'),
    'Atomic swap of starter 2 with fresh draft'
  )$$,
  'admin_swap_starter_set 7B succeeds'
);

-- Assert Old set 2: status remains published, is_starter = false, starter_order = null, version/publication metadata untouched
select is((select is_starter from public.catalog_sets where slug = 'tu-vung-dong-vat-vi-en'), false, 'Old starter 2 is_starter = false');
select is((select starter_order from public.catalog_sets where slug = 'tu-vung-dong-vat-vi-en'), NULL, 'Old starter 2 starter_order is NULL');
select is((select status from public.catalog_sets where slug = 'tu-vung-dong-vat-vi-en'), 'published', 'Old starter 2 status remains published (normal set)');
select is((select version from public.catalog_sets where slug = 'tu-vung-dong-vat-vi-en'), 1, 'Old starter 2 version remains 1');
select is((select published_revision_count from public.catalog_sets where slug = 'tu-vung-dong-vat-vi-en'), 1, 'Old starter 2 published_revision_count remains 1');
select is((select published_at from public.catalog_sets where slug = 'tu-vung-dong-vat-vi-en'), '2026-08-19 18:00:00+00'::timestamptz, 'Old starter 2 published_at untouched');
select is((select first_published_at from public.catalog_sets where slug = 'tu-vung-dong-vat-vi-en'), '2026-08-19 18:00:00+00'::timestamptz, 'Old starter 2 first_published_at untouched');

-- Assert New set 2: status = published, is_starter = true, starter_order = 2, first_published_at initialized to published_at
select is((select is_starter from public.catalog_sets where slug = 'never-pub-starter-048'), true, 'New set 2 is_starter = true');
select is((select starter_order from public.catalog_sets where slug = 'never-pub-starter-048'), 2, 'New set 2 starter_order = 2');
select is((select status from public.catalog_sets where slug = 'never-pub-starter-048'), 'published', 'New set 2 status is published');
select is((select published_revision_count from public.catalog_sets where slug = 'never-pub-starter-048'), 1, 'New set 2 published_revision_count initialized to 1');
select is((select version from public.catalog_sets where slug = 'never-pub-starter-048'), 1, 'New set 2 version is 1');
select isnt((select published_at from public.catalog_sets where slug = 'never-pub-starter-048'), NULL, 'New set 2 published_at is populated');
select is((select first_published_at from public.catalog_sets where slug = 'never-pub-starter-048') = (select published_at from public.catalog_sets where slug = 'never-pub-starter-048'), true, 'New set 2 first_published_at equals published_at on first publication');
select is((select count(*)::integer from public.catalog_sets where is_starter = true and status = 'published'), 3, 'Total published starters is exactly 3 after swap 7B');

-- ============================================================
-- TEST 8: CLONE ISOLATION (4 assertions)
-- ============================================================

-- Install catalog set for user048
select lives_ok(
  $$select * from public.install_catalog_set(
    '22222222-aaaa-bbbb-cccc-000000000048'::uuid,
    (select id from public.catalog_sets where slug = 'test-set-048'),
    '99999999-0000-4000-8000-000000000048'::uuid
  )$$,
  'install_catalog_set clones snapshot for user'
);

select is((select count(*)::integer from public.flashcard_sets where user_id = '22222222-aaaa-bbbb-cccc-000000000048'), 1, 'User clone exists');
select is((select count(*)::integer from public.flashcards where user_id = '22222222-aaaa-bbbb-cccc-000000000048'), 2, 'User cards exist');

-- Unpublish retired catalog set does not touch user's clone
select lives_ok(
  $$select * from public.admin_unpublish_catalog_set(
    '11111111-aaaa-bbbb-cccc-000000000048'::uuid,
    (select id from public.catalog_sets where slug = 'tu-vung-trai-cay-vi-en'),
    NULL,
    'Unpublish retired set'
  )$$,
  'Unpublish retired normal set succeeds'
);

select is((select count(*)::integer from public.flashcard_sets where user_id = '22222222-aaaa-bbbb-cccc-000000000048'), 1, 'User clone unchanged after catalog unpublish');

select * from finish();
rollback;
