import { redirect } from "next/navigation";

import { AdminNav } from "@/features/admin/components/admin-nav";
import {
  AdminAuthorizationError,
  requireAnyAdminRole,
} from "@/features/admin/server/authorization";
import { getPermissionsForRoles } from "@/features/admin/permission-map";
import { env } from "@/lib/env";
import { getFeatureFlags } from "@/lib/telemetry/feature-flags";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!getFeatureFlags().adminConsoleEnabled) {
    redirect("/dashboard");
  }

  let identity;
  try {
    identity = await requireAnyAdminRole();
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      redirect("/dashboard");
    }
    throw error;
  }

  const permissions = getPermissionsForRoles(identity.roles);
  const environment = env.runtimeEnvironment ?? "development";

  return (
    <div className="mx-auto w-full max-w-5xl p-3 sm:p-8">
      <AdminNav permissions={[...permissions]} environment={environment} />
      <div className="mt-4">{children}</div>
    </div>
  );
}
