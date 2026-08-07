import { Leaf } from "lucide-react";
import Link from "next/link";

import { AppNavigation } from "@/components/layout/app-navigation";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { CurrentUser } from "@/features/auth/components/current-user";
import { StreakIndicator } from "@/features/statistics/components/streak-indicator";

export function AppShell({
  children,
  streak = 0,
  completedToday = false,
}: Readonly<{
  children: React.ReactNode;
  streak?: number;
  completedToday?: boolean;
}>) {
  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 border-r border-border-soft bg-surface p-6 md:flex">
        <Link href="/dashboard" className="flex items-center gap-2 font-heading text-lg font-bold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft">
            <Leaf className="size-5 text-primary" aria-hidden="true" />
          </span>
          <span>FlashLearn</span>
        </Link>
        <AppNavigation variant="sidebar" />
        <div className="mt-auto flex flex-col gap-3 border-t border-border-soft pt-4">
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
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col md:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border-soft bg-surface/90 px-4 backdrop-blur md:hidden">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-heading text-base font-bold"
          >
            <Leaf className="size-5 text-primary" aria-hidden="true" />
            FlashLearn
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/profile?tab=statistics"
              className="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <StreakIndicator streak={streak} completedToday={completedToday} />
            </Link>
            <CurrentUser />
            <SignOutButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:py-10">
          {children}
        </main>

        <AppNavigation variant="bottom" />
      </div>
    </div>
  );
}
