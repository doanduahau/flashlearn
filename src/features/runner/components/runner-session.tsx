"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import type {
  Feedback,
  JumpState,
  RunnerDifficulty,
  RunnerEvent,
  RunnerQuestion,
  RunnerState,
  RunnerStatus,
} from "../types/runner-types";
import { applyRunnerEvent, createRunnerState } from "../utils/runner-state";
import { getRunnerDifficultyConfig, runnerDifficultyLabel } from "../utils/runner-difficulty";
import { RunnerBottomLabel } from "./runner-bottom-label";
import { RunnerCanvas } from "./runner-canvas";
import { RunnerEndOverlay } from "./runner-end-overlay";
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
    a.jumpState === b.jumpState
  );
}

export function RunnerSession({
  questions,
  difficulty,
  mascotLevel,
}: Readonly<{
  questions: RunnerQuestion[];
  difficulty: RunnerDifficulty;
  mascotLevel: MascotLevel;
}>) {
  const router = useRouter();
  const initialState = useMemo(
    () => createRunnerState(questions, difficulty),
    [questions, difficulty],
  );
  const stateRef = useRef<RunnerState>(initialState);
  const [display, setDisplay] = useState<RunnerDisplay>(() => computeDisplay(initialState));
  const displayRef = useRef(display);

  const dispatch = useCallback((event: RunnerEvent) => {
    const next = applyRunnerEvent(stateRef.current, event);
    stateRef.current = next;
    const nextDisplay = computeDisplay(next);
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

  const question = questions[display.questionIndex] ?? questions[0];
  const label =
    display.activeAnswerIndex === null ? "" : (question.choices[display.activeAnswerIndex] ?? "");
  const wrongCount = getRunnerDifficultyConfig(difficulty).lives - display.lives;
  const endMascotState =
    display.status === "game-over" ? "sad" : wrongCount <= 1 ? "congrats" : "sad";

  return (
    <div className="relative flex min-h-dvh flex-col">
      <RunnerHud
        lives={display.lives}
        elapsedMs={display.elapsedSeconds * 1000}
        questionNumber={display.questionIndex + 1}
        totalQuestions={questions.length}
        question={question.front}
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
          elapsedMs={display.elapsedSeconds * 1000}
          level={mascotLevel}
          mascotState={endMascotState}
          onBack={() => router.push("/runner")}
        />
      ) : null}
    </div>
  );
}
