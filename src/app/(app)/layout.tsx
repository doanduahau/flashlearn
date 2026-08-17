import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { loadCachedStreakSummary } from "@/features/statistics/server/load-cached-statistics";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();

  if (!data) {
    redirect("/sign-in");
  }

  const streak = await loadCachedStreakSummary(supabase);

  return (
    <AppShell streak={streak?.currentStreak ?? 0} completedToday={streak?.completedToday ?? false}>
      {children}
    </AppShell>
  );
}
