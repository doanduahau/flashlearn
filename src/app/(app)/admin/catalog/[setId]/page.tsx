import { notFound, redirect } from "next/navigation";

import { CatalogDetailManager } from "@/features/admin/components/catalog/catalog-detail-manager";
import {
  getActivePublishedStarters,
  getAdminCatalogCategories,
  getAdminCatalogSetDetail,
} from "@/features/admin/server/admin-catalog-queries";
import {
  AdminAuthorizationError,
  hasAdminPermission,
  requireAdminPermission,
} from "@/features/admin/server/authorization";
import { getFeatureFlags } from "@/lib/telemetry/feature-flags";

export const dynamic = "force-dynamic";

export default async function AdminCatalogDetailPage({
  params,
}: Readonly<{
  params: Promise<{
    setId: string;
  }>;
}>) {
  try {
    await requireAdminPermission("catalog.read");
  } catch (error) {
    if (error instanceof AdminAuthorizationError) redirect("/admin");
    throw error;
  }

  const { setId } = await params;
  const catalogSet = await getAdminCatalogSetDetail(setId);

  if (!catalogSet) {
    notFound();
  }

  const categories = await getAdminCatalogCategories();
  const activeStarters = await getActivePublishedStarters();
  const canWrite = await hasAdminPermission("catalog.write");
  const canPublish = await hasAdminPermission("catalog.publish");
  const mutationsEnabled = getFeatureFlags().adminCatalogMutationsEnabled;

  return (
    <CatalogDetailManager
      catalogSet={catalogSet}
      categories={categories}
      activeStarters={activeStarters}
      canWrite={canWrite}
      canPublish={canPublish}
      mutationsEnabled={mutationsEnabled}
    />
  );
}
