import { notFound, redirect } from "next/navigation";

import { UserDetailManager } from "@/features/admin/components/users/user-detail-manager";
import { getAdminUserDetail } from "@/features/admin/server/admin-user-queries";
import {
  AdminAuthorizationError,
  getCurrentAdminRoles,
  requireAdminPermission,
} from "@/features/admin/server/authorization";
import { createClient } from "@/lib/supabase/server";
import { getFeatureFlags } from "@/lib/telemetry/feature-flags";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: Readonly<{
  params: Promise<{
    userId: string;
  }>;
}>) {
  try {
    await requireAdminPermission("users.read");
  } catch (error) {
    if (error instanceof AdminAuthorizationError) redirect("/admin");
    throw error;
  }

  const { userId } = await params;
  const userDetail = await getAdminUserDetail(userId);

  if (!userDetail) {
    notFound();
  }

  const roles = await getCurrentAdminRoles();
  const isOwner = roles.includes("owner");
  const mutationsEnabled = getFeatureFlags().adminUserMutationsEnabled;

  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();
  const isSelf = sessionUser?.id === userId;

  return (
    <UserDetailManager
      user={userDetail}
      isOwner={isOwner}
      mutationsEnabled={mutationsEnabled}
      isSelf={isSelf}
    />
  );
}
