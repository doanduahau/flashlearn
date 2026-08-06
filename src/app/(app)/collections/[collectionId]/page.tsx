import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { DeleteCollectionButton } from "@/features/special-collections/components/delete-collection-button";
import { RemoveCollectionItemButton } from "@/features/special-collections/components/remove-collection-item-button";
import { RenameCollectionForm } from "@/features/special-collections/components/rename-collection-form";
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

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <Link href="/collections" className="text-sm text-text-secondary hover:text-text-primary">
        ← Tất cả bộ đặc biệt
      </Link>
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
        {totalCount === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border-soft bg-surface-subtle p-8 text-center">
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
              return (
                <li
                  key={card.id}
                  className="rounded-2xl border border-border-soft bg-surface p-4 sm:p-5"
                >
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1 max-w-full">
                      <p className="text-sm font-medium text-text-secondary">
                        {card.flashcard_sets?.name ?? "Bộ flashcard"}
                      </p>
                      <p className="mt-1 max-w-full whitespace-pre-wrap break-words font-semibold [overflow-wrap:anywhere]">
                        {card.front}
                      </p>
                      <p className="mt-2 max-w-full whitespace-pre-wrap break-words text-text-secondary [overflow-wrap:anywhere]">
                        {card.back}
                      </p>
                    </div>
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
