"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MatchBoard } from "@/features/match/components/match-board";
import { startMatchCoverageSession } from "@/features/match/server/actions";
import type { MatchQuestionCount, StartedMatchSession } from "@/features/match/types/match-types";
import { completeLearningCoverageSession } from "@/features/practice-coverage/server/actions";

type MatchSessionProps = {
  sessionHref: string;
  questionCount: MatchQuestionCount;
};

function sourceFromHref(sessionHref: string, questionCount: MatchQuestionCount) {
  const url = new URL(sessionHref, window.location.origin);
  return {
    all: url.searchParams.get("all") === "1",
    setIds: (url.searchParams.get("sets") ?? "").split(",").filter(Boolean),
    collectionIds: (url.searchParams.get("collections") ?? "").split(",").filter(Boolean),
    questionCount,
  };
}

export function MatchSession({ sessionHref, questionCount }: MatchSessionProps) {
  const [session, setSession] = useState<StartedMatchSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const loadSession = useCallback(async () => {
    setSession(null);
    setError(null);
    setCompletionError(null);
    const result = await startMatchCoverageSession(sourceFromHref(sessionHref, questionCount));
    if (!result.ok) {
      setCompletionError(result.error);
      return;
    }
    setSession(result.session);
  }, [questionCount, sessionHref]);

  useEffect(() => {
    let cancelled = false;
    void startMatchCoverageSession(sourceFromHref(sessionHref, questionCount)).then((result) => {
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

  async function handleComplete(): Promise<void> {
    if (!session) return;
    const result = await completeLearningCoverageSession(session.coverageSessionId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  function replay(): void {
    setDone(false);
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
        <h2 className="text-xl font-bold sm:text-2xl">
          Hoàn thành {questionCount}/{questionCount}
        </h2>
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
          <Button type="button" onClick={() => void handleComplete()}>
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
    <MatchBoard
      key={session.coverageSessionId}
      batches={session.batches}
      questionCount={questionCount}
      onComplete={handleComplete}
    />
  );
}
