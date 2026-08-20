import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function StarterOnboardingBanner() {
  return (
    <aside className="mt-4 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary-soft p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <CheckCircle2
          className="mt-0.5 size-5 shrink-0 text-primary-foreground"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-primary-foreground">
          CapyStudy đã chuẩn bị 3 bộ flashcard để bạn bắt đầu học ngay.
        </p>
      </div>
      <Button asChild variant="outline" className="min-h-11 shrink-0">
        <Link href="/sets/library">Xem các bộ</Link>
      </Button>
    </aside>
  );
}
