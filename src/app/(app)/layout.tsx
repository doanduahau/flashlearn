import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { loadLearningStatistics } from "@/features/statistics/server/load-statistics";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();

  if (!data) {
    redirect("/sign-in");
  }

  const stats = await loadLearningStatistics(supabase);

  return (
    <AppShell streak={stats?.current_streak ?? 0} completedToday={stats?.completed_today ?? false}>
      {children}
    </AppShell>
  );
}
