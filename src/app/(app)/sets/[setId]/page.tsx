import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AddCardForm } from "@/features/flashcard-sets/components/add-card-form";
import { CardSearchForm } from "@/features/flashcard-sets/components/card-search-form";
import { DeleteCardButton } from "@/features/flashcard-sets/components/delete-card-button";
import { DeleteSetButton } from "@/features/flashcard-sets/components/delete-set-button";
import { EditCardForm } from "@/features/flashcard-sets/components/edit-card-form";
import { RenameSetForm } from "@/features/flashcard-sets/components/rename-set-form";
import { sanitizeSearchQuery } from "@/features/flashcard-sets/utils/search";
import { CardCollectionsControl } from "@/features/special-collections/components/card-collections-control";
import { SET_CARDS_PAGE_SIZE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Chi tiết bộ flashcard" };

export default async function SetDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ setId: string }>;
  searchParams: Promise<{ page?: string | string[]; q?: string | string[] }>;
}>) {
  const { setId } = await params;
  const raw = await searchParams;
  const query = sanitizeSearchQuery(typeof raw.q === "string" ? raw.q : "");
  const requestedPage = Number.parseInt(typeof raw.page === "string" ? raw.page : "1", 10) || 1;

  const supabase = await createClient();
  const { data: set } = await supabase
    .from("flashcard_sets")
    .select("id, name")
    .eq("id", setId)
    .maybeSingle();
  if (!set) notFound();

  const searchFilter = query ? `front.ilike.%${query}%,back.ilike.%${query}%` : null;
  const [totalResult, visibleCountResult] = await Promise.all([
    supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("set_id", setId),
    searchFilter
      ? supabase
          .from("flashcards")
          .select("id", { count: "exact", head: true })
          .eq("set_id", setId)
          .or(searchFilter)
      : Promise.resolve({ count: 0 }),
  ]);

  const total = totalResult.count ?? 0;
  const visibleTotal = searchFilter ? (visibleCountResult.count ?? 0) : total;
  const totalPages = Math.max(1, Math.ceil(visibleTotal / SET_CARDS_PAGE_SIZE));
  const page = Math.max(1, Math.min(requestedPage, totalPages));
  const from = (page - 1) * SET_CARDS_PAGE_SIZE;
  const to = from + SET_CARDS_PAGE_SIZE - 1;

  let listQuery = supabase
    .from("flashcards")
    .select("id, front, back, position")
    .eq("set_id", setId)
    .order("position", { ascending: true })
    .range(from, to);
  if (searchFilter) {
    listQuery = listQuery.or(searchFilter);
  }
  const { data: cards } = await listQuery;

  const cardIds = (cards ?? []).map((card) => card.id);
  const [collectionsResult, membershipsResult] = await Promise.all([
    supabase.from("special_collections").select("id, name").order("name", { ascending: true }),
    cardIds.length
      ? supabase
          .from("special_collection_items")
          .select("collection_id, flashcard_id")
          .in("flashcard_id", cardIds)
      : Promise.resolve({ data: [] as { collection_id: string; flashcard_id: string }[] }),
  ]);

  const collections = (collectionsResult.data ?? []).map((collection) => ({
    id: collection.id,
    name: collection.name,
  }));
  const membershipsByCard: Record<string, string[]> = {};
  for (const item of membershipsResult.data ?? []) {
    (membershipsByCard[item.flashcard_id] ??= []).push(item.collection_id);
  }

  function pageHref(target: number): string {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (target > 1) params.set("page", String(target));
    const search = params.toString();
    return search ? `?${search}` : "";
  }

  const navLinkClass =
    "inline-flex h-10 items-center justify-center rounded-xl border border-border-soft bg-surface px-4 text-sm font-medium hover:bg-surface-subtle disabled:pointer-events-none disabled:opacity-50";

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <Link href="/sets" className="text-sm text-text-secondary hover:text-text-primary">
        ← Tất cả bộ flashcard
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{set.name}</h1>
          <p className="mt-2 text-text-secondary">{total} flashcard</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RenameSetForm setId={set.id} initialName={set.name} />
          <DeleteSetButton setId={set.id} />
        </div>
      </div>

      <section
        aria-label="Thêm flashcard"
        className="mt-6 rounded-2xl border border-border-soft bg-surface p-5"
      >
        <h2 className="font-semibold">Thêm flashcard</h2>
        <div className="mt-3">
          <AddCardForm setId={set.id} />
        </div>
      </section>

      <section aria-label="Danh sách flashcard" className="mt-6">
        <CardSearchForm defaultValue={query} />
        {searchFilter ? (
          <p className="mt-2 text-sm text-text-secondary">Tìm thấy {visibleTotal} thẻ phù hợp.</p>
        ) : null}
        {total === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border-soft bg-surface-subtle p-8 text-center">
            <p className="font-medium">Bộ này chưa có thẻ nào.</p>
            <p className="mt-1 text-sm text-text-secondary">Thêm thẻ đầu tiên ở phần trên.</p>
          </div>
        ) : cards?.length ? (
          <ol className="mt-4 grid gap-3">
            {cards.map((card) => (
              <li
                key={card.id}
                className="rounded-2xl border border-border-soft bg-surface p-4 sm:p-5"
              >
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1 max-w-full">
                    <p className="text-sm font-medium text-text-secondary">#{card.position + 1}</p>
                    <p className="mt-1 max-w-full whitespace-pre-wrap break-words font-semibold [overflow-wrap:anywhere]">
                      {card.front}
                    </p>
                    <p className="mt-2 max-w-full whitespace-pre-wrap break-words text-text-secondary [overflow-wrap:anywhere]">
                      {card.back}
                    </p>
                  </div>
                  <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-1 self-end sm:self-auto">
                    <CardCollectionsControl
                      cardId={card.id}
                      setId={set.id}
                      collections={collections}
                      memberships={membershipsByCard[card.id] ?? []}
                      variant="responsive"
                    />
                    <EditCardForm
                      setId={set.id}
                      cardId={card.id}
                      initialFront={card.front}
                      initialBack={card.back}
                    />
                    <DeleteCardButton setId={set.id} cardId={card.id} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border-soft bg-surface-subtle p-8 text-center">
            <p className="font-medium">Không tìm thấy thẻ phù hợp.</p>
          </div>
        )}

        {totalPages > 1 ? (
          <nav aria-label="Phân trang" className="mt-6 flex items-center justify-center gap-3">
            <Link
              href={pageHref(page - 1)}
              className={navLinkClass}
              aria-disabled={page <= 1}
              tabIndex={page <= 1 ? -1 : undefined}
            >
              Trước
            </Link>
            <span className="text-sm text-text-secondary">
              Trang {page} / {totalPages}
            </span>
            <Link
              href={pageHref(page + 1)}
              className={navLinkClass}
              aria-disabled={page >= totalPages}
              tabIndex={page >= totalPages ? -1 : undefined}
            >
              Sau
            </Link>
          </nav>
        ) : null}
      </section>
    </main>
  );
}
