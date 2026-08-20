import { redirect } from "next/navigation";

import {
  AdminAuthorizationError,
  requireAnyAdminRole,
} from "@/features/admin/server/authorization";
import { getFeatureFlags } from "@/lib/telemetry/feature-flags";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!getFeatureFlags().adminConsoleEnabled) {
    redirect("/dashboard");
  }

  try {
    await requireAnyAdminRole();
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      redirect("/dashboard");
    }
    throw error;
  }
  return <div className="mx-auto w-full max-w-5xl p-3 sm:p-8">{children}</div>;
}
