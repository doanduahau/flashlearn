"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BackButton } from "@/components/shared/back-button";
import { Button } from "@/components/ui/button";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import { MemoryBoard } from "@/features/memory/components/memory-board";
import { startMemoryCoverageSession } from "@/features/memory/server/actions";
import type {
  MemoryQuestionCount,
  StartedMemorySession,
} from "@/features/memory/types/memory-types";
import { completeLearningCoverageSession } from "@/features/practice-coverage/server/actions";
import { PauseOverlay } from "@/features/learning-modes/components/pause-overlay";
import { useVisibilityPause } from "@/features/learning-modes/hooks/use-visibility-pause";
import { recordDailyActivity } from "@/features/learning-modes/server/record-activity";

type MemorySessionProps = {
  sessionHref: string;
  questionCount: MemoryQuestionCount;
  exitHref: string;
  mascotLevel: MascotLevel;
};

function sourceFromHref(sessionHref: string, questionCount: MemoryQuestionCount) {
  const url = new URL(sessionHref, window.location.origin);
  return {
    all: url.searchParams.get("all") === "1",
    setIds: (url.searchParams.get("sets") ?? "").split(",").filter(Boolean),
    collectionIds: (url.searchParams.get("collections") ?? "").split(",").filter(Boolean),
    questionCount,
  };
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function MemorySession({
  sessionHref,
  questionCount,
  exitHref,
  mascotLevel,
}: MemorySessionProps) {
  const router = useRouter();
  const [session, setSession] = useState<StartedMemorySession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const { isPaused, resume } = useVisibilityPause();

  const loadSession = useCallback(async () => {
    setSession(null);
    setError(null);
    setCompletionError(null);
    setDone(false);
    const result = await startMemoryCoverageSession(sourceFromHref(sessionHref, questionCount));
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSession(result.session);
  }, [questionCount, sessionHref]);

  useEffect(() => {
    let cancelled = false;
    void startMemoryCoverageSession(sourceFromHref(sessionHref, questionCount)).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSession(result.session);
    });
    return () => {
      cancelled = true;
    };
  }, [questionCount, sessionHref]);

  const handleComplete = useCallback(
    async (ms: number): Promise<void> => {
      if (!session) return;
      setElapsedMs(ms);
      const result = await completeLearningCoverageSession(session.coverageSessionId);
      if (!result.ok) {
        setCompletionError(result.error);
        return;
      }
      const record = await recordDailyActivity({
        mode: "memory",
        questionsAnswered: 0,
        correctAnswers: 0,
      });
      if (!record.ok) {
        setCompletionError(record.error);
        return;
      }
      router.refresh();
      setDone(true);
    },
    [router, session],
  );

  function replay(): void {
    void loadSession();
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p
          role="alert"
          className="rounded-2xl border border-border-soft bg-surface p-4 text-danger"
        >
          {error}
        </p>
        <BackButton fallbackHref={exitHref} />
      </div>
    );
  }
  if (!session)
    return (
      <p role="status" className="text-text-secondary">
        Đang tải thẻ…
      </p>
    );
  if (done) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <MascotImage
          level={mascotLevel}
          state="congrats"
          size={144}
          className="size-36 object-contain"
          aria-hidden
        />
        <h2 className="text-xl font-bold sm:text-2xl">Hoàn thành!</h2>
        <p className="text-sm text-text-secondary">
          Hoàn thành {questionCount}/{questionCount} thẻ · Thời gian {formatTime(elapsedMs)}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="soft" onClick={replay}>
            Chơi lại
          </Button>
          <BackButton fallbackHref={exitHref} />
        </div>
      </div>
    );
  }
  if (completionError) {
    return (
      <div className="space-y-4">
        <p
          role="alert"
          className="rounded-2xl border border-border-soft bg-surface p-4 text-danger"
        >
          {completionError}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => session && void handleComplete(elapsedMs)}>
            Thử lại
          </Button>
          <BackButton fallbackHref={exitHref} />
        </div>
      </div>
    );
  }
  return (
    <>
      <MemoryBoard
        key={session.coverageSessionId}
        batches={session.batches}
        questionCount={questionCount}
        isPaused={isPaused}
        onComplete={handleComplete}
      />
      {isPaused ? <PauseOverlay onResume={resume} /> : null}
    </>
  );
}
