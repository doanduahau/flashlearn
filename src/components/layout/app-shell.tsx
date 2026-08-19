import Link from "next/link";

import { AppChrome } from "@/components/layout/app-chrome";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { CurrentUser } from "@/features/auth/components/current-user";
import { StorageQuotaWarning } from "@/features/entitlements/components/storage-quota-warning";
import { StreakIndicator } from "@/features/statistics/components/streak-indicator";

export function AppShell({
  children,
  streak = 0,
  completedToday = false,
  storageQuotaWarning = false,
}: Readonly<{
  children: React.ReactNode;
  streak?: number;
  completedToday?: boolean;
  storageQuotaWarning?: boolean;
}>) {
  return (
    <AppChrome
      sidebarFooter={
        <>
          <Link
            href="/profile?tab=statistics"
            className="w-fit self-center rounded-full focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <StreakIndicator
              streak={streak}
              completedToday={completedToday}
              className="w-fit justify-center px-2"
            />
          </Link>
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <CurrentUser />
            </div>
            <SignOutButton />
          </div>
        </>
      }
      mobileHeaderRight={
        <>
          <Link
            href="/profile?tab=statistics"
            className="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <StreakIndicator streak={streak} completedToday={completedToday} />
          </Link>
        </>
      }
      contentNotice={storageQuotaWarning ? <StorageQuotaWarning /> : null}
    >
      {children}
    </AppChrome>
  );
}
