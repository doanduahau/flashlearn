import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { BackButton } from "@/components/shared/back-button";
import { MasteryCardContent } from "@/features/mastery/components/mastery-card-content";
import { MasteryCounts } from "@/features/mastery/components/mastery-counts";
import { MasteryLegend } from "@/features/mastery/components/mastery-legend";
import { masteryCardClassName } from "@/features/mastery/presentation/mastery-presentation";
import { loadCardMasteries } from "@/features/mastery/server/load-card-masteries";
import { loadMasteryAggregate } from "@/features/mastery/server/load-mastery-aggregate";
import type { MasteryAggregate } from "@/features/mastery/utils/aggregate-mastery";
import type { ActiveFlashcardMastery, MasteryStatus } from "@/features/mastery/types/mastery-types";
import { AddCardForm } from "@/features/flashcard-sets/components/add-card-form";
import { CardSearchForm } from "@/features/flashcard-sets/components/card-search-form";
import { DeleteCardButton } from "@/features/flashcard-sets/components/delete-card-button";
import { DeleteSetButton } from "@/features/flashcard-sets/components/delete-set-button";
import { EditCardForm } from "@/features/flashcard-sets/components/edit-card-form";
import { RenameSetForm } from "@/features/flashcard-sets/components/rename-set-form";
import { sanitizeSearchQuery } from "@/features/flashcard-sets/utils/search";
import { CardCollectionsControl } from "@/features/special-collections/components/card-collections-control";
import { loadMascotLevel } from "@/features/mascot/server/load-mascot-level";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SET_CARDS_PAGE_SIZE } from "@/lib/constants";
import { pageHref, parsePage, type RouteSearchParams } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Chi tiết bộ flashcard" };

export default async function SetDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ setId: string }>;
  searchParams: Promise<RouteSearchParams>;
}>) {
  const { setId } = await params;
  const raw = await searchParams;
  const query = sanitizeSearchQuery(typeof raw.q === "string" ? raw.q : "");
  const requestedPage = parsePage(raw.page);

  const supabase = await createClient();
  const mascotLevel = await loadMascotLevel(supabase);
  const { data: set } = await supabase
    .from("flashcard_sets")
    .select("id, name")
    .eq("id", setId)
    .maybeSingle();
  if (!set) notFound();

  const searchFilter = query ? `front.ilike.%${query}%,back.ilike.%${query}%` : null;
  const [totalResult, visibleCountResult, setAggregateResult] = await Promise.all([
    supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("set_id", setId),
    searchFilter
      ? supabase
          .from("flashcards")
          .select("id", { count: "exact", head: true })
          .eq("set_id", setId)
          .or(searchFilter)
      : Promise.resolve({ count: 0 }),
    loadMasteryAggregate(supabase, { type: "set", setId }),
  ]);
  const setAggregate: MasteryAggregate = setAggregateResult;

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
  const [collectionsResult, membershipsResult, masteriesResult] = await Promise.all([
    supabase.from("special_collections").select("id, name").order("name", { ascending: true }),
    cardIds.length
      ? supabase
          .from("special_collection_items")
          .select("collection_id, flashcard_id")
          .in("flashcard_id", cardIds)
      : Promise.resolve({ data: [] as { collection_id: string; flashcard_id: string }[] }),
    cardIds.length
      ? loadCardMasteries(supabase, cardIds)
      : Promise.resolve([] as ActiveFlashcardMastery[]),
  ]);

  const collections = (collectionsResult.data ?? []).map((collection) => ({
    id: collection.id,
    name: collection.name,
  }));
  const membershipsByCard: Record<string, string[]> = {};
  for (const item of membershipsResult.data ?? []) {
    (membershipsByCard[item.flashcard_id] ??= []).push(item.collection_id);
  }
  const masteryByCard = new Map<string, MasteryStatus>();
  for (const mastery of masteriesResult) {
    masteryByCard.set(mastery.flashcardId, mastery.status);
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <BackButton fallbackHref="/sets/library?tab=regular" />
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
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <CardSearchForm defaultValue={query} />
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            <MasteryCounts aggregate={setAggregate} />
            {cards?.length ? <MasteryLegend /> : null}
          </div>
        </div>
        {searchFilter ? (
          <p className="mt-2 text-sm text-text-secondary">Tìm thấy {visibleTotal} thẻ phù hợp.</p>
        ) : null}
        {total === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border-soft bg-surface-subtle p-8 text-center">
            <MascotImage
              level={mascotLevel}
              state="thinking"
              size={64}
              className="mx-auto mb-2 size-16 object-contain"
            />
            <p className="font-medium">Bộ này chưa có thẻ nào.</p>
            <p className="mt-1 text-sm text-text-secondary">Thêm thẻ đầu tiên ở phần trên.</p>
          </div>
        ) : cards?.length ? (
          <ol className="mt-4 grid gap-3">
            {cards.map((card) => {
              const status = masteryByCard.get(card.id) ?? "untested";
              return (
                <li key={card.id} className={masteryCardClassName(status)}>
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <MasteryCardContent
                      status={status}
                      badge={`#${card.position + 1}`}
                      front={card.front}
                      back={card.back}
                    />
                    <div className="flex shrink-0 items-center gap-1 self-start sm:self-auto">
                      <EditCardForm
                        setId={set.id}
                        cardId={card.id}
                        initialFront={card.front}
                        initialBack={card.back}
                      />
                      <DeleteCardButton setId={set.id} cardId={card.id} />
                      <CardCollectionsControl
                        cardId={card.id}
                        setId={set.id}
                        collections={collections}
                        memberships={membershipsByCard[card.id] ?? []}
                        variant="icon"
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border-soft bg-surface-subtle p-8 text-center">
            <p className="font-medium">Không tìm thấy thẻ phù hợp.</p>
          </div>
        )}

        {totalPages > 1 ? (
          <PaginationControls
            page={page}
            totalPages={totalPages}
            pageHref={(targetPage) => pageHref(raw, targetPage)}
          />
        ) : null}
      </section>
    </main>
  );
}
