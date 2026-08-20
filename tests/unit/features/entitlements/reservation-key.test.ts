import { describe, expect, it } from "vitest";

import { stageReservationKey } from "@/features/entitlements/utils/reservation-key";

describe("stageReservationKey", () => {
  const jobId = "aaaaaaaa-0000-4000-8000-000000000001";

  it("returns a valid UUID-shaped string", () => {
    const key = stageReservationKey(jobId, "analyze");
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("is deterministic for the same job and stage", () => {
    expect(stageReservationKey(jobId, "analyze")).toBe(stageReservationKey(jobId, "analyze"));
  });

  it("produces distinct keys for different stages of the same job", () => {
    expect(stageReservationKey(jobId, "analyze")).not.toBe(stageReservationKey(jobId, "generate"));
  });

  it("produces distinct keys for different jobs in the same stage", () => {
    expect(stageReservationKey(jobId, "generate")).not.toBe(
      stageReservationKey("bbbbbbbb-0000-4000-8000-000000000002", "generate"),
    );
  });

  it("is stable across the version-5 namespace (fixed test vector)", () => {
    // The namespace mirrors UUIDv5 semantics: SHA-1 of namespace bytes + name.
    expect(stageReservationKey(jobId, "analyze")).toBe("09ea44ef-34f4-5da4-8646-68f90a8c4130");
  });
});
