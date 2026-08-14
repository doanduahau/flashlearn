import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RunnerHud } from "@/features/runner/components/runner-hud";

describe("RunnerHud", () => {
  it("renders the correct number of hearts for the lives", () => {
    render(
      <RunnerHud
        lives={3}
        elapsedMs={0}
        questionNumber={1}
        totalQuestions={12}
        question="Prompt"
      />,
    );
    expect(screen.getByRole("img", { name: "3 mạng" })).toBeInTheDocument();
  });

  it("renders question progress", () => {
    render(
      <RunnerHud
        lives={2}
        elapsedMs={0}
        questionNumber={3}
        totalQuestions={12}
        question="Prompt"
      />,
    );
    expect(screen.getByText("Câu 3 / 12")).toBeInTheDocument();
  });

  it("renders the formatted timer", () => {
    render(
      <RunnerHud
        lives={2}
        elapsedMs={61_000}
        questionNumber={1}
        totalQuestions={12}
        question="Prompt"
      />,
    );
    expect(screen.getByLabelText("Thời gian")).toHaveTextContent("01:01");
  });

  it("renders the question front text", () => {
    render(
      <RunnerHud
        lives={2}
        elapsedMs={0}
        questionNumber={1}
        totalQuestions={12}
        question="Front text"
      />,
    );
    expect(screen.getByText("Front text")).toHaveClass("text-center", "text-lg", "sm:text-xl");
  });
});
