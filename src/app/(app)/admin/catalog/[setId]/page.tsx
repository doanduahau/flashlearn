import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import {
  AdminAuthorizationError,
  requireAdminPermission,
} from "@/features/admin/server/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { CatalogDetailClient } from "./catalog-detail-client";

export const dynamic = "force-dynamic";

export default async function AdminCatalogDetailPage({
  params,
}: Readonly<{ params: Promise<{ setId: string }> }>) {
  try {
    await requireAdminPermission("catalog.read");
  } catch (error) {
    if (error instanceof AdminAuthorizationError) redirect("/admin");
    throw error;
  }

  const { setId } = await params;
  const admin = createAdminClient();

  const { data: set, error: setError } = await admin
    .from("catalog_sets")
    .select("*")
    .eq("id", setId)
    .single();

  if (setError || !set) notFound();

  const { data: cards } = await admin
    .from("catalog_cards")
    .select("id, front, back, position")
    .eq("catalog_set_id", setId)
    .order("position", { ascending: true });

  const { count: installCount } = await admin
    .from("user_catalog_installs")
    .select("id", { count: "exact", head: true })
    .eq("catalog_set_id", setId)
    .eq("status", "active");

  const { data: categories } = await admin
    .from("catalog_categories")
    .select("id, name, slug")
    .order("name");

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex items-center gap-2 text-sm text-text-secondary">
        <Link href="/admin/catalog" className="hover:text-text-primary">
          Thư viện
        </Link>
        <span>/</span>
        <span className="text-text-primary font-medium">{set.title}</span>
      </nav>

      <CatalogDetailClient
        set={set}
        cards={cards ?? []}
        installCount={installCount ?? 0}
        categories={categories ?? []}
      />
    </div>
  );
}
