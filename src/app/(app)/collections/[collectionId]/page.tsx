import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { BackButton } from "@/components/shared/back-button";
import { MasteryCardContent } from "@/features/mastery/components/mastery-card-content";
import { MasteryCounts } from "@/features/mastery/components/mastery-counts";
import { MasteryLegend } from "@/features/mastery/components/mastery-legend";
import { masteryCardClassName } from "@/features/mastery/presentation/mastery-presentation";
import { loadCardMasteries } from "@/features/mastery/server/load-card-masteries";
import { loadMasteryAggregate } from "@/features/mastery/server/load-mastery-aggregate";
import type { ActiveFlashcardMastery, MasteryStatus } from "@/features/mastery/types/mastery-types";
import { DeleteCollectionButton } from "@/features/special-collections/components/delete-collection-button";
import { RemoveCollectionItemButton } from "@/features/special-collections/components/remove-collection-item-button";
import { RenameCollectionForm } from "@/features/special-collections/components/rename-collection-form";
import { loadMascotLevel } from "@/features/mascot/server/load-mascot-level";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { COLLECTION_CARDS_PAGE_SIZE } from "@/lib/constants";
import { pageHref, parsePage, type RouteSearchParams } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Chi tiết bộ đặc biệt" };

export default async function CollectionDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ collectionId: string }>;
  searchParams: Promise<RouteSearchParams>;
}>) {
  const { collectionId } = await params;
  const raw = await searchParams;
  const requestedPage = parsePage(raw.page);

  const supabase = await createClient();
  const mascotLevel = await loadMascotLevel(supabase);
  const { data: collection } = await supabase
    .from("special_collections")
    .select("id, name")
    .eq("id", collectionId)
    .maybeSingle();
  if (!collection) notFound();

  const { count: total } = await supabase
    .from("special_collection_items")
    .select("collection_id", { count: "exact", head: true })
    .eq("collection_id", collectionId);

  const totalCount = total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / COLLECTION_CARDS_PAGE_SIZE));
  const page = Math.max(1, Math.min(requestedPage, totalPages));
  const from = (page - 1) * COLLECTION_CARDS_PAGE_SIZE;
  const to = from + COLLECTION_CARDS_PAGE_SIZE - 1;

  const { data: items } = await supabase
    .from("special_collection_items")
    .select("flashcard_id, flashcards(id, front, back, set_id, flashcard_sets(name))")
    .eq("collection_id", collectionId)
    .order("created_at", { ascending: false })
    .range(from, to);

  const cardIds = (items ?? [])
    .map((item) => item.flashcards?.id)
    .filter((id): id is string => typeof id === "string");
  const [masteries, collectionAggregate] = await Promise.all([
    cardIds.length
      ? loadCardMasteries(supabase, cardIds)
      : Promise.resolve([] as ActiveFlashcardMastery[]),
    loadMasteryAggregate(supabase, { type: "collection", collectionId }),
  ]);
  const masteryByCard = new Map<string, MasteryStatus>();
  for (const mastery of masteries) {
    masteryByCard.set(mastery.flashcardId, mastery.status);
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <BackButton fallbackHref="/sets/library?tab=special" />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{collection.name}</h1>
          <p className="mt-2 text-text-secondary">{totalCount} thẻ</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RenameCollectionForm collectionId={collection.id} initialName={collection.name} />
          <DeleteCollectionButton collectionId={collection.id} />
        </div>
      </div>

      <section aria-label="Danh sách thẻ" className="mt-6">
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <MasteryCounts aggregate={collectionAggregate} />
          {items?.length ? <MasteryLegend /> : null}
        </div>
        {totalCount === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border-soft bg-surface-subtle p-8 text-center">
            <MascotImage
              level={mascotLevel}
              state="thinking"
              size={48}
              className="mx-auto mb-2 size-12 object-contain"
            />
            <p className="font-medium">Bộ đặc biệt này chưa có thẻ nào.</p>
            <p className="mt-1 text-sm text-text-secondary">
              Mở một bộ flashcard và thêm thẻ vào bộ đặc biệt này.
            </p>
          </div>
        ) : items?.length ? (
          <ol className="mt-4 grid gap-3">
            {items.map((item) => {
              const card = item.flashcards;
              if (!card) return null;
              const status = masteryByCard.get(card.id) ?? "untested";
              return (
                <li key={card.id} className={masteryCardClassName(status)}>
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <MasteryCardContent
                      status={status}
                      badge={card.flashcard_sets?.name ?? "Bộ flashcard"}
                      front={card.front}
                      back={card.back}
                    />
                    <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-1 self-end sm:self-auto">
                      <RemoveCollectionItemButton collectionId={collection.id} cardId={card.id} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border-soft bg-surface-subtle p-8 text-center">
            <p className="font-medium">Không tìm thấy thẻ.</p>
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
