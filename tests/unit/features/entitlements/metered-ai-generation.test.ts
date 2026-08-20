import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  startProcessingJob: vi.fn(),
  loadProcessingJobOutput: vi.fn(),
  reserveUsage: vi.fn(),
  finalizeUsage: vi.fn(),
  generateCards: vi.fn(),
  runProcessingJobPhase: vi.fn(),
  finishProcessingJob: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  rateLimitMessage: () => "limited",
  subjectRateLimitKey: (_scope: string, userId: string) => userId,
}));
vi.mock("@/features/entitlements/server/entitlement-service", () => ({
  getEffectivePlan: vi.fn().mockResolvedValue("free"),
  reserveUsage: mocks.reserveUsage,
  finalizeUsage: mocks.finalizeUsage,
  refundUsage: vi.fn(),
}));
vi.mock("@/features/entitlements/server/processing-job-service", () => ({
  startProcessingJob: mocks.startProcessingJob,
  loadProcessingJobOutput: mocks.loadProcessingJobOutput,
  runProcessingJobPhase: mocks.runProcessingJobPhase,
  linkJobReservation: vi.fn(),
  storeProcessingJobOutput: vi.fn(),
  finishProcessingJob: mocks.finishProcessingJob,
}));
vi.mock("@/features/entitlements/server/provider-call-budget", () => ({
  createProviderCallBudget: vi.fn(() => ({ beforeCall: vi.fn(), afterCall: vi.fn() })),
}));
vi.mock("@/features/imports/adapters/gemini-provider", () => ({
  GeminiFlashcardGenerationProvider: class {
    generateCards(input: unknown) {
      return mocks.generateCards(input);
    }
  },
}));

import { runMeteredFlashcardGeneration } from "@/features/entitlements/server/metered-ai-generation";

const INPUT = {
  userId: "11111111-1111-4111-8111-111111111111",
  kind: "paste_generate" as const,
  source: "paste_prose" as const,
  text: "An educational paragraph",
  maximumCards: 100,
  idempotencyKey: "22222222-2222-4222-8222-222222222222",
  correlationId: "33333333-3333-4333-8333-333333333333",
};

describe("metered AI generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeRateLimit.mockResolvedValue({ ok: true });
    mocks.runProcessingJobPhase.mockImplementation((_job, operation) => operation());
    mocks.finishProcessingJob.mockResolvedValue(undefined);
  });

  it("replays cached output without a second reservation or provider call", async () => {
    mocks.startProcessingJob.mockResolvedValue({
      id: INPUT.idempotencyKey,
      status: "succeeded",
      replayed: true,
      physicalCallLimit: 5,
    });
    mocks.loadProcessingJobOutput.mockResolvedValue({
      outputKind: "flashcards",
      payload: [{ front: "Q", back: "A" }],
    });
    await expect(runMeteredFlashcardGeneration(INPUT)).resolves.toMatchObject({ replayed: true });
    expect(mocks.reserveUsage).not.toHaveBeenCalled();
    expect(mocks.generateCards).not.toHaveBeenCalled();
  });

  it("reserves estimated usage and finalizes actual credits once", async () => {
    mocks.startProcessingJob.mockResolvedValue({
      id: INPUT.idempotencyKey,
      status: "queued",
      replayed: false,
      physicalCallLimit: 5,
    });
    mocks.reserveUsage.mockResolvedValue({
      reservation_id: "44444444-4444-4444-8444-444444444444",
      reservation_status: "reserved",
      enforcementMode: "block",
      wouldBlock: false,
    });
    mocks.generateCards.mockResolvedValue([{ front: "Q", back: "A" }]);
    await expect(runMeteredFlashcardGeneration(INPUT)).resolves.toMatchObject({ replayed: false });
    expect(mocks.reserveUsage).toHaveBeenCalledOnce();
    expect(mocks.generateCards).toHaveBeenCalledOnce();
    expect(mocks.finalizeUsage).toHaveBeenCalledOnce();
    expect(mocks.finishProcessingJob).toHaveBeenCalledWith(
      expect.objectContaining({ status: "succeeded", outputItems: 1 }),
    );
  });
});
