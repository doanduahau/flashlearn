import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ addBreadcrumb: mocks.addBreadcrumb }));
vi.mock("@/lib/logger", () => ({ logger: { info: mocks.info } }));

import { bucketCount, recordImportTelemetry, recordTelemetry } from "@/lib/telemetry/telemetry";

describe("telemetry", () => {
  it("uses fixed, bucketed metadata instead of import content", () => {
    recordImportTelemetry({
      correlationId: "correlation-1",
      source: "paste",
      outcome: "succeeded",
      processingPath: "deterministic",
      inputSize: 782,
      outputCount: 12,
    });

    expect(mocks.info).toHaveBeenCalledWith("capystudy.import.processed", {
      correlationId: "correlation-1",
      source: "paste",
      outcome: "succeeded",
      processingPath: "deterministic",
      inputSizeBucket: "lte_1000",
      outputCountBucket: "lte_25",
    });
    expect(mocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "capystudy.telemetry",
        message: "capystudy.import.processed",
      }),
    );
  });

  it("does not break a request when telemetry sinks fail", () => {
    mocks.info.mockImplementationOnce(() => {
      throw new Error("logger unavailable");
    });
    mocks.addBreadcrumb.mockImplementationOnce(() => {
      throw new Error("sentry unavailable");
    });

    expect(() =>
      recordTelemetry({
        name: "capystudy.rate_limit.decided",
        correlationId: "correlation-2",
        policy: "import",
        outcome: "allowed",
        retryAfterBucket: "lte_0",
      }),
    ).not.toThrow();
  });

  it("keeps buckets low-cardinality", () => {
    expect(bucketCount(-5)).toBe("lte_0");
    expect(bucketCount(10_001)).toBe("gt_10000");
  });
});
