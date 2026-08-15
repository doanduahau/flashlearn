"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BackButton } from "@/components/shared/back-button";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import { getMemoryAvailability } from "@/features/memory/server/actions";
import { startRunnerSession, getRunnerAvailability } from "@/features/runner/server/actions";
import { DifficultySelector } from "@/features/runner/components/difficulty-selector";
import type {
  RunnerDifficulty,
  RunnerQuestionCount,
  RunnerReplaySource,
} from "@/features/runner/types/runner-types";
import { buildRunnerSessionHref } from "@/features/runner/utils/runner-session-url";
import { cn } from "@/lib/utils";

export type StudyModeSource = {
  all: boolean;
  setIds: string[];
  collectionIds: string[];
};

type Availability = { count: number; options: number[] };

const PRIMARY_ACTION =
  "min-h-12 w-full rounded-xl bg-primary px-6 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 transition-opacity";

function sourceQuery(source: StudyModeSource): string {
  const params = new URLSearchParams();
  if (source.all) params.set("all", "1");
  if (source.setIds.length) params.set("sets", source.setIds.join(","));
  if (source.collectionIds.length) params.set("collections", source.collectionIds.join(","));
  return params.toString();
}

function sessionHref(path: string, source: StudyModeSource, count?: number): string {
  const params = new URLSearchParams(sourceQuery(source));
  if (count) params.set("count", String(count));
  return `${path}?${params.toString()}`;
}

function requirement(minimum: number, count: number): string {
  return `Cần tối thiểu ${minimum} thẻ — phạm vi hiện có ${count} thẻ`;
}

export function StudyModeSelect({
  source,
  totalCards,
  mascotLevel,
}: Readonly<{ source: StudyModeSource; totalCards: number; mascotLevel: MascotLevel }>) {
  const router = useRouter();
  const [memory, setMemory] = useState<Availability | null>(null);
  const [runner, setRunner] = useState<Availability | null>(null);
  const [selectedMode, setSelectedMode] = useState<"memory" | "runner" | null>(null);
  const [memoryCount, setMemoryCount] = useState<12 | 18 | 24>(12);
  const [runnerCount, setRunnerCount] = useState<RunnerQuestionCount>(12);
  const [difficulty, setDifficulty] = useState<RunnerDifficulty>("medium");
  const [runnerPending, setRunnerPending] = useState(false);
  const [runnerError, setRunnerError] = useState<string | null>(null);
  const query = sourceQuery(source);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      getMemoryAvailability({ ...source, questionCount: 12 }),
      getRunnerAvailability({ ...source, questionCount: 12, difficulty: "medium" }),
    ]).then(([memoryResult, runnerResult]) => {
      if (cancelled) return;
      setMemory(
        memoryResult.ok
          ? { count: memoryResult.eligibleCount, options: memoryResult.eligibility.availableCounts }
          : { count: 0, options: [] },
      );
      setRunner(
        runnerResult.ok
          ? { count: runnerResult.eligibleCount, options: runnerResult.eligibility.availableCounts }
          : { count: 0, options: [] },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  const memoryOptions = memory?.options ?? [];
  const runnerOptions = runner?.options ?? [];
  const selectedMemoryCount = memoryOptions.includes(memoryCount)
    ? memoryCount
    : ((memoryOptions[0] as 12 | 18 | 24 | undefined) ?? 12);
  const selectedRunnerCount = runnerOptions.includes(runnerCount)
    ? runnerCount
    : ((runnerOptions[0] as RunnerQuestionCount | undefined) ?? 12);

  async function startRunner(): Promise<void> {
    setRunnerPending(true);
    setRunnerError(null);
    const result = await startRunnerSession({
      ...source,
      questionCount: selectedRunnerCount,
      difficulty,
    });
    if (!result.ok) {
      setRunnerError(result.error);
      setRunnerPending(false);
      return;
    }
    const replaySource: RunnerReplaySource = {
      ...source,
      questionCount: selectedRunnerCount,
      difficulty,
    };
    router.push(buildRunnerSessionHref(result.session.runnerSessionId, replaySource));
  }

  return (
    <section aria-label="Chọn chế độ học" className="flex flex-1 flex-col gap-3">
      <div className="flex justify-start">
        <BackButton fallbackHref={`/study?${query}`} label="Quay lại chọn nguồn" />
      </div>

      <article className="flex flex-1 flex-col rounded-2xl border border-border-soft bg-surface p-3 shadow-soft sm:p-4">
        <div className="flex items-center gap-3">
          <MascotImage
            level={mascotLevel}
            state="normal"
            size={96}
            className="size-24 shrink-0 object-contain"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold">Lật thẻ</h2>
            <p className="text-sm text-text-secondary">
              Ôn theo cách truyền thống, tự lật thẻ để xem đáp án.
            </p>
          </div>
          <p className="shrink-0 text-sm font-medium">{totalCards} thẻ</p>
        </div>
        <div className="mt-auto pt-3">
          <button
            type="button"
            aria-label="Bắt đầu lật thẻ"
            className={PRIMARY_ACTION}
            disabled={totalCards < 1}
            onClick={() => router.push(sessionHref("/study/session", source))}
          >
            Bắt đầu
          </button>
        </div>
        {totalCards < 1 ? (
          <p className="mt-2 text-center text-sm text-danger">{requirement(1, totalCards)}</p>
        ) : null}
      </article>

      <article className="flex flex-1 flex-col rounded-2xl border border-border-soft bg-surface p-3 shadow-soft sm:p-4">
        <div className="flex items-center gap-3">
          <MascotImage
            level={mascotLevel}
            state="thinking"
            size={96}
            className="size-24 shrink-0 object-contain"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold">Memory matching</h2>
            <p className="text-sm text-text-secondary">Lật ô và ghép đúng mặt trước với mặt sau.</p>
          </div>
          <p className="shrink-0 text-sm font-medium">{memory?.count ?? 0} thẻ</p>
        </div>
        {memory === null ? (
          <p className="mt-auto pt-3 text-center text-sm text-text-secondary">Đang tính số thẻ…</p>
        ) : memoryOptions.length && selectedMode === "memory" ? (
          <div className="mt-auto flex flex-col gap-2 pt-3" aria-label="Số câu Memory">
            <div className="flex flex-wrap justify-center gap-2">
              {memoryOptions.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="min-h-11 rounded-xl border border-border-soft px-4 aria-[pressed=true]:border-primary aria-[pressed=true]:bg-primary-soft"
                  aria-pressed={selectedMemoryCount === value}
                  onClick={() => setMemoryCount(value as 12 | 18 | 24)}
                >
                  {value} câu
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="Bắt đầu Memory"
              className={PRIMARY_ACTION}
              onClick={() =>
                router.push(sessionHref("/memory/session", source, selectedMemoryCount))
              }
            >
              Bắt đầu
            </button>
          </div>
        ) : memoryOptions.length ? (
          <div className="mt-auto pt-3">
            <button
              type="button"
              aria-label="Bắt đầu Memory"
              className={PRIMARY_ACTION}
              onClick={() => setSelectedMode("memory")}
            >
              Bắt đầu
            </button>
          </div>
        ) : (
          <p className="mt-auto pt-3 text-center text-sm text-danger">
            {requirement(12, memory?.count ?? 0)}
          </p>
        )}
      </article>

      <article
        className={cn(
          "flex flex-1 flex-col rounded-2xl border border-border-soft bg-surface p-3 shadow-soft sm:p-4",
          runner !== null && runnerOptions.length === 0 && "opacity-60",
        )}
      >
        <div className="flex items-center gap-3">
          <MascotImage
            level={mascotLevel}
            state="run"
            size={96}
            className="size-24 shrink-0 object-contain"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold">Capy runner</h2>
            <p className="text-sm text-text-secondary">Chạy nhanh và chọn đáp án đúng.</p>
          </div>
          <p className="shrink-0 text-sm font-medium">{runner?.count ?? 0} thẻ</p>
        </div>
        {runner === null ? (
          <p className="mt-auto pt-3 text-center text-sm text-text-secondary">Đang tính số thẻ…</p>
        ) : runnerOptions.length && selectedMode === "runner" ? (
          <div className="mt-auto flex flex-col gap-2 pt-3">
            <DifficultySelector value={difficulty} onChange={setDifficulty} />
            <div className="mt-1 flex flex-wrap justify-center gap-2" aria-label="Số câu Runner">
              {runnerOptions.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="min-h-11 rounded-xl border border-border-soft px-4 aria-[pressed=true]:border-primary aria-[pressed=true]:bg-primary-soft"
                  aria-pressed={selectedRunnerCount === value}
                  onClick={() => setRunnerCount(value as RunnerQuestionCount)}
                >
                  {value} câu
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="Bắt đầu Runner"
              disabled={runnerPending}
              className={cn(PRIMARY_ACTION)}
              onClick={() => void startRunner()}
            >
              {runnerPending ? "Đang mở…" : "Bắt đầu"}
            </button>
          </div>
        ) : runnerOptions.length ? (
          <div className="mt-auto pt-3">
            <button
              type="button"
              aria-label="Bắt đầu Runner"
              className={PRIMARY_ACTION}
              onClick={() => setSelectedMode("runner")}
            >
              Bắt đầu
            </button>
          </div>
        ) : (
          <p className="mt-auto pt-3 text-center text-sm text-danger">
            {requirement(12, runner?.count ?? 0)}
          </p>
        )}
        {runnerError ? (
          <p role="alert" className="mt-2 text-center text-sm text-danger">
            {runnerError}
          </p>
        ) : null}
      </article>
    </section>
  );
}
