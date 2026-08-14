import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeSearchQuery } from "@/features/flashcard-sets/utils/search";
import type {
  SourceOption,
  SourcePage,
  SourceType,
} from "@/features/source-selection/types/source-types";
import { SOURCE_PAGE_SIZE } from "@/lib/constants";
import type { Database } from "@/lib/supabase/types";

type Supabase = SupabaseClient<Database>;

export function sourceType(value: string | string[] | undefined): SourceType {
  return value === "regular" || value === "special" ? value : "all";
}

export async function loadSourcePage(
  supabase: Supabase,
  input: Readonly<{ page: number; query: string; type: SourceType }>,
): Promise<SourcePage> {
  const query = sanitizeSearchQuery(input.query);
  const page = Math.max(1, input.page);
  const from = (page - 1) * SOURCE_PAGE_SIZE;
  const to = from + SOURCE_PAGE_SIZE - 1;

  const regularRequest =
    input.type === "special" ? null : sourceQuery(supabase, "regular", query, from, to);
  const specialRequest =
    input.type === "regular" ? null : sourceQuery(supabase, "special", query, from, to);
  const [regularResult, specialResult] = await Promise.all([regularRequest, specialRequest]);

  const regular = regularResult ?? { sources: [], count: 0 };
  const special = specialResult ?? { sources: [], count: 0 };
  const totalPages = Math.max(
    1,
    Math.ceil((regular.count ?? 0) / SOURCE_PAGE_SIZE),
    Math.ceil((special.count ?? 0) / SOURCE_PAGE_SIZE),
  );

  if (page > totalPages) return loadSourcePage(supabase, { ...input, page: totalPages });

  return {
    sources: [...regular.sources, ...special.sources],
    page,
    totalPages,
    query,
    type: input.type,
  };
}

async function sourceQuery(
  supabase: Supabase,
  kind: "regular" | "special",
  query: string,
  from: number,
  to: number,
): Promise<{ sources: SourceOption[]; count: number | null }> {
  if (kind === "regular") {
    let request = supabase
      .from("flashcard_sets")
      .select("id, name, flashcards(count)", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to);
    if (query) request = request.ilike("name", `%${query}%`);
    const { data, count } = await request;
    return {
      count,
      sources: (data ?? []).map((source) => ({
        id: source.id,
        kind,
        name: source.name,
        cardCount: source.flashcards[0]?.count ?? 0,
      })),
    };
  }

  let request = supabase
    .from("special_collections")
    .select("id, name, special_collection_items(count)", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to);
  if (query) request = request.ilike("name", `%${query}%`);
  const { data, count } = await request;
  return {
    count,
    sources: (data ?? []).map((source) => ({
      id: source.id,
      kind,
      name: source.name,
      cardCount: source.special_collection_items[0]?.count ?? 0,
    })),
  };
}
