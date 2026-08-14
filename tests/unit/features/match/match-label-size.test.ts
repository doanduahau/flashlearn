import { describe, expect, it } from "vitest";

import { getMatchLabelTextSize } from "@/features/match/utils/match-label-size";

describe("getMatchLabelTextSize", () => {
  it("returns large text for short labels", () => {
    expect(getMatchLabelTextSize("Short")).toBe("text-sm leading-snug sm:text-base");
    expect(getMatchLabelTextSize("Hello World")).toBe("text-sm leading-snug sm:text-base");
  });

  it("returns medium text for medium labels", () => {
    expect(getMatchLabelTextSize("This is a medium length sentence that fits here.")).toBe(
      "text-xs leading-snug sm:text-sm",
    );
  });

  it("returns small text for long labels", () => {
    const label =
      "This is a longer sentence that will take up quite a bit of space on the card so it should shrink.";
    expect(getMatchLabelTextSize(label)).toBe("text-[11px] leading-tight sm:text-xs");
  });

  it("returns extra small text for very long labels", () => {
    const label =
      "This is a very very very long label that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on.";
    expect(getMatchLabelTextSize(label)).toBe("text-[10px] leading-tight sm:text-[11px]");
  });
});
