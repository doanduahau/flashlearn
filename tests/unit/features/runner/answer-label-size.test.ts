import { describe, expect, it } from "vitest";

import { getRunnerAnswerLabelTextSize } from "@/features/runner/utils/answer-label-size";

describe("getRunnerAnswerLabelTextSize", () => {
  it.each([
    ["", "text-lg"],
    ["12345678901234567890", "text-lg"],
    ["123456789012345678901", "text-base"],
    ["1234567890123456789012345678901234567890", "text-base"],
    ["12345678901234567890123456789012345678901", "text-sm"],
    ["123456789012345678901234567890123456789012345678901234567890", "text-sm"],
    ["1234567890123456789012345678901234567890123456789012345678901", "text-xs"],
  ] as const)("maps %j to %s at the length boundaries", (label, expected) => {
    expect(getRunnerAnswerLabelTextSize(label)).toBe(expected);
  });

  it("reduces the font tier for wide glyphs", () => {
    expect(getRunnerAnswerLabelTextSize("WWWWWWWWWWWWWWW")).toBe("text-base");
    expect(getRunnerAnswerLabelTextSize("mmmmmmmmmmmmmmm")).toBe("text-base");
  });
});
