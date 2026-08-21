-- LP-10 Part 2A: Admin Catalog Management V2
-- Forward-only migration. Preserves 21010000-21040000.
-- Security: SECURITY INVOKER SET search_path = '', EXECUTE granted only to service_role.

-- ============================================================
-- 1. Schema Extensions & Backfill for Durable Revision Tracking
-- ============================================================

ALTER TABLE public.catalog_sets
  ADD COLUMN IF NOT EXISTS published_revision_count integer NOT NULL DEFAULT 0 CHECK (published_revision_count >= 0),
  ADD COLUMN IF NOT EXISTS first_published_at timestamptz;

-- Safe backfill for existing rows
UPDATE public.catalog_sets
SET published_revision_count = CASE WHEN status = 'published' THEN version ELSE 0 END,
    first_published_at = CASE WHEN status = 'published' THEN coalesce(published_at, created_at) ELSE NULL END
WHERE published_revision_count = 0 AND status = 'published';

-- ============================================================
-- 2. Drop Obsolete Legacy Catalog Mutation RPC Signatures (NO CASCADE)
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_update_catalog_set(uuid, uuid, text, text, uuid, text, text, text, text[], boolean);
DROP FUNCTION IF EXISTS public.admin_publish_catalog_set(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.admin_unpublish_catalog_set(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.admin_archive_catalog_set(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.admin_replace_catalog_cards(uuid, uuid, jsonb, text);

-- ============================================================
-- 3. Create V2 Catalog Mutation RPC Contracts (SECURITY INVOKER)
-- ============================================================

-- 3a. admin_create_catalog_set
CREATE OR REPLACE FUNCTION public.admin_create_catalog_set(
  p_actor_user_id uuid,
  p_category_id uuid,
  p_slug text,
  p_title text,
  p_description text default null,
  p_language_front text default 'vi',
  p_language_back text default 'en',
  p_level text default null,
  p_tags text[] default '{}'
) RETURNS table(out_id uuid, out_slug text, out_status text, out_version integer, out_updated_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_new_id uuid;
  v_clean_slug text;
  v_clean_title text;
  v_now timestamptz := now();
BEGIN
  IF p_actor_user_id IS NULL OR NOT public.check_admin_permission(p_actor_user_id, 'catalog.write') THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'permission denied';
  END IF;
  IF p_category_id IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'category_id is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.catalog_categories WHERE id = p_category_id AND active = true) THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'active category not found';
  END IF;

  v_clean_slug := btrim(lower(coalesce(p_slug, '')));
  v_clean_title := btrim(coalesce(p_title, ''));
  IF v_clean_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'invalid slug format';
  END IF;
  IF char_length(v_clean_title) = 0 OR char_length(v_clean_title) > 120 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'title must be between 1 and 120 characters';
  END IF;

  INSERT INTO public.catalog_sets (
    category_id, slug, title, description, language_front, language_back,
    level, tags, status, version, published_revision_count, is_starter, starter_order,
    published_at, created_at, updated_at
  ) VALUES (
    p_category_id, v_clean_slug, v_clean_title, p_description,
    coalesce(nullif(btrim(p_language_front), ''), 'vi'),
    coalesce(nullif(btrim(p_language_back), ''), 'en'),
    p_level, coalesce(p_tags, '{}'), 'draft', 1, 0, false, null,
    null, v_now, v_now
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.admin_audit_logs (actor, action, target_type, target_id, reason, after_summary)
  VALUES (
    p_actor_user_id, 'catalog.create', 'catalog_set', v_new_id::text, 'Initial set creation',
    jsonb_build_object('title', v_clean_title, 'slug', v_clean_slug, 'category_id', p_category_id, 'status', 'draft')
  );

  RETURN QUERY SELECT v_new_id, v_clean_slug, 'draft'::text, 1, v_now;
END;
$$;

-- 3b. admin_update_catalog_set (Draft metadata & optional slug if never published)
CREATE OR REPLACE FUNCTION public.admin_update_catalog_set(
  p_actor_user_id uuid,
  p_catalog_set_id uuid,
  p_expected_updated_at timestamptz,
  p_title text,
  p_description text default null,
  p_category_id uuid default null,
  p_language_front text default null,
  p_language_back text default null,
  p_level text default null,
  p_tags text[] default null,
  p_slug text default null
) RETURNS table(out_id uuid, out_slug text, out_title text, out_version integer, out_status text, out_updated_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_old public.catalog_sets%rowtype;
  v_clean_title text;
  v_clean_slug text;
  v_new_slug text;
  v_now timestamptz := now();
BEGIN
  IF p_actor_user_id IS NULL OR NOT public.check_admin_permission(p_actor_user_id, 'catalog.write') THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'permission denied';
  END IF;
  IF p_catalog_set_id IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'catalog_set_id is required';
  END IF;

  SELECT * INTO v_old FROM public.catalog_sets WHERE id = p_catalog_set_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0002', message = 'catalog set not found';
  END IF;

  -- State machine: Only draft sets can be updated
  IF v_old.status = 'published' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'cannot mutate published catalog set; unpublish to draft first';
  END IF;
  IF v_old.status = 'archived' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'cannot mutate archived catalog set; restore to draft first';
  END IF;

  -- Optimistic concurrency check
  IF p_expected_updated_at IS NOT NULL AND v_old.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION USING errcode = 'P0004', message = 'catalog set has been modified by another admin; reload before saving';
  END IF;

  v_clean_title := btrim(coalesce(p_title, v_old.title));
  IF char_length(v_clean_title) = 0 OR char_length(v_clean_title) > 120 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'title must be between 1 and 120 characters';
  END IF;

  -- Slug update rule: allowed only if never published before
  IF p_slug IS NOT NULL AND btrim(p_slug) <> '' AND btrim(p_slug) <> v_old.slug THEN
    IF v_old.published_revision_count > 0 THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'cannot change slug of a set that has already been published';
    END IF;
    v_clean_slug := btrim(lower(p_slug));
    IF v_clean_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'invalid slug format';
    END IF;
    v_new_slug := v_clean_slug;
  ELSE
    v_new_slug := v_old.slug;
  END IF;

  IF p_category_id IS NOT NULL AND p_category_id <> v_old.category_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.catalog_categories WHERE id = p_category_id AND active = true) THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'active category not found';
    END IF;
  END IF;

  UPDATE public.catalog_sets SET
    title = v_clean_title,
    slug = v_new_slug,
    description = p_description,
    category_id = coalesce(p_category_id, v_old.category_id),
    language_front = coalesce(nullif(btrim(p_language_front), ''), v_old.language_front),
    language_back = coalesce(nullif(btrim(p_language_back), ''), v_old.language_back),
    level = p_level,
    tags = coalesce(p_tags, v_old.tags),
    updated_at = v_now
  WHERE id = p_catalog_set_id
  RETURNING id, slug, title, version, status, updated_at
  INTO out_id, out_slug, out_title, out_version, out_status, out_updated_at;

  INSERT INTO public.admin_audit_logs (actor, action, target_type, target_id, reason, before_summary, after_summary)
  VALUES (
    p_actor_user_id, 'catalog.update', 'catalog_set', p_catalog_set_id::text, 'Metadata update',
    jsonb_build_object('title', v_old.title, 'slug', v_old.slug, 'category_id', v_old.category_id),
    jsonb_build_object('title', out_title, 'slug', out_slug, 'category_id', coalesce(p_category_id, v_old.category_id))
  );

  RETURN NEXT;
END;
$$;

-- 3c. admin_replace_catalog_cards (Draft batch cards replace)
CREATE OR REPLACE FUNCTION public.admin_replace_catalog_cards(
  p_actor_user_id uuid,
  p_catalog_set_id uuid,
  p_expected_updated_at timestamptz,
  p_cards jsonb,
  p_reason text
) RETURNS table(out_card_count integer, out_updated_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_old public.catalog_sets%rowtype;
  v_old_count integer;
  v_new_count integer;
  v_reason text;
  v_now timestamptz := now();
BEGIN
  IF p_actor_user_id IS NULL OR NOT public.check_admin_permission(p_actor_user_id, 'catalog.write') THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'permission denied';
  END IF;
  IF p_catalog_set_id IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'catalog_set_id is required';
  END IF;

  v_reason := btrim(coalesce(p_reason, ''));
  IF char_length(v_reason) = 0 OR char_length(v_reason) > 500 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'reason is required (1-500 characters)';
  END IF;

  IF p_cards IS NULL OR jsonb_typeof(p_cards) <> 'array' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'cards must be a JSON array';
  END IF;
  v_new_count := jsonb_array_length(p_cards);
  IF v_new_count > 2000 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'cannot save more than 2000 cards via editor cap';
  END IF;

  SELECT * INTO v_old FROM public.catalog_sets WHERE id = p_catalog_set_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0002', message = 'catalog set not found';
  END IF;

  -- State machine: Only draft sets can have cards replaced
  IF v_old.status = 'published' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'cannot mutate published catalog set; unpublish to draft first';
  END IF;
  IF v_old.status = 'archived' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'cannot mutate archived catalog set; restore to draft first';
  END IF;

  -- Optimistic concurrency check
  IF p_expected_updated_at IS NOT NULL AND v_old.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION USING errcode = 'P0004', message = 'catalog set has been modified by another admin; reload before saving';
  END IF;

  SELECT count(*)::integer INTO v_old_count FROM public.catalog_cards WHERE catalog_set_id = p_catalog_set_id;
  DELETE FROM public.catalog_cards WHERE catalog_set_id = p_catalog_set_id;

  IF v_new_count > 0 THEN
    INSERT INTO public.catalog_cards (catalog_set_id, front, back, position)
    SELECT
      p_catalog_set_id,
      btrim(item->>'front'),
      btrim(item->>'back'),
      ord - 1
    FROM jsonb_array_elements(p_cards) WITH ORDINALITY AS t(item, ord);
  END IF;

  UPDATE public.catalog_sets SET updated_at = v_now WHERE id = p_catalog_set_id;

  INSERT INTO public.admin_audit_logs (actor, action, target_type, target_id, reason, before_summary, after_summary)
  VALUES (
    p_actor_user_id, 'catalog.cards.replace', 'catalog_set', p_catalog_set_id::text, v_reason,
    jsonb_build_object('old_card_count', v_old_count),
    jsonb_build_object('new_card_count', v_new_count)
  );

  RETURN QUERY SELECT v_new_count, v_now;
END;
$$;

-- 3d. admin_publish_catalog_set (Canonical First Publish vs Republish)
CREATE OR REPLACE FUNCTION public.admin_publish_catalog_set(
  p_actor_user_id uuid,
  p_catalog_set_id uuid,
  p_expected_updated_at timestamptz,
  p_reason text
) RETURNS table(out_id uuid, out_version integer, out_status text, out_published_at timestamptz, out_updated_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_old public.catalog_sets%rowtype;
  v_card_count integer;
  v_reason text;
  v_new_version integer;
  v_new_pub_count integer;
  v_now timestamptz := now();
BEGIN
  IF p_actor_user_id IS NULL OR NOT public.check_admin_permission(p_actor_user_id, 'catalog.publish') THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'permission denied';
  END IF;
  IF p_catalog_set_id IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'catalog_set_id is required';
  END IF;

  v_reason := btrim(coalesce(p_reason, ''));
  IF char_length(v_reason) = 0 OR char_length(v_reason) > 500 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'reason is required (1-500 characters)';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('catalog_starter_lock', 0));
  SELECT * INTO v_old FROM public.catalog_sets WHERE id = p_catalog_set_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0002', message = 'catalog set not found';
  END IF;

  -- Idempotency / No-op guard
  IF v_old.status = 'published' THEN
    RETURN QUERY SELECT v_old.id, v_old.version, v_old.status, v_old.published_at, v_old.updated_at;
    RETURN;
  END IF;

  -- State machine: Only draft sets can be published
  IF v_old.status = 'archived' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'cannot publish archived catalog set; restore to draft first';
  END IF;

  -- Optimistic concurrency check
  IF p_expected_updated_at IS NOT NULL AND v_old.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION USING errcode = 'P0004', message = 'catalog set has been modified by another admin; reload before saving';
  END IF;

  SELECT count(*)::integer INTO v_card_count FROM public.catalog_cards WHERE catalog_set_id = p_catalog_set_id;
  IF v_card_count = 0 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'cannot publish catalog set with 0 cards';
  END IF;

  IF v_old.is_starter = true THEN
    IF (SELECT count(*) FROM public.catalog_sets WHERE is_starter = true AND status = 'published' AND id <> p_catalog_set_id) >= 3 THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'cannot publish starter: already 3 published starters';
    END IF;
  END IF;

  -- Canonical LP-03 version rule:
  -- First publish: published_revision_count becomes 1, version = 1
  -- Republish: published_revision_count becomes N+1, version = N+1
  v_new_pub_count := v_old.published_revision_count + 1;
  v_new_version := v_new_pub_count;

  UPDATE public.catalog_sets SET
    status = 'published',
    version = v_new_version,
    published_revision_count = v_new_pub_count,
    published_at = v_now,
    first_published_at = coalesce(v_old.first_published_at, v_now),
    updated_at = v_now
  WHERE id = p_catalog_set_id
  RETURNING id, version, status, published_at, updated_at
  INTO out_id, out_version, out_status, out_published_at, out_updated_at;

  INSERT INTO public.admin_audit_logs (actor, action, target_type, target_id, reason, before_summary, after_summary)
  VALUES (
    p_actor_user_id, 'catalog.publish', 'catalog_set', p_catalog_set_id::text, v_reason,
    jsonb_build_object('status', v_old.status, 'version', v_old.version, 'published_revision_count', v_old.published_revision_count),
    jsonb_build_object('status', 'published', 'version', out_version, 'published_revision_count', v_new_pub_count)
  );

  RETURN NEXT;
END;
$$;

-- 3e. admin_unpublish_catalog_set
CREATE OR REPLACE FUNCTION public.admin_unpublish_catalog_set(
  p_actor_user_id uuid,
  p_catalog_set_id uuid,
  p_expected_updated_at timestamptz,
  p_reason text
) RETURNS table(out_id uuid, out_version integer, out_status text, out_updated_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_old public.catalog_sets%rowtype;
  v_reason text;
  v_now timestamptz := now();
BEGIN
  IF p_actor_user_id IS NULL OR NOT public.check_admin_permission(p_actor_user_id, 'catalog.publish') THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'permission denied';
  END IF;
  IF p_catalog_set_id IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'catalog_set_id is required';
  END IF;

  v_reason := btrim(coalesce(p_reason, ''));
  IF char_length(v_reason) = 0 OR char_length(v_reason) > 500 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'reason is required (1-500 characters)';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('catalog_starter_lock', 0));
  SELECT * INTO v_old FROM public.catalog_sets WHERE id = p_catalog_set_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0002', message = 'catalog set not found';
  END IF;

  -- Idempotency / No-op guard
  IF v_old.status = 'draft' THEN
    RETURN QUERY SELECT v_old.id, v_old.version, v_old.status, v_old.updated_at;
    RETURN;
  END IF;

  IF v_old.status = 'archived' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'cannot unpublish archived set; set is not published';
  END IF;

  -- Starter Invariant: cannot unpublish an active starter if it reduces published starter count below 3
  IF v_old.is_starter = true THEN
    IF (SELECT count(*) FROM public.catalog_sets WHERE is_starter = true AND status = 'published') <= 3 THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'cannot unpublish active starter: system requires 3 published starters (use admin_swap_starter_set)';
    END IF;
  END IF;

  -- Optimistic concurrency check
  IF p_expected_updated_at IS NOT NULL AND v_old.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION USING errcode = 'P0004', message = 'catalog set has been modified by another admin; reload before saving';
  END IF;

  UPDATE public.catalog_sets SET
    status = 'draft',
    published_at = null,
    updated_at = v_now
  WHERE id = p_catalog_set_id
  RETURNING id, version, status, updated_at INTO out_id, out_version, out_status, out_updated_at;

  INSERT INTO public.admin_audit_logs (actor, action, target_type, target_id, reason, before_summary, after_summary)
  VALUES (
    p_actor_user_id, 'catalog.unpublish', 'catalog_set', p_catalog_set_id::text, v_reason,
    jsonb_build_object('status', 'published', 'version', v_old.version),
    jsonb_build_object('status', 'draft', 'version', out_version)
  );

  RETURN NEXT;
END;
$$;

-- 3f. admin_archive_catalog_set
CREATE OR REPLACE FUNCTION public.admin_archive_catalog_set(
  p_actor_user_id uuid,
  p_catalog_set_id uuid,
  p_expected_updated_at timestamptz,
  p_reason text
) RETURNS table(out_id uuid, out_status text, out_updated_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_old public.catalog_sets%rowtype;
  v_reason text;
  v_now timestamptz := now();
BEGIN
  IF p_actor_user_id IS NULL OR NOT public.check_admin_permission(p_actor_user_id, 'catalog.publish') THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'permission denied';
  END IF;
  IF p_catalog_set_id IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'catalog_set_id is required';
  END IF;

  v_reason := btrim(coalesce(p_reason, ''));
  IF char_length(v_reason) = 0 OR char_length(v_reason) > 500 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'reason is required (1-500 characters)';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('catalog_starter_lock', 0));
  SELECT * INTO v_old FROM public.catalog_sets WHERE id = p_catalog_set_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0002', message = 'catalog set not found';
  END IF;

  -- Idempotency / No-op guard
  IF v_old.status = 'archived' THEN
    RETURN QUERY SELECT v_old.id, v_old.status, v_old.updated_at;
    RETURN;
  END IF;

  -- Starter Invariant check
  IF v_old.is_starter = true AND v_old.status = 'published' THEN
    IF (SELECT count(*) FROM public.catalog_sets WHERE is_starter = true AND status = 'published') <= 3 THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'cannot archive active starter: system requires 3 published starters (use admin_swap_starter_set)';
    END IF;
  END IF;

  -- Optimistic concurrency check
  IF p_expected_updated_at IS NOT NULL AND v_old.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION USING errcode = 'P0004', message = 'catalog set has been modified by another admin; reload before saving';
  END IF;

  UPDATE public.catalog_sets SET
    status = 'archived',
    published_at = null,
    is_starter = false,
    starter_order = null,
    updated_at = v_now
  WHERE id = p_catalog_set_id
  RETURNING id, status, updated_at INTO out_id, out_status, out_updated_at;

  INSERT INTO public.admin_audit_logs (actor, action, target_type, target_id, reason, before_summary, after_summary)
  VALUES (
    p_actor_user_id, 'catalog.archive', 'catalog_set', p_catalog_set_id::text, v_reason,
    jsonb_build_object('status', v_old.status, 'is_starter', v_old.is_starter),
    jsonb_build_object('status', 'archived', 'is_starter', false)
  );

  RETURN NEXT;
END;
$$;

-- 3g. admin_restore_catalog_set (Archived -> Draft)
CREATE OR REPLACE FUNCTION public.admin_restore_catalog_set(
  p_actor_user_id uuid,
  p_catalog_set_id uuid,
  p_expected_updated_at timestamptz,
  p_reason text
) RETURNS table(out_id uuid, out_status text, out_updated_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_old public.catalog_sets%rowtype;
  v_reason text;
  v_now timestamptz := now();
BEGIN
  IF p_actor_user_id IS NULL OR NOT public.check_admin_permission(p_actor_user_id, 'catalog.publish') THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'permission denied';
  END IF;
  IF p_catalog_set_id IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'catalog_set_id is required';
  END IF;

  v_reason := btrim(coalesce(p_reason, ''));
  IF char_length(v_reason) = 0 OR char_length(v_reason) > 500 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'reason is required (1-500 characters)';
  END IF;

  SELECT * INTO v_old FROM public.catalog_sets WHERE id = p_catalog_set_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0002', message = 'catalog set not found';
  END IF;

  -- Idempotency / No-op guard
  IF v_old.status = 'draft' THEN
    RETURN QUERY SELECT v_old.id, v_old.status, v_old.updated_at;
    RETURN;
  END IF;

  IF v_old.status <> 'archived' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'can only restore archived catalog sets';
  END IF;

  -- Optimistic concurrency check
  IF p_expected_updated_at IS NOT NULL AND v_old.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION USING errcode = 'P0004', message = 'catalog set has been modified by another admin; reload before saving';
  END IF;

  UPDATE public.catalog_sets SET
    status = 'draft',
    updated_at = v_now
  WHERE id = p_catalog_set_id
  RETURNING id, status, updated_at INTO out_id, out_status, out_updated_at;

  INSERT INTO public.admin_audit_logs (actor, action, target_type, target_id, reason, before_summary, after_summary)
  VALUES (
    p_actor_user_id, 'catalog.restore', 'catalog_set', p_catalog_set_id::text, v_reason,
    jsonb_build_object('status', 'archived'),
    jsonb_build_object('status', 'draft')
  );

  RETURN NEXT;
END;
$$;

-- 3h. admin_swap_starter_set (Atomic Replacement preserving exactly 3 published starters)
CREATE OR REPLACE FUNCTION public.admin_swap_starter_set(
  p_actor_user_id uuid,
  p_old_starter_set_id uuid,
  p_new_draft_set_id uuid,
  p_expected_updated_at_old timestamptz,
  p_expected_updated_at_new timestamptz,
  p_reason text
) RETURNS table(
  out_old_id uuid,
  out_new_id uuid,
  out_starter_order integer,
  out_new_version integer,
  out_updated_at_old timestamptz,
  out_updated_at_new timestamptz
)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_old public.catalog_sets%rowtype;
  v_new public.catalog_sets%rowtype;
  v_card_count integer;
  v_target_order integer;
  v_new_pub_count integer;
  v_new_version integer;
  v_reason text;
  v_first_id uuid;
  v_second_id uuid;
  v_now timestamptz := now();
BEGIN
  -- Dual permission requirement: catalog.write AND catalog.publish
  IF p_actor_user_id IS NULL
     OR NOT public.check_admin_permission(p_actor_user_id, 'catalog.write')
     OR NOT public.check_admin_permission(p_actor_user_id, 'catalog.publish') THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'permission denied: requires catalog.write and catalog.publish';
  END IF;

  IF p_old_starter_set_id IS NULL OR p_new_draft_set_id IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'both old and new set IDs are required';
  END IF;
  IF p_old_starter_set_id = p_new_draft_set_id THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'cannot swap a set with itself';
  END IF;

  v_reason := btrim(coalesce(p_reason, ''));
  IF char_length(v_reason) = 0 OR char_length(v_reason) > 500 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'reason is required (1-500 characters)';
  END IF;

  -- Global advisory lock to prevent concurrent starter mutations
  PERFORM pg_advisory_xact_lock(hashtextextended('catalog_starter_lock', 0));

  -- Deterministic row lock ordering by UUID to prevent deadlocks
  v_first_id := LEAST(p_old_starter_set_id, p_new_draft_set_id);
  v_second_id := GREATEST(p_old_starter_set_id, p_new_draft_set_id);

  PERFORM 1 FROM public.catalog_sets WHERE id = v_first_id FOR UPDATE;
  PERFORM 1 FROM public.catalog_sets WHERE id = v_second_id FOR UPDATE;

  SELECT * INTO v_old FROM public.catalog_sets WHERE id = p_old_starter_set_id;
  SELECT * INTO v_new FROM public.catalog_sets WHERE id = p_new_draft_set_id;

  IF v_old.id IS NULL OR v_new.id IS NULL THEN
    RAISE EXCEPTION USING errcode = 'P0002', message = 'one or both catalog sets not found';
  END IF;

  -- Validation for old starter
  IF v_old.status <> 'published' OR v_old.is_starter <> true OR v_old.starter_order IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'old set must be an active published starter';
  END IF;

  -- Validation for new draft
  IF v_new.status <> 'draft' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'new set must be in draft status';
  END IF;
  IF v_new.is_starter = true THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'new set must not already be a starter';
  END IF;

  -- Optimistic concurrency checks for both rows
  IF p_expected_updated_at_old IS NOT NULL AND v_old.updated_at <> p_expected_updated_at_old THEN
    RAISE EXCEPTION USING errcode = 'P0004', message = 'old starter set has been modified by another admin; reload before saving';
  END IF;
  IF p_expected_updated_at_new IS NOT NULL AND v_new.updated_at <> p_expected_updated_at_new THEN
    RAISE EXCEPTION USING errcode = 'P0004', message = 'new draft set has been modified by another admin; reload before saving';
  END IF;

  -- Validation for cards
  SELECT count(*)::integer INTO v_card_count FROM public.catalog_cards WHERE catalog_set_id = p_new_draft_set_id;
  IF v_card_count = 0 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'cannot publish starter replacement set with 0 cards';
  END IF;

  v_target_order := v_old.starter_order;
  v_new_pub_count := v_new.published_revision_count + 1;
  v_new_version := v_new_pub_count;

  -- Step 1: Retire old starter (status remains published as regular set, starter flag cleared)
  UPDATE public.catalog_sets SET
    is_starter = false,
    starter_order = null,
    updated_at = v_now
  WHERE id = p_old_starter_set_id
  RETURNING updated_at INTO out_updated_at_old;

  -- Step 2: Promote new draft to published starter taking the exact starter_order
  UPDATE public.catalog_sets SET
    is_starter = true,
    starter_order = v_target_order,
    status = 'published',
    version = v_new_version,
    published_revision_count = v_new_pub_count,
    published_at = v_now,
    first_published_at = coalesce(v_new.first_published_at, v_now),
    updated_at = v_now
  WHERE id = p_new_draft_set_id
  RETURNING updated_at INTO out_updated_at_new;

  out_old_id := p_old_starter_set_id;
  out_new_id := p_new_draft_set_id;
  out_starter_order := v_target_order;
  out_new_version := v_new_version;

  -- Step 3: Single comprehensive audit entry
  INSERT INTO public.admin_audit_logs (actor, action, target_type, target_id, reason, before_summary, after_summary)
  VALUES (
    p_actor_user_id, 'catalog.starter.swap', 'catalog_set', p_new_draft_set_id::text, v_reason,
    jsonb_build_object(
      'old_starter_id', p_old_starter_set_id,
      'old_starter_order', v_target_order,
      'old_status', 'published',
      'new_draft_id', p_new_draft_set_id,
      'new_draft_status', 'draft'
    ),
    jsonb_build_object(
      'retired_old_starter_id', p_old_starter_set_id,
      'retired_old_is_starter', false,
      'promoted_new_starter_id', p_new_draft_set_id,
      'promoted_new_starter_order', v_target_order,
      'promoted_new_status', 'published',
      'promoted_new_version', v_new_version
    )
  );

  RETURN NEXT;
END;
$$;

-- ============================================================
-- 4. Execution Privileges: Revoke Browser, Grant ONLY service_role
-- ============================================================

REVOKE ALL ON FUNCTION public.admin_create_catalog_set(uuid, uuid, text, text, text, text, text, text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_catalog_set(uuid, uuid, text, text, text, text, text, text, text[]) TO service_role;

REVOKE ALL ON FUNCTION public.admin_update_catalog_set(uuid, uuid, timestamptz, text, text, uuid, text, text, text, text[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_catalog_set(uuid, uuid, timestamptz, text, text, uuid, text, text, text, text[], text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_replace_catalog_cards(uuid, uuid, timestamptz, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_replace_catalog_cards(uuid, uuid, timestamptz, jsonb, text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_publish_catalog_set(uuid, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_catalog_set(uuid, uuid, timestamptz, text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_unpublish_catalog_set(uuid, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unpublish_catalog_set(uuid, uuid, timestamptz, text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_archive_catalog_set(uuid, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_archive_catalog_set(uuid, uuid, timestamptz, text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_restore_catalog_set(uuid, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_catalog_set(uuid, uuid, timestamptz, text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_swap_starter_set(uuid, uuid, uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_swap_starter_set(uuid, uuid, uuid, timestamptz, timestamptz, text) TO service_role;
