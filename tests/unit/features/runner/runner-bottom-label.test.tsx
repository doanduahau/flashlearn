import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RunnerBottomLabel } from "@/features/runner/components/runner-bottom-label";

describe("RunnerBottomLabel", () => {
  it("keeps a fixed, centered reading area while preserving a long label", () => {
    const label = "Một đáp án rất dài vẫn phải hiển thị đầy đủ cho người chơi ở mọi màn hình";
    render(<RunnerBottomLabel label={label} />);

    const text = screen.getByText(label);
    expect(text).toHaveClass("text-xs", "text-center");
    expect(text).not.toHaveClass("truncate", "line-clamp-1", "line-clamp-2", "overflow-hidden");
    expect(text.parentElement).toHaveClass("h-20", "items-center", "justify-center");
  });
});
