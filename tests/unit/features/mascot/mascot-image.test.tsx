import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MascotImage } from "@/features/mascot/components/mascot-image";

describe("MascotImage", () => {
  it("renders every mascot state as a decorative fixed-size image", () => {
    const states = [
      "normal",
      "happy",
      "sad",
      "congrats",
      "run",
      "thinking",
      "point-right",
    ] as const;

    for (const state of states) {
      const { container, unmount } = render(<MascotImage level={3} state={state} size={48} />);
      const image = container.querySelector("img");

      expect(image).toHaveAttribute("src", `/mascot/level-3/${state}.png`);
      expect(image).toHaveAttribute("alt", "");
      expect(image).toHaveAttribute("aria-hidden", "true");
      expect(image).toHaveAttribute("width", "48");
      expect(image).toHaveAttribute("height", "48");
      expect(image).toHaveAttribute("loading", "lazy");
      unmount();
    }
  });
});
