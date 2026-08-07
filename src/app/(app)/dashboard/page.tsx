import Link from "next/link";
import { FileUp, SquarePen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ManualSetForm } from "@/features/flashcard-sets/components/manual-set-form";
import { ImportWizard } from "@/features/imports/components/import-wizard";
import { StreakSummary } from "@/features/statistics/components/streak-summary";
import { accuracy, loadLearningStatistics } from "@/features/statistics/server/load-statistics";
import { createClient } from "@/lib/supabase/server";

type CreationMode = "import" | "manual" | null;

function creationMode(value: string | string[] | undefined): CreationMode {
  return value === "import" || value === "manual" ? value : null;
}

export default async function DashboardPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ create?: string | string[] }> }>) {
  const stats = await loadLearningStatistics(await createClient());
  const raw = await searchParams;
  const mode = creationMode(raw.create);

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Tổng quan</h1>
      {stats ? (
        <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Tóm tắt học tập">
          <StreakSummary streak={stats.current_streak} completedToday={stats.completed_today} />
          <article className="rounded-2xl border border-border-soft p-4">
            <h2 className="text-sm text-text-secondary">Mục tiêu hôm nay</h2>
            <p className="text-2xl font-bold">{stats.completed_today ? "Đã xong" : "Chưa xong"}</p>
          </article>
          <article className="rounded-2xl border border-border-soft p-4">
            <h2 className="text-sm text-text-secondary">Độ chính xác</h2>
            <p className="text-2xl font-bold">
              {accuracy(stats.correct_answers, stats.questions_answered)}%
            </p>
          </article>
        </section>
      ) : null}

      <section
        aria-labelledby="creation-heading"
        className="mt-8 rounded-3xl border border-border-soft bg-surface-subtle p-5 sm:p-6"
      >
        <h2 id="creation-heading" className="text-xl font-bold">
          Tạo bộ flashcard
        </h2>
        <p className="mt-1 text-text-secondary">Chọn cách bắt đầu phù hợp với nội dung của bạn.</p>
        {!mode ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Button asChild className="min-h-11">
              <Link href="/dashboard?create=import" scroll={false}>
                <FileUp aria-hidden="true" />
                Nhập từ tệp
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/dashboard?create=manual" scroll={false}>
                <SquarePen aria-hidden="true" />
                Tạo bộ thủ công
              </Link>
            </Button>
          </div>
        ) : null}
        {mode === "import" ? (
          <section
            aria-label="Nhập từ tệp"
            className="mt-5 rounded-2xl border border-border-soft bg-surface p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">Nhập từ tệp</h3>
              <Link className="text-sm underline" href="/dashboard" scroll={false}>
                Đóng
              </Link>
            </div>
            <div className="mt-4">
              <ImportWizard />
            </div>
          </section>
        ) : null}
        {mode === "manual" ? <ManualSetForm /> : null}
      </section>

      <Link className="mt-6 inline-block underline" href="/profile?tab=statistics">
        Xem thống kê chi tiết
      </Link>
    </main>
  );
}
