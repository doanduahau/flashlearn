import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryBoard } from "@/features/memory/components/memory-board";
import type { MemoryBatch } from "@/features/memory/types/memory-types";

function batchFor(cardIds: string[]): MemoryBatch {
  return {
    tiles: cardIds.flatMap((cardId) => [
      { key: `${cardId}:front`, cardId, side: "front" as const, content: `${cardId}-front` },
      { key: `${cardId}:back`, cardId, side: "back" as const, content: `${cardId}-back` },
    ]),
  };
}

const BATCH = batchFor(["a", "b", "c", "d", "e", "f"]);

describe("MemoryBoard mismatch timing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps both tiles flipped at 999ms and flips them down at 1000ms", () => {
    const onComplete = vi.fn();
    render(<MemoryBoard batches={[BATCH]} questionCount={12} onComplete={onComplete} />);

    fireEvent.click(screen.getByTestId("a:front"));
    expect(screen.getByTestId("a:front")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByTestId("b:back"));
    expect(screen.getByTestId("a:front")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("b:back")).toHaveAttribute("aria-pressed", "true");

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.getByTestId("a:front")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("b:back")).toHaveAttribute("aria-pressed", "true");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("a:front")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("b:back")).toHaveAttribute("aria-pressed", "false");
  });

  it("resolves a correct pair after the celebration window without completing", () => {
    const onComplete = vi.fn();
    render(<MemoryBoard batches={[BATCH]} questionCount={12} onComplete={onComplete} />);

    fireEvent.click(screen.getByTestId("a:front"));
    fireEvent.click(screen.getByTestId("a:back"));
    expect(screen.getByTestId("a:front")).toHaveAttribute("aria-pressed", "true");

    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.getByTestId("a:front")).toHaveAttribute("aria-pressed", "true");
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("stops the whole-session timer at final-pair resolution before any celebration delay", () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    vi.setSystemTime(new Date("2026-08-13T00:00:00.000Z"));
    render(<MemoryBoard batches={[BATCH]} questionCount={6} onComplete={onComplete} />);

    for (const cardId of ["a", "b", "c", "d", "e"]) {
      fireEvent.click(screen.getByTestId(`${cardId}:front`));
      fireEvent.click(screen.getByTestId(`${cardId}:back`));
      act(() => vi.advanceTimersByTime(700));
    }
    act(() => vi.advanceTimersByTime(57_700));
    fireEvent.click(screen.getByTestId("f:front"));
    fireEvent.click(screen.getByTestId("f:back"));

    // The final pair occurs at 61.2s; completion must not wait for or include
    // a final celebration transition.
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(61_200);
    act(() => vi.advanceTimersByTime(700));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
