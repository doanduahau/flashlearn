import "server-only";

import { requireAdminPermission } from "@/features/admin/server/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminCatalogSetDetail = {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  slug: string;
  title: string;
  description: string | null;
  languageFront: string;
  languageBack: string;
  level: string | null;
  tags: string[];
  status: "draft" | "published" | "archived";
  version: number;
  publishedRevisionCount: number;
  isStarter: boolean;
  starterOrder: number | null;
  publishedAt: string | null;
  firstPublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  cards: Array<{
    id: string;
    front: string;
    back: string;
    position: number;
  }>;
  cardCount: number;
  exceedsEditorCap: boolean;
};

export type AdminCatalogCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
};

export async function getAdminCatalogSetDetail(
  setId: string,
): Promise<AdminCatalogSetDetail | null> {
  await requireAdminPermission("catalog.read");
  const adminClient = createAdminClient();

  const { data: setData, error: setError } = await adminClient
    .from("catalog_sets")
    .select(
      `
      id,
      category_id,
      slug,
      title,
      description,
      language_front,
      language_back,
      level,
      tags,
      status,
      version,
      published_revision_count,
      is_starter,
      starter_order,
      published_at,
      first_published_at,
      created_at,
      updated_at,
      catalog_categories (
        name,
        slug
      )
    `,
    )
    .eq("id", setId)
    .single();

  if (setError || !setData) {
    return null;
  }

  // Count total cards
  const { count: totalCards } = await adminClient
    .from("catalog_cards")
    .select("id", { count: "exact", head: true })
    .eq("catalog_set_id", setId);

  const cardCount = totalCards ?? 0;
  const exceedsEditorCap = cardCount > 2000;

  // Bounded card retrieval
  const { data: cardsData, error: cardsError } = await adminClient
    .from("catalog_cards")
    .select("id, front, back, position")
    .eq("catalog_set_id", setId)
    .order("position", { ascending: true })
    .limit(2001);

  if (cardsError) {
    throw new Error(`Failed to load catalog cards: ${cardsError.message}`);
  }

  const category = Array.isArray(setData.catalog_categories)
    ? setData.catalog_categories[0]
    : setData.catalog_categories;

  return {
    id: setData.id,
    categoryId: setData.category_id,
    categoryName: category?.name ?? "Không phân loại",
    categorySlug: category?.slug ?? "uncategorized",
    slug: setData.slug,
    title: setData.title,
    description: setData.description,
    languageFront: setData.language_front,
    languageBack: setData.language_back,
    level: setData.level,
    tags: Array.isArray(setData.tags) ? setData.tags : [],
    status: setData.status as "draft" | "published" | "archived",
    version: setData.version,
    publishedRevisionCount: setData.published_revision_count ?? 0,
    isStarter: setData.is_starter,
    starterOrder: setData.starter_order,
    publishedAt: setData.published_at,
    firstPublishedAt: setData.first_published_at,
    createdAt: setData.created_at,
    updatedAt: setData.updated_at,
    cards: (cardsData ?? []).slice(0, 2000).map((c) => ({
      id: c.id,
      front: c.front,
      back: c.back,
      position: c.position,
    })),
    cardCount,
    exceedsEditorCap,
  };
}

export async function getAdminCatalogCategories(): Promise<AdminCatalogCategory[]> {
  await requireAdminPermission("catalog.read");
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("catalog_categories")
    .select("id, slug, name, description")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data;
}

export async function getActivePublishedStarters(): Promise<
  Array<{ id: string; title: string; slug: string; starterOrder: number; updatedAt: string }>
> {
  await requireAdminPermission("catalog.read");
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("catalog_sets")
    .select("id, title, slug, starter_order, updated_at")
    .eq("is_starter", true)
    .eq("status", "published")
    .order("starter_order", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((d) => ({
    id: d.id,
    title: d.title,
    slug: d.slug,
    starterOrder: d.starter_order!,
    updatedAt: d.updated_at,
  }));
}
