"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import { MemoryBoard } from "@/features/memory/components/memory-board";
import { startMemoryCoverageSession } from "@/features/memory/server/actions";
import type {
  MemoryQuestionCount,
  StartedMemorySession,
} from "@/features/memory/types/memory-types";
import { completeLearningCoverageSession } from "@/features/practice-coverage/server/actions";

type MemorySessionProps = {
  sessionHref: string;
  questionCount: MemoryQuestionCount;
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

export function MemorySession({ sessionHref, questionCount }: MemorySessionProps) {
  const [session, setSession] = useState<StartedMemorySession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

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
      setDone(true);
    },
    [session],
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
        <Button asChild variant="outline">
          <Link href="/study">Quay lại</Link>
        </Button>
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
      <div className="space-y-4">
        <MascotImage level={1} state="congrats" size={80} className="size-16 object-contain" />
        <h2 className="text-xl font-bold sm:text-2xl">
          Hoàn thành {questionCount}/{questionCount}
        </h2>
        <p className="text-sm text-text-secondary">Thời gian {formatTime(elapsedMs)}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={replay}>
            Chơi lại
          </Button>
          <Button asChild variant="outline">
            <Link href="/study">Quay lại</Link>
          </Button>
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
          <Button asChild variant="outline">
            <Link href="/study">Quay lại</Link>
          </Button>
        </div>
      </div>
    );
  }
  return (
    <MemoryBoard
      key={session.coverageSessionId}
      batches={session.batches}
      questionCount={questionCount}
      onComplete={handleComplete}
    />
  );
}
