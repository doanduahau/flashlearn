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

  it("resolves a correct pair after the review window without completing", () => {
    const onComplete = vi.fn();
    render(<MemoryBoard batches={[BATCH]} questionCount={12} onComplete={onComplete} />);

    fireEvent.click(screen.getByTestId("a:front"));
    fireEvent.click(screen.getByTestId("a:back"));

    // Both stay flipped and previewable; no matched/celebration state yet.
    expect(screen.getByTestId("a:front")).toHaveAttribute("aria-label", "Đã lật");
    expect(screen.getByTestId("a:back")).toHaveAttribute("aria-label", "Đã lật");
    expect(screen.getByTestId("memory-preview")).toHaveTextContent("a-back");
    expect(document.querySelector(".confetti-piece")).toBeNull();

    // At 999ms the second tile is still visible and no celebration has started.
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.getByTestId("a:front")).toHaveAttribute("aria-label", "Đã lật");
    expect(screen.getByTestId("a:back")).toHaveAttribute("aria-label", "Đã lật");
    expect(screen.getByTestId("memory-preview")).toHaveTextContent("a-back");
    expect(document.querySelector(".confetti-piece")).toBeNull();

    // At exactly 1000ms the pair resolves and the celebration begins.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("a:front")).toHaveAttribute("aria-label", "Đã ghép đúng");
    expect(screen.getByTestId("a:back")).toHaveAttribute("aria-label", "Đã ghép đúng");
    expect(document.querySelector(".confetti-piece")).not.toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("ignores a third tap during the correct-pair review delay", () => {
    const onComplete = vi.fn();
    render(<MemoryBoard batches={[BATCH]} questionCount={12} onComplete={onComplete} />);

    fireEvent.click(screen.getByTestId("a:front"));
    fireEvent.click(screen.getByTestId("a:back"));
    fireEvent.click(screen.getByTestId("c:front"));

    expect(screen.getByTestId("c:front")).toHaveAttribute("aria-label", "Ô úp");
    expect(screen.getByTestId("a:front")).toHaveAttribute("aria-label", "Đã lật");
    expect(screen.getByTestId("a:back")).toHaveAttribute("aria-label", "Đã lật");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId("a:front")).toHaveAttribute("aria-label", "Đã ghép đúng");
    expect(screen.getByTestId("a:back")).toHaveAttribute("aria-label", "Đã ghép đúng");
    expect(screen.getByTestId("c:front")).toHaveAttribute("aria-label", "Ô úp");
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("stops the whole-session timer at final-pair detection before the review delay", () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    vi.setSystemTime(new Date("2026-08-13T00:00:00.000Z"));
    render(<MemoryBoard batches={[BATCH]} questionCount={6} onComplete={onComplete} />);

    const resolvePair = (cardId: string) => {
      fireEvent.click(screen.getByTestId(`${cardId}:front`));
      fireEvent.click(screen.getByTestId(`${cardId}:back`));
      act(() => vi.advanceTimersByTime(1000)); // correct-pending review delay
      act(() => vi.advanceTimersByTime(700)); // celebration delay
    };

    for (const cardId of ["a", "b", "c", "d", "e"]) resolvePair(cardId);

    // After 5 resolved pairs elapsed = 5 * (1000 + 700) = 8500ms.
    act(() => vi.advanceTimersByTime(85_000));
    fireEvent.click(screen.getByTestId("f:front"));
    fireEvent.click(screen.getByTestId("f:back"));

    // The timer freezes at the logical final-pair match (t = 93_500ms) and the
    // final pair still resolves visually before completion is reported.
    act(() => vi.advanceTimersByTime(999));
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByTestId("f:front")).toHaveAttribute("aria-label", "Đã lật");

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("f:front")).toHaveAttribute("aria-label", "Đã ghép đúng");
    expect(onComplete).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(700));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(93_500);

    // Neither the celebration nor further time changes the recorded elapsed.
    act(() => vi.advanceTimersByTime(1000));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(93_500);
  });
});
