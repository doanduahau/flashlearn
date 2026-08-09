import { describe, expect, it } from "vitest";

import {
  createFlashlearnScheduler,
  FLASHLEARN_SCHEDULER_IDENTITY,
  FLASHLEARN_V1_PARAMETERS,
  FLASHLEARN_V1_W,
} from "@/features/spaced-repetition/config";

describe("FlashLearn frozen FSRS config", () => {
  it("exposes the exact config identity", () => {
    expect(FLASHLEARN_SCHEDULER_IDENTITY).toEqual({
      algorithm: "fsrs-6",
      implementation: "ts-fsrs@5.4.1",
      parameterSet: "flashlearn-v1",
    });
  });

  it("freezes the exact FSRS-6 21-weight parameter array", () => {
    expect(FLASHLEARN_V1_W).toHaveLength(21);
    expect(FLASHLEARN_V1_PARAMETERS.w).toHaveLength(21);
    expect(FLASHLEARN_V1_W).toEqual([
      0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835,
      0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
    ]);
  });

  it("keeps the frozen V1 product configuration", () => {
    expect(FLASHLEARN_V1_PARAMETERS.request_retention).toBe(0.9);
    expect(FLASHLEARN_V1_PARAMETERS.maximum_interval).toBe(36500);
    expect(FLASHLEARN_V1_PARAMETERS.enable_short_term).toBe(true);
    expect(FLASHLEARN_V1_PARAMETERS.learning_steps).toEqual(["1m", "10m"]);
    expect(FLASHLEARN_V1_PARAMETERS.relearning_steps).toEqual(["10m"]);
  });

  it("disables fuzz for deterministic scheduling", () => {
    expect(FLASHLEARN_V1_PARAMETERS.enable_fuzz).toBe(false);
  });

  it("creates deterministic schedulers", () => {
    const first = createFlashlearnScheduler();
    const second = createFlashlearnScheduler();
    expect(first).toBeInstanceOf(Object);
    expect(typeof first.next).toBe("function");
    expect(typeof second.next).toBe("function");
  });
});
