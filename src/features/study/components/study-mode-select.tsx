"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { MascotImage } from "@/features/mascot/components/mascot-image";
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
}: Readonly<{ source: StudyModeSource; totalCards: number }>) {
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
    <section aria-label="Chọn chế độ học" className="mt-4 space-y-3 pb-8 sm:mt-6">
      <Link
        className="inline-flex min-h-11 items-center text-sm font-medium text-text-secondary underline"
        href={`/study?${query}`}
      >
        Quay lại chọn nguồn
      </Link>

      <article className="rounded-2xl border border-border-soft bg-surface p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <MascotImage level={1} state="normal" size={64} className="size-16 object-contain" />
          <div>
            <h2 className="text-lg font-bold">Lật thẻ</h2>
            <p className="text-sm text-text-secondary">
              Ôn theo cách truyền thống, tự lật thẻ để xem đáp án.
            </p>
            <p className="mt-1 text-sm">{totalCards} thẻ hợp lệ</p>
          </div>
        </div>
        <button
          type="button"
          className="mt-4 min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          disabled={totalCards < 1}
          onClick={() => router.push(sessionHref("/study/session", source))}
        >
          Bắt đầu lật thẻ
        </button>
        {totalCards < 1 ? (
          <p className="mt-2 text-sm text-danger">{requirement(1, totalCards)}</p>
        ) : null}
      </article>

      <article className="rounded-2xl border border-border-soft bg-surface p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <MascotImage level={1} state="thinking" size={64} className="size-16 object-contain" />
          <div>
            <h2 className="text-lg font-bold">Memory matching</h2>
            <p className="text-sm text-text-secondary">Lật ô và ghép đúng mặt trước với mặt sau.</p>
            <p className="mt-1 text-sm">{memory?.count ?? 0} thẻ hợp lệ</p>
          </div>
        </div>
        {memoryOptions.length && selectedMode === "memory" ? (
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Số câu Memory">
            {memoryOptions.map((value) => (
              <button
                key={value}
                type="button"
                className="min-h-11 rounded-xl border border-border-soft px-3 aria-[pressed=true]:border-primary aria-[pressed=true]:bg-primary-soft"
                aria-pressed={selectedMemoryCount === value}
                onClick={() => setMemoryCount(value as 12 | 18 | 24)}
              >
                {value} câu
              </button>
            ))}
            <button
              type="button"
              className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground"
              onClick={() =>
                router.push(sessionHref("/memory/session", source, selectedMemoryCount))
              }
            >
              Bắt đầu Memory
            </button>
          </div>
        ) : memoryOptions.length ? (
          <button
            type="button"
            className="mt-4 min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground"
            onClick={() => setSelectedMode("memory")}
          >
            Chọn Memory
          </button>
        ) : (
          <p className="mt-3 text-sm text-danger">{requirement(12, memory?.count ?? 0)}</p>
        )}
      </article>

      <article
        className={cn(
          "rounded-2xl border border-border-soft bg-surface p-4 shadow-soft",
          runnerOptions.length === 0 && "opacity-60",
        )}
      >
        <div className="flex items-start gap-3">
          <MascotImage level={1} state="run" size={64} className="size-16 object-contain" />
          <div>
            <h2 className="text-lg font-bold">Capy runner</h2>
            <p className="text-sm text-text-secondary">Chạy nhanh và chọn đáp án đúng.</p>
            <p className="mt-1 text-sm">{runner?.count ?? 0} thẻ hợp lệ</p>
          </div>
        </div>
        {runnerOptions.length && selectedMode === "runner" ? (
          <>
            <DifficultySelector value={difficulty} onChange={setDifficulty} />
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Số câu Runner">
              {runnerOptions.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="min-h-11 rounded-xl border border-border-soft px-3 aria-[pressed=true]:border-primary aria-[pressed=true]:bg-primary-soft"
                  aria-pressed={selectedRunnerCount === value}
                  onClick={() => setRunnerCount(value as RunnerQuestionCount)}
                >
                  {value} câu
                </button>
              ))}
              <button
                type="button"
                disabled={runnerPending}
                className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50"
                onClick={() => void startRunner()}
              >
                {runnerPending ? "Đang mở…" : "Bắt đầu Runner"}
              </button>
            </div>
          </>
        ) : runnerOptions.length ? (
          <button
            type="button"
            className="mt-4 min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground"
            onClick={() => setSelectedMode("runner")}
          >
            Chọn Runner
          </button>
        ) : (
          <p className="mt-3 text-sm text-danger">{requirement(12, runner?.count ?? 0)}</p>
        )}
        {runnerError ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {runnerError}
          </p>
        ) : null}
      </article>
    </section>
  );
}
