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
});
