import type { Metadata } from "next";

import {
  CollectionsList,
  type CollectionSummary,
} from "@/features/special-collections/components/collections-list";
import { CreateCollectionForm } from "@/features/special-collections/components/create-collection-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bộ đặc biệt" };

export default async function CollectionsPage() {
  const supabase = await createClient();
  const { data: collectionRows } = await supabase
    .from("special_collections")
    .select("id, name, special_collection_items(count)")
    .order("created_at", { ascending: false });

  const collections: CollectionSummary[] = (collectionRows ?? []).map((collection) => ({
    id: collection.id,
    name: collection.name,
    cardCount: collection.special_collection_items[0]?.count ?? 0,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Bộ đặc biệt</h1>
      <p className="mt-2 text-text-secondary">
        Gom thẻ từ nhiều bộ flashcard thành bộ học theo chủ đề của bạn.
      </p>

      <section
        aria-label="Tạo bộ đặc biệt"
        className="mt-6 rounded-2xl border border-border-soft bg-surface p-5"
      >
        <h2 className="font-semibold">Tạo bộ đặc biệt</h2>
        <div className="mt-3 max-w-sm">
          <CreateCollectionForm />
        </div>
      </section>

      <CollectionsList collections={collections} />
    </main>
  );
}
