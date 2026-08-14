import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RunnerSession } from "@/features/runner/components/runner-session";
import type { RunnerQuestion } from "@/features/runner/types/runner-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

const QUESTIONS: RunnerQuestion[] = [
  {
    flashcardId: "a",
    front: "Prompt 1",
    correctAnswer: "Answer 1",
    choices: ["Answer 1", "Wrong A", "Wrong B"],
  },
  {
    flashcardId: "b",
    front: "Prompt 2",
    correctAnswer: "Answer 2",
    choices: ["Answer 2", "Wrong C", "Wrong D"],
  },
];

function stub2dContext() {
  return {
    setTransform: () => {},
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    arc: () => {},
    fill: () => {},
    drawImage: () => {},
    save: () => {},
    restore: () => {},
    strokeStyle: "",
    lineWidth: 1,
    fillStyle: "",
    globalAlpha: 1,
  };
}

function setVisibility(state: "hidden" | "visible"): void {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("RunnerSession", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      stub2dContext() as unknown as CanvasRenderingContext2D,
    );
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })),
    );
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 300,
      height: 400,
      top: 0,
      left: 0,
      right: 300,
      bottom: 400,
      toJSON: () => ({}),
    } as DOMRect);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the start overlay and starts playing on tap", () => {
    render(<RunnerSession questions={QUESTIONS} difficulty="medium" mascotLevel={1} />);

    expect(screen.getByText("Chạm để bắt đầu")).toBeInTheDocument();
    expect(screen.getByText(/Vừa · 2 mạng/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Chạm để bắt đầu" }));
    expect(screen.getByText("Câu 1 / 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Thời gian")).toHaveTextContent("00:00");
    expect(screen.queryByText("Chạm để bắt đầu")).toBeNull();
  });

  it("counts the timer up while playing", () => {
    render(<RunnerSession questions={QUESTIONS} difficulty="medium" mascotLevel={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Chạm để bắt đầu" }));

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByLabelText("Thời gian")).toHaveTextContent("00:01");
  });

  it("dispatches JUMP on pointerdown without crashing", () => {
    render(<RunnerSession questions={QUESTIONS} difficulty="medium" mascotLevel={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Chạm để bắt đầu" }));

    fireEvent.pointerDown(screen.getByTestId("runner-play-area"));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByText("Câu 1 / 2")).toBeInTheDocument();
  });

  it("pauses when the tab hides and stops the timer", () => {
    render(<RunnerSession questions={QUESTIONS} difficulty="medium" mascotLevel={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Chạm để bắt đầu" }));
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.getByLabelText("Thời gian")).toHaveTextContent("00:01");

    act(() => {
      setVisibility("hidden");
    });
    expect(screen.getByText("Tạm dừng — quay lại để tiếp tục")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByLabelText("Thời gian")).toHaveTextContent("00:01");
  });

  it("cleans up on unmount without errors", () => {
    const { unmount } = render(
      <RunnerSession questions={QUESTIONS} difficulty="medium" mascotLevel={1} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Chạm để bắt đầu" }));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(() => unmount()).not.toThrow();
  });
});
