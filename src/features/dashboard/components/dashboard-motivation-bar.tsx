import Link from "next/link";
import { Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";

export function DashboardMotivationBar({
  completedToday,
  recoverable = false,
  needsRecoveryQuizzes = 0,
  mascotLevel,
}: Readonly<{
  completedToday: boolean;
  recoverable?: boolean;
  needsRecoveryQuizzes?: number;
  mascotLevel: MascotLevel;
}>) {
  const recoveryMessage = recoverable
    ? `Làm ${needsRecoveryQuizzes} bài chế độ kiểm tra để khôi phục streak`
    : null;
  const heading =
    recoveryMessage ?? (completedToday ? "Đã nối chuỗi hôm nay! 🎉" : "Chưa làm bài hôm nay");
  return (
    <section
      aria-label="Động lực hằng ngày"
      className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-border-soft bg-surface-subtle px-3 py-2.5 sm:mt-5 sm:rounded-3xl sm:px-5 sm:py-4"
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <MascotImage
          level={mascotLevel}
          state={completedToday || recoverable ? "happy" : "point-right"}
          size={64}
          loading="eager"
          className="size-16 shrink-0 object-contain"
        />
        <h2 id="daily-motivation-heading" className="text-sm font-semibold sm:text-base">
          {heading}
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
