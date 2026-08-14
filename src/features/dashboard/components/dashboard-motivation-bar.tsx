import Link from "next/link";
import { Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";

export function DashboardMotivationBar({
  completedToday,
  mascotLevel,
}: Readonly<{ completedToday: boolean; mascotLevel: MascotLevel }>) {
  return (
    <section
      aria-label="Động lực hằng ngày"
      className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-border-soft bg-surface-subtle px-3 py-2.5 sm:mt-5 sm:rounded-3xl sm:px-5 sm:py-4"
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <MascotImage
          level={mascotLevel}
          state={completedToday ? "happy" : "point-right"}
          size={64}
          loading="eager"
          className="size-12 shrink-0 object-contain sm:size-16"
        />
        <h2 id="daily-motivation-heading" className="text-sm font-semibold sm:text-base">
          {completedToday ? "Đã nối chuỗi hôm nay! 🎉" : "Chưa làm bài hôm nay"}
        </h2>
      </div>
      <Button asChild size="sm" className="shrink-0">
        <Link href="/quiz?tab=create">
          <Play aria-hidden="true" />
          <span className="hidden sm:inline">{completedToday ? "Tiếp tục" : "Bắt đầu"}</span>
          <span className="sm:hidden">{completedToday ? "Luyện tập" : "Kiểm tra"}</span>
        </Link>
      </Button>
    </section>
  );
}
