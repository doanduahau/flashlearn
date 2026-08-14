"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import { completeLearningCoverageSession } from "@/features/practice-coverage/server/actions";
import { buildStudyModeHref } from "@/features/study/utils/study-mode-href";
import { useBackWithFallback } from "@/hooks/use-back-with-fallback";
import { startRunnerSession, submitRunnerBestTime } from "../server/actions";
import type {
  Feedback,
  JumpState,
  RunnerDifficulty,
  RunnerEvent,
  RunnerQuestion,
  RunnerReplaySource,
  RunnerState,
  RunnerStatus,
} from "../types/runner-types";
import { getRunnerDifficultyConfig, runnerDifficultyLabel } from "../utils/runner-difficulty";
import { applyRunnerEvent, createRunnerState } from "../utils/runner-state";
import { buildRunnerSessionHref } from "../utils/runner-session-url";
import { RunnerBottomLabel } from "./runner-bottom-label";
import { RunnerCanvas } from "./runner-canvas";
import { RunnerEndOverlay, type RunnerBestTime } from "./runner-end-overlay";
import { RunnerHud } from "./runner-hud";
import { RunnerPausedOverlay } from "./runner-paused-overlay";
import { RunnerStartOverlay } from "./runner-start-overlay";

type RunnerDisplay = {
  status: RunnerStatus;
  lives: number;
  questionIndex: number;
  activeAnswerIndex: number | null;
  itemSeq: number;
  elapsedSeconds: number;
  feedback: Feedback | null;
  jumpState: JumpState;
  completedCount: number;
};

function computeDisplay(state: RunnerState): RunnerDisplay {
  return {
    status: state.status,
    lives: state.lives,
    questionIndex: state.questionIndex,
    activeAnswerIndex: state.activeAnswerIndex,
    itemSeq: state.itemSeq,
    elapsedSeconds: Math.floor(state.elapsedMs / 1000),
    feedback: state.feedback,
    jumpState: state.jumpState,
    completedCount: state.completedCount,
  };
}

function displayEqual(a: RunnerDisplay, b: RunnerDisplay): boolean {
  return (
    a.status === b.status &&
    a.lives === b.lives &&
    a.questionIndex === b.questionIndex &&
    a.activeAnswerIndex === b.activeAnswerIndex &&
    a.itemSeq === b.itemSeq &&
    a.elapsedSeconds === b.elapsedSeconds &&
    a.feedback === b.feedback &&
    a.jumpState === b.jumpState &&
    a.completedCount === b.completedCount
  );
}

export function RunnerSession({
  questions,
  difficulty,
  mascotLevel,
  runnerSessionId,
  coverageSessionId,
  replaySource,
}: Readonly<{
  questions: RunnerQuestion[];
  difficulty: RunnerDifficulty;
  mascotLevel: MascotLevel;
  runnerSessionId: string;
  coverageSessionId: string;
  replaySource: RunnerReplaySource | null;
}>) {
  const router = useRouter();
  const initialState = useMemo(
    () => createRunnerState(questions, difficulty),
    [questions, difficulty],
  );
  const stateRef = useRef<RunnerState>(initialState);
  const [display, setDisplay] = useState<RunnerDisplay>(() => computeDisplay(initialState));
  const displayRef = useRef(display);
  const [best, setBest] = useState<RunnerBestTime | null>(null);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [replayPending, setReplayPending] = useState(false);
  const [terminalElapsedMs, setTerminalElapsedMs] = useState<number | null>(null);
  const coverageCompletedRef = useRef(false);
  const completionStartedRef = useRef(false);
  const coveragePendingRef = useRef(false);
  const savingBestRef = useRef(false);
  const replayPendingRef = useRef(false);

  const dispatch = useCallback((event: RunnerEvent) => {
    const next = applyRunnerEvent(stateRef.current, event);
    stateRef.current = next;
    const nextDisplay = computeDisplay(next);
    if (next.status === "completed") setTerminalElapsedMs(next.elapsedMs);
    if (!displayEqual(displayRef.current, nextDisplay)) {
      displayRef.current = nextDisplay;
      setDisplay(nextDisplay);
    }
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        dispatch({ type: "JUMP" });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch]);

  useEffect(() => {
    function onVisibilityChange(): void {
      if (document.visibilityState === "hidden") {
        dispatch({ type: "PAUSE" });
      } else if (document.visibilityState === "visible") {
        dispatch({ type: "RESUME" });
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [dispatch]);

  const saveBest = useCallback(async (): Promise<void> => {
    if (savingBestRef.current) return;
    savingBestRef.current = true;
    setPersistenceError(null);
    if (terminalElapsedMs === null) {
      savingBestRef.current = false;
      setPersistenceError("Không thể lưu kỷ lục lúc này.");
      return;
    }
    try {
      const result = await submitRunnerBestTime(runnerSessionId, terminalElapsedMs);
      if (!result.ok) {
        setPersistenceError(result.error);
        return;
      }
      setBest({ bestMs: result.bestMs, isNewBest: result.isNewBest });
    } catch {
      setPersistenceError("Không thể lưu kỷ lục lúc này.");
    } finally {
      savingBestRef.current = false;
    }
  }, [runnerSessionId, terminalElapsedMs]);

  const completeCoverageAndSaveBest = useCallback(async (): Promise<void> => {
    if (!coverageCompletedRef.current) {
      if (coveragePendingRef.current) return;
      coveragePendingRef.current = true;
      setPersistenceError(null);
      try {
        const coverageResult = await completeLearningCoverageSession(coverageSessionId);
        if (!coverageResult.ok) {
          setPersistenceError(coverageResult.error);
          return;
        }
        coverageCompletedRef.current = true;
      } catch {
        setPersistenceError("Không thể hoàn tất phiên học lúc này.");
        return;
      } finally {
        coveragePendingRef.current = false;
      }
    }
    await saveBest();
  }, [coverageSessionId, saveBest]);

  useEffect(() => {
    if (
      display.status !== "completed" ||
      terminalElapsedMs === null ||
      completionStartedRef.current
    ) {
      return;
    }
    completionStartedRef.current = true;
    void completeCoverageAndSaveBest();
  }, [completeCoverageAndSaveBest, display.status, terminalElapsedMs]);

  const question = questions[display.questionIndex] ?? questions[0];
  const label =
    display.activeAnswerIndex === null ? "" : (question.choices[display.activeAnswerIndex] ?? "");
  const wrongCount = getRunnerDifficultyConfig(difficulty).lives - display.lives;
  const endMascotState =
    display.status === "game-over" ? "sad" : wrongCount <= 1 ? "congrats" : "sad";
  const exitHref = replaySource ? buildStudyModeHref(replaySource) : "/study/mode";
  const goBack = useBackWithFallback(exitHref);

  async function replay(): Promise<void> {
    if (!replaySource || replayPendingRef.current) return;
    replayPendingRef.current = true;
    setReplayPending(true);
    setReplayError(null);
    let navigating = false;
    try {
      const result = await startRunnerSession(replaySource);
      if (!result.ok) {
        setReplayError(result.error);
        return;
      }
      router.push(buildRunnerSessionHref(result.session.runnerSessionId, replaySource));
      navigating = true;
    } catch {
      setReplayError("Không thể tạo phiên Runner lúc này.");
    } finally {
      if (!navigating) {
        replayPendingRef.current = false;
        setReplayPending(false);
      }
    }
  }

  const canReplay =
    replaySource !== null && (display.status === "game-over" || best !== null) && !persistenceError;

  return (
    <div className="relative flex min-h-dvh flex-col">
      <RunnerHud
        lives={display.lives}
        elapsedMs={display.elapsedSeconds * 1000}
        questionNumber={display.questionIndex + 1}
        totalQuestions={questions.length}
        question={question.front}
        onBack={goBack}
      />

      <div
        className="relative min-h-40 flex-1"
        data-testid="runner-play-area"
        onPointerDown={() => dispatch({ type: "JUMP" })}
      >
        <RunnerCanvas
          stateRef={stateRef}
          dispatch={dispatch}
          difficulty={difficulty}
          mascotLevel={mascotLevel}
        />
      </div>

      <RunnerBottomLabel label={label} />

      {display.status === "ready" ? (
        <RunnerStartOverlay
          difficultyLabel={runnerDifficultyLabel(difficulty)}
          lives={getRunnerDifficultyConfig(difficulty).lives}
          onStart={() => dispatch({ type: "START" })}
        />
      ) : null}
      {display.status === "paused" ? <RunnerPausedOverlay /> : null}
      {display.status === "game-over" || display.status === "completed" ? (
        <RunnerEndOverlay
          status={display.status}
          elapsedMs={terminalElapsedMs ?? 0}
          level={mascotLevel}
          mascotState={endMascotState}
          difficultyLabel={runnerDifficultyLabel(difficulty)}
          questionCount={questions.length}
          completedCount={display.completedCount}
          best={best}
          persistenceError={persistenceError ?? replayError}
          replayPending={replayPending}
          onReplay={canReplay ? () => void replay() : null}
          onRetry={
            persistenceError
              ? () =>
                  void (coverageCompletedRef.current ? saveBest() : completeCoverageAndSaveBest())
              : null
          }
          onBack={goBack}
        />
      ) : null}
    </div>
  );
}
