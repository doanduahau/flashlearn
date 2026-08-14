import { describe, expect, it } from "vitest";

import type {
  RunnerDifficulty,
  RunnerEvent,
  RunnerQuestion,
  RunnerState,
} from "@/features/runner/types/runner-types";
import {
  applyRunnerEvent,
  createRunnerState,
  nextAnswerIndex,
} from "@/features/runner/utils/runner-state";

function question(index: number, correctIndex = 0): RunnerQuestion {
  const correct = `answer-${index}`;
  const distractors = [`wrong-a-${index}`, `wrong-b-${index}`];
  const choices = [
    ...distractors.slice(0, correctIndex),
    correct,
    ...distractors.slice(correctIndex),
  ] as [string, string, string];
  return {
    flashcardId: `card-${index}`,
    front: `prompt-${index}`,
    correctAnswer: correct,
    choices,
  };
}

function startedState(difficulty: RunnerDifficulty = "easy", count = 2): RunnerState {
  const questions = Array.from({ length: count }, (_, index) => question(index));
  const created = createRunnerState(questions, difficulty);
  return applyRunnerEvent(created, { type: "START" });
}

const hit = (state: RunnerState): RunnerEvent => ({
  type: "HIT_ACTIVE_ITEM",
  itemSeq: state.itemSeq,
});
const pass = (state: RunnerState): RunnerEvent => ({
  type: "PASS_ACTIVE_ITEM",
  itemSeq: state.itemSeq,
});

describe("nextAnswerIndex", () => {
  it("cycles 0 → 1 → 2 → 0", () => {
    expect(nextAnswerIndex(0)).toBe(1);
    expect(nextAnswerIndex(1)).toBe(2);
    expect(nextAnswerIndex(2)).toBe(0);
  });
});

describe("createRunnerState — initialization", () => {
  it("assigns the frozen lives per difficulty", () => {
    const easy = createRunnerState([question(0)], "easy");
    const medium = createRunnerState([question(0)], "medium");
    const hard = createRunnerState([question(0)], "hard");
    expect(easy.lives).toBe(3);
    expect(medium.lives).toBe(2);
    expect(hard.lives).toBe(1);
  });

  it("derives the correct index from the prepared choice order", () => {
    const state = createRunnerState([question(0, 2)], "easy");
    expect(state.correctIndexes).toEqual([2]);
  });

  it("starts at question index 0 in ready state", () => {
    const state = createRunnerState([question(0), question(1)], "easy");
    expect(state.status).toBe("ready");
    expect(state.questionIndex).toBe(0);
    expect(state.activeAnswerIndex).toBeNull();
    expect(state.completedCount).toBe(0);
    expect(state.elapsedMs).toBe(0);
  });

  it("rejects an empty question list", () => {
    expect(() => createRunnerState([], "easy")).toThrow();
  });

  it("rejects a question without exactly three choices", () => {
    const bad = { ...question(0), choices: ["a", "b"] as unknown as [string, string, string] };
    expect(() => createRunnerState([bad], "easy")).toThrow();
  });

  it("rejects a question whose correct answer is not among the choices", () => {
    const bad = {
      ...question(0),
      correctAnswer: "missing",
      choices: ["a", "b", "c"] as [string, string, string],
    };
    expect(() => createRunnerState([bad], "easy")).toThrow();
  });

  it("rejects an invalid difficulty", () => {
    expect(() => createRunnerState([question(0)], "nightmare" as never)).toThrow();
  });
});

describe("start", () => {
  it("moves ready → playing and creates the first item", () => {
    const ready = createRunnerState([question(0)], "easy");
    expect(ready.elapsedMs).toBe(0);
    const playing = applyRunnerEvent(ready, { type: "START" });
    expect(playing.status).toBe("playing");
    expect(playing.activeAnswerIndex).toBe(0);
    expect(playing.itemSeq).toBe(0);
  });

  it("is a no-op after the game has already started", () => {
    const playing = startedState();
    expect(applyRunnerEvent(playing, { type: "START" })).toBe(playing);
  });
});

describe("answer cycle (pass)", () => {
  it("advances A → B → C → A and never changes lives or completion", () => {
    let state = startedState("easy", 1);
    const lives = state.lives;

    state = applyRunnerEvent(state, pass(state));
    expect(state.activeAnswerIndex).toBe(1);

    state = applyRunnerEvent(state, pass(state));
    expect(state.activeAnswerIndex).toBe(2);

    state = applyRunnerEvent(state, pass(state));
    expect(state.activeAnswerIndex).toBe(0);

    expect(state.lives).toBe(lives);
    expect(state.completedCount).toBe(0);
    expect(state.questionIndex).toBe(0);
  });

  it("supports multiple full cycles", () => {
    let state = startedState("easy", 1);
    for (let i = 0; i < 7; i += 1) {
      state = applyRunnerEvent(state, pass(state));
    }
    // 7 passes from index 0: 0→1→2→0→1→2→0→1 → 1
    expect(state.activeAnswerIndex).toBe(1);
    expect(state.status).toBe("playing");
  });
});

describe("correct hit", () => {
  it("advances exactly one question, preserves lives, increments completed count", () => {
    const state = startedState("easy", 2); // correct answer at index 0, active index 0
    const next = applyRunnerEvent(state, hit(state));
    expect(next.questionIndex).toBe(1);
    expect(next.completedCount).toBe(1);
    expect(next.lives).toBe(state.lives);
    expect(next.activeAnswerIndex).toBe(0);
    expect(next.itemSeq).toBe(state.itemSeq + 1);
  });

  it("final correct hit completes with no active answer", () => {
    const state = startedState("easy", 1);
    const next = applyRunnerEvent(state, hit(state));
    expect(next.status).toBe("completed");
    expect(next.activeAnswerIndex).toBeNull();
    expect(next.completedCount).toBe(1);
  });

  it("preserves jump state across a question change", () => {
    let state = startedState("easy", 2);
    state = applyRunnerEvent(state, { type: "JUMP" });
    expect(state.jumpState).toBe("airborne");
    const next = applyRunnerEvent(state, hit(state));
    expect(next.questionIndex).toBe(1);
    expect(next.jumpState).toBe("airborne");
  });

  it("uses the derived correct index, not the first choice", () => {
    const created = createRunnerState([question(0, 1), question(1, 1)], "easy");
    let state = applyRunnerEvent(created, { type: "START" });
    // correct answer is at index 1, active index 0 → a hit here is wrong
    state = applyRunnerEvent(state, hit(state));
    expect(state.status).toBe("playing");
    expect(state.questionIndex).toBe(0);
    expect(state.lives).toBe(2);
    // now active index advanced to 1 (the correct answer)
    state = applyRunnerEvent(state, hit(state));
    expect(state.questionIndex).toBe(1);
    expect(state.completedCount).toBe(1);
  });
});

describe("wrong hit", () => {
  it("loses exactly one life, stays on the same question, advances the answer", () => {
    const created = createRunnerState([question(0, 0)], "easy");
    let state = applyRunnerEvent(created, { type: "START" });
    // pass to active index 1 (a wrong answer for this question)
    state = applyRunnerEvent(state, pass(state));
    const before = state;
    const next = applyRunnerEvent(state, hit(state));
    expect(next.lives).toBe(before.lives - 1);
    expect(next.questionIndex).toBe(before.questionIndex);
    expect(next.completedCount).toBe(before.completedCount);
    expect(next.activeAnswerIndex).toBe(2);
    expect(next.itemSeq).toBe(before.itemSeq + 1);
    expect(next.status).toBe("playing");
  });
});

describe("game over", () => {
  it("wrong hit at 1 life reaches 0 and game-over with no active answer", () => {
    const created = createRunnerState([question(0, 0)], "hard"); // 1 life
    let state = applyRunnerEvent(created, { type: "START" });
    state = applyRunnerEvent(state, pass(state)); // active index 1 (wrong)
    const next = applyRunnerEvent(state, hit(state));
    expect(next.lives).toBe(0);
    expect(next.status).toBe("game-over");
    expect(next.activeAnswerIndex).toBeNull();
  });

  it("terminal states ignore every gameplay event", () => {
    const created = createRunnerState([question(0, 0)], "hard");
    let gameOver = applyRunnerEvent(created, { type: "START" });
    gameOver = applyRunnerEvent(gameOver, pass(gameOver));
    gameOver = applyRunnerEvent(gameOver, hit(gameOver));
    expect(gameOver.status).toBe("game-over");

    const snapshot = gameOver;
    expect(applyRunnerEvent(gameOver, { type: "TICK", deltaMs: 1000 })).toBe(snapshot);
    expect(applyRunnerEvent(gameOver, { type: "JUMP" })).toBe(snapshot);
    expect(applyRunnerEvent(gameOver, { type: "LAND" })).toBe(snapshot);
    expect(applyRunnerEvent(gameOver, { type: "HIT_ACTIVE_ITEM", itemSeq: snapshot.itemSeq })).toBe(
      snapshot,
    );
    expect(
      applyRunnerEvent(gameOver, { type: "PASS_ACTIVE_ITEM", itemSeq: snapshot.itemSeq }),
    ).toBe(snapshot);
  });
});

describe("skip (pass active item)", () => {
  it("never changes lives or completion", () => {
    const state = startedState("easy", 1);
    const next = applyRunnerEvent(state, pass(state));
    expect(next.lives).toBe(state.lives);
    expect(next.completedCount).toBe(state.completedCount);
  });
});

describe("pause / resume", () => {
  it("pauses, ignores gameplay during pause, resumes, and excludes paused time", () => {
    let state = startedState("easy", 2);
    state = applyRunnerEvent(state, { type: "TICK", deltaMs: 1000 });
    expect(state.elapsedMs).toBe(1000);

    const paused = applyRunnerEvent(state, { type: "PAUSE" });
    expect(paused.status).toBe("paused");

    expect(applyRunnerEvent(paused, { type: "TICK", deltaMs: 500 })).toBe(paused);
    expect(applyRunnerEvent(paused, hit(paused))).toBe(paused);
    expect(applyRunnerEvent(paused, pass(paused))).toBe(paused);
    expect(applyRunnerEvent(paused, { type: "JUMP" })).toBe(paused);
    expect(applyRunnerEvent(paused, { type: "LAND" })).toBe(paused);

    const resumed = applyRunnerEvent(paused, { type: "RESUME" });
    expect(resumed.status).toBe("playing");
    expect(resumed.elapsedMs).toBe(1000);

    const afterResume = applyRunnerEvent(resumed, { type: "TICK", deltaMs: 700 });
    expect(afterResume.elapsedMs).toBe(1700);
  });

  it("pause and resume are no-ops outside the expected status", () => {
    const ready = createRunnerState([question(0)], "easy");
    expect(applyRunnerEvent(ready, { type: "PAUSE" })).toBe(ready);
    expect(applyRunnerEvent(ready, { type: "RESUME" })).toBe(ready);
  });
});

describe("timer", () => {
  it("accumulates deterministic integer milliseconds", () => {
    let state = startedState("easy", 1);
    state = applyRunnerEvent(state, { type: "TICK", deltaMs: 16.7 });
    expect(state.elapsedMs).toBe(16);
    state = applyRunnerEvent(state, { type: "TICK", deltaMs: 16.7 });
    expect(state.elapsedMs).toBe(32);
  });

  it("ignores negative, NaN and Infinity deltas", () => {
    const state = startedState("easy", 1);
    const before = state.elapsedMs;
    expect(applyRunnerEvent(state, { type: "TICK", deltaMs: -1 })).toBe(state);
    expect(applyRunnerEvent(state, { type: "TICK", deltaMs: Number.NaN })).toBe(state);
    expect(applyRunnerEvent(state, { type: "TICK", deltaMs: Number.POSITIVE_INFINITY })).toBe(
      state,
    );
    expect(applyRunnerEvent(state, { type: "TICK", deltaMs: Number.NEGATIVE_INFINITY })).toBe(
      state,
    );
    expect(state.elapsedMs).toBe(before);
  });

  it("does not accrue before START or in terminal states", () => {
    const ready = createRunnerState([question(0)], "easy");
    expect(applyRunnerEvent(ready, { type: "TICK", deltaMs: 1000 })).toBe(ready);

    let completed = startedState("easy", 1);
    completed = applyRunnerEvent(completed, hit(completed));
    expect(completed.status).toBe("completed");
    expect(applyRunnerEvent(completed, { type: "TICK", deltaMs: 1000 })).toBe(completed);
  });
});

describe("jump", () => {
  it("grounded jump accepted; second jump airborne ignored; LAND grounds; jump again", () => {
    const state = startedState("easy", 2);
    const airborne = applyRunnerEvent(state, { type: "JUMP" });
    expect(airborne.jumpState).toBe("airborne");

    expect(applyRunnerEvent(airborne, { type: "JUMP" })).toBe(airborne);

    const grounded = applyRunnerEvent(airborne, { type: "LAND" });
    expect(grounded.jumpState).toBe("grounded");

    expect(applyRunnerEvent(grounded, { type: "LAND" })).toBe(grounded);

    const airborneAgain = applyRunnerEvent(grounded, { type: "JUMP" });
    expect(airborneAgain.jumpState).toBe("airborne");
  });

  it("jump state survives a question change", () => {
    let state = startedState("easy", 2);
    state = applyRunnerEvent(state, { type: "JUMP" });
    const next = applyRunnerEvent(state, hit(state));
    expect(next.questionIndex).toBe(1);
    expect(next.jumpState).toBe("airborne");
  });

  it("JUMP and LAND are no-ops in ready and terminal states", () => {
    const ready = createRunnerState([question(0)], "easy");
    expect(applyRunnerEvent(ready, { type: "JUMP" })).toBe(ready);
    expect(applyRunnerEvent(ready, { type: "LAND" })).toBe(ready);

    let completed = startedState("easy", 1);
    completed = applyRunnerEvent(completed, hit(completed));
    expect(applyRunnerEvent(completed, { type: "JUMP" })).toBe(completed);
    expect(applyRunnerEvent(completed, { type: "LAND" })).toBe(completed);
  });
});

describe("duplicate-event safety", () => {
  it("a second HIT with the previous itemSeq is ignored", () => {
    let state = startedState("easy", 3);
    const staleSeq = state.itemSeq;
    state = applyRunnerEvent(state, hit(state)); // advances question 0 → 1
    expect(state.questionIndex).toBe(1);
    const duplicate = applyRunnerEvent(state, { type: "HIT_ACTIVE_ITEM", itemSeq: staleSeq });
    expect(duplicate).toBe(state);
    expect(duplicate.questionIndex).toBe(1);
  });

  it("a second PASS with the previous itemSeq is ignored", () => {
    let state = startedState("easy", 1);
    const staleSeq = state.itemSeq;
    state = applyRunnerEvent(state, pass(state)); // active 0 → 1
    expect(state.activeAnswerIndex).toBe(1);
    const duplicate = applyRunnerEvent(state, { type: "PASS_ACTIVE_ITEM", itemSeq: staleSeq });
    expect(duplicate).toBe(state);
    expect(duplicate.activeAnswerIndex).toBe(1);
  });

  it("terminal states ignore HIT/PASS", () => {
    let state = startedState("easy", 1);
    state = applyRunnerEvent(state, hit(state));
    expect(state.status).toBe("completed");
    const snapshot = state;
    expect(applyRunnerEvent(state, { type: "HIT_ACTIVE_ITEM", itemSeq: state.itemSeq })).toBe(
      snapshot,
    );
    expect(applyRunnerEvent(state, { type: "PASS_ACTIVE_ITEM", itemSeq: state.itemSeq })).toBe(
      snapshot,
    );
  });
});

describe("feedback", () => {
  it("correct feedback carries questionIndex and itemSeq", () => {
    const state = startedState("easy", 2);
    const seq = state.itemSeq;
    const next = applyRunnerEvent(state, hit(state));
    expect(next.feedback).toEqual({ kind: "correct", questionIndex: 0, itemSeq: seq });
  });

  it("wrong feedback carries questionIndex and itemSeq", () => {
    const created = createRunnerState([question(0, 0)], "easy");
    let state = applyRunnerEvent(created, { type: "START" });
    state = applyRunnerEvent(state, pass(state)); // active index 1 (wrong)
    const seq = state.itemSeq;
    const next = applyRunnerEvent(state, hit(state));
    expect(next.feedback).toEqual({ kind: "wrong", questionIndex: 0, itemSeq: seq });
  });

  it("PASS, TICK and JUMP never modify feedback", () => {
    const created = createRunnerState([question(0, 0)], "easy");
    let state = applyRunnerEvent(created, { type: "START" });
    state = applyRunnerEvent(state, pass(state));
    state = applyRunnerEvent(state, hit(state)); // wrong hit → feedback set
    const feedback = state.feedback;
    const afterPass = applyRunnerEvent(state, pass(state));
    expect(afterPass.feedback).toBe(feedback);
    const afterTick = applyRunnerEvent(state, { type: "TICK", deltaMs: 50 });
    expect(afterTick.feedback).toBe(feedback);
    const afterJump = applyRunnerEvent(state, { type: "JUMP" });
    expect(afterJump.feedback).toBe(feedback);
  });

  it("the next HIT overwrites feedback", () => {
    const created = createRunnerState([question(0, 0), question(1, 0)], "easy");
    let state = applyRunnerEvent(created, { type: "START" });
    state = applyRunnerEvent(state, pass(state)); // active 1 (wrong)
    state = applyRunnerEvent(state, hit(state)); // wrong → feedback wrong on q0
    expect(state.feedback?.kind).toBe("wrong");
    // the wrong hit advanced the active answer to index 2; one pass cycles to
    // index 0 (the correct answer) so the next hit is correct.
    state = applyRunnerEvent(state, pass(state)); // 2 → 0 (correct)
    state = applyRunnerEvent(state, hit(state)); // correct → feedback correct on q0
    expect(state.feedback?.kind).toBe("correct");
    expect(state.questionIndex).toBe(1);
  });
});

describe("invariants", () => {
  it("lives never go below zero", () => {
    const created = createRunnerState([question(0, 1)], "hard");
    let state = applyRunnerEvent(created, { type: "START" });
    for (let i = 0; i < 10; i += 1) {
      state = applyRunnerEvent(state, hit(state));
    }
    expect(state.lives).toBeGreaterThanOrEqual(0);
    expect(state.status).toBe("game-over");
  });

  it("questionIndex stays within range and completedCount never decreases", () => {
    let state = startedState("easy", 3);
    let prevCompleted = 0;
    for (let i = 0; i < 20; i += 1) {
      state = applyRunnerEvent(state, hit(state));
      expect(state.questionIndex).toBeGreaterThanOrEqual(0);
      expect(state.questionIndex).toBeLessThan(state.questions.length);
      expect(state.completedCount).toBeGreaterThanOrEqual(prevCompleted);
      prevCompleted = state.completedCount;
      if (state.status !== "playing") break;
    }
  });

  it("answerIndex stays within 0..2 while playing and elapsedMs never decreases", () => {
    let state = startedState("easy", 2);
    let prevElapsed = 0;
    for (let i = 0; i < 10; i += 1) {
      state = applyRunnerEvent(state, { type: "TICK", deltaMs: 100 });
      state = applyRunnerEvent(state, pass(state));
      if (state.activeAnswerIndex !== null) {
        expect(state.activeAnswerIndex).toBeGreaterThanOrEqual(0);
        expect(state.activeAnswerIndex).toBeLessThanOrEqual(2);
      }
      expect(state.elapsedMs).toBeGreaterThanOrEqual(prevElapsed);
      prevElapsed = state.elapsedMs;
    }
  });

  it("wrong hit never advances the question and pass never changes lives", () => {
    const created = createRunnerState([question(0, 0)], "easy");
    let state = applyRunnerEvent(created, { type: "START" });
    state = applyRunnerEvent(state, pass(state)); // active 1 (wrong)
    const livesBefore = state.lives;
    const qBefore = state.questionIndex;
    const next = applyRunnerEvent(state, hit(state));
    expect(next.questionIndex).toBe(qBefore);
    const afterPass = applyRunnerEvent(next, pass(next));
    expect(afterPass.lives).toBe(livesBefore - 1);
  });
});
