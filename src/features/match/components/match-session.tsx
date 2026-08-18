"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { BackButton } from "@/components/shared/back-button";
import { BrandLoading } from "@/components/shared/brand-loading";
import { Button } from "@/components/ui/button";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import { MatchBoard, type MatchCompletionStats } from "@/features/match/components/match-board";
import { saveMatchAttempt, startMatchCoverageSession } from "@/features/match/server/actions";
import type { MatchQuestionCount, StartedMatchSession } from "@/features/match/types/match-types";
import { completeLearningCoverageSession } from "@/features/practice-coverage/server/actions";

import { SessionExitButton } from "@/features/learning-modes/components/session-exit-button";
import { PauseOverlay } from "@/features/learning-modes/components/pause-overlay";
import { useVisibilityPause } from "@/features/learning-modes/hooks/use-visibility-pause";
import { recordDailyActivity } from "@/features/learning-modes/server/record-activity";
import { recordModeAnswers } from "@/features/learning-modes/server/record-mode-answers";

type MatchSessionProps = {
  sessionHref: string;
  questionCount: MatchQuestionCount;
  exitHref: string;
  mascotLevel: MascotLevel;
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

/**
 * Collapses the session's card outcome into one event per card. A card that
 * was ever matched correctly wins (the latest-answer rule resolves per card,
 * and correct matching happens after any earlier wrong attempt).
 */
function buildCardAnswers(
  correctCardIds: string[],
  wrongCardIds: string[],
): Array<{
  flashcardId: string;
  isCorrect: boolean;
}> {
  const byId = new Map<string, boolean>();
  for (const id of correctCardIds) byId.set(id, true);
  for (const id of wrongCardIds) {
    if (!byId.has(id)) byId.set(id, false);
  }
  return Array.from(byId.entries()).map(([flashcardId, isCorrect]) => ({
    flashcardId,
    isCorrect,
  }));
}

export function MatchSession({
  sessionHref,
  questionCount,
  exitHref,
  mascotLevel,
}: MatchSessionProps) {
  const router = useRouter();
  const [session, setSession] = useState<StartedMatchSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [matchSaveError, setMatchSaveError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const completingRef = useRef(false);
  const startedAtRef = useRef(0);
  const lastSaveInputRef = useRef<{
    sourceSetIds: string[];
    sourceCollectionIds: string[];
    sourceAll: boolean;
    totalPairs: number;
    correctPairs: number;
    incorrectAttempts: number;
    elapsedMs: number;
  } | null>(null);
  const lastStatsRef = useRef<{
    correctCardIds: string[];
    wrongCardIds: string[];
  } | null>(null);
  const { isPaused, resume } = useVisibilityPause();

  const loadSession = useCallback(async () => {
    setSession(null);
    setError(null);
    setCompletionError(null);
    setMatchSaveError(null);
    const result = await startMatchCoverageSession(sourceFromHref(sessionHref, questionCount));
    if (!result.ok) {
      setCompletionError(result.error);
      return;
    }
    startedAtRef.current = Date.now();
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
      startedAtRef.current = Date.now();
      setSession(result.session);
    });
    return () => {
      cancelled = true;
    };
  }, [questionCount, sessionHref]);

  async function handleComplete(stats: MatchCompletionStats): Promise<void> {
    if (!session || completingRef.current) return;
    completingRef.current = true;
    // Show the completion screen immediately; persistence runs in the
    // background so the player is not blocked by the server calls. Any save
    // failure surfaces inline with a retry button on the completion screen.
    setMatchSaveError(null);
    setDone(true);
    try {
      const coverage = await completeLearningCoverageSession(session.coverageSessionId);
      if (!coverage.ok) {
        setMatchSaveError(coverage.error);
        return;
      }
      const source = sourceFromHref(sessionHref, questionCount);
      const input = {
        sourceSetIds: source.setIds,
        sourceCollectionIds: source.collectionIds,
        sourceAll: source.all,
        totalPairs: questionCount,
        correctPairs: stats.correctPairs,
        incorrectAttempts: stats.incorrectAttempts,
        elapsedMs: Math.max(0, Date.now() - startedAtRef.current),
      };
      lastSaveInputRef.current = input;
      lastStatsRef.current = {
        correctCardIds: stats.correctCardIds,
        wrongCardIds: stats.wrongCardIds,
      };
      const save = await saveMatchAttempt(input);
      if (!save.ok) {
        setMatchSaveError(save.error);
        return;
      }
      const events = await recordModeAnswers({
        mode: "match",
        answers: buildCardAnswers(stats.correctCardIds, stats.wrongCardIds),
      });
      if (!events.ok) {
        setMatchSaveError(events.error);
        return;
      }
      const record = await recordDailyActivity({
        mode: "match",
        questionsAnswered: stats.correctPairs + stats.incorrectAttempts,
        correctAnswers: stats.correctPairs,
      });
      if (!record.ok) {
        setMatchSaveError(record.error);
        return;
      }
      router.refresh();
    } finally {
      completingRef.current = false;
    }
  }

  async function retrySaveMatch(): Promise<void> {
    if (completingRef.current || !lastSaveInputRef.current) return;
    completingRef.current = true;
    try {
      const save = await saveMatchAttempt(lastSaveInputRef.current);
      if (!save.ok) {
        setMatchSaveError(save.error);
      } else {
        setMatchSaveError(null);
        const stats = lastStatsRef.current;
        if (stats) {
          const events = await recordModeAnswers({
            mode: "match",
            answers: buildCardAnswers(stats.correctCardIds, stats.wrongCardIds),
          });
          if (!events.ok) {
            setMatchSaveError(events.error);
          }
        }
        const record = await recordDailyActivity({
          mode: "match",
          questionsAnswered:
            lastSaveInputRef.current.correctPairs + lastSaveInputRef.current.incorrectAttempts,
          correctAnswers: lastSaveInputRef.current.correctPairs,
        });
        if (!record.ok) {
          setMatchSaveError(record.error);
        }
        router.refresh();
      }
    } finally {
      completingRef.current = false;
    }
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
        <BackButton fallbackHref="/quiz/mode" />
      </div>
    );
  }
  if (!session) return <BrandLoading title="Đang tải thẻ" />;
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
          Hoàn thành {questionCount}/{questionCount} thẻ
        </p>
        {matchSaveError ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-4 text-left sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-danger">{matchSaveError}</p>
            <Button type="button" variant="outline" onClick={() => void retrySaveMatch()}>
              Thử lại lưu kết quả
            </Button>
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="soft" onClick={replay}>
            Chơi lại
          </Button>
          <BackButton fallbackHref="/quiz/mode" />
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
          <Button type="button" onClick={() => void loadSession()}>
            Thử lại
          </Button>
          <BackButton fallbackHref="/quiz/mode" />
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="mb-4 flex items-center justify-start">
        <SessionExitButton fallbackHref={exitHref} />
      </div>
      <MatchBoard
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
