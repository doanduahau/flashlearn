import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useVisibilityPause } from "@/features/learning-modes/hooks/use-visibility-pause";

function setDocumentHidden(hidden: boolean): void {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: hidden,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useVisibilityPause", () => {
  afterEach(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });

  it("starts unpaused", () => {
    const { result } = renderHook(() => useVisibilityPause());
    expect(result.current.isPaused).toBe(false);
  });

  it("pauses when the tab becomes hidden", () => {
    const { result } = renderHook(() => useVisibilityPause());

    act(() => setDocumentHidden(true));

    expect(result.current.isPaused).toBe(true);
  });

  it("resumes when the tab becomes visible again", () => {
    const { result } = renderHook(() => useVisibilityPause());

    act(() => setDocumentHidden(true));
    act(() => setDocumentHidden(false));

    expect(result.current.isPaused).toBe(false);
  });

  it("exposes a manual resume action", () => {
    const { result } = renderHook(() => useVisibilityPause());

    act(() => setDocumentHidden(true));
    act(() => result.current.resume());

    expect(result.current.isPaused).toBe(false);
  });

  it("exposes a manual pause action", () => {
    const { result } = renderHook(() => useVisibilityPause());

    act(() => result.current.pause());

    expect(result.current.isPaused).toBe(true);
  });
});
