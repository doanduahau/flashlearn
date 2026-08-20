import "server-only";

import {
  recordProviderCall,
  recordProviderTokens,
} from "@/features/entitlements/server/processing-job-service";

export type ProviderCallBudget = Readonly<{
  beforeCall(inputCharacters: number): Promise<void>;
  afterCall(usage: { inputTokens: number; outputTokens: number }): Promise<void>;
}>;

export function createProviderCallBudget(input: {
  jobId: string;
  userId: string;
}): ProviderCallBudget {
  return {
    async beforeCall(inputCharacters: number): Promise<void> {
      await recordProviderCall({
        jobId: input.jobId,
        userId: input.userId,
        inputCharacters,
      });
    },
    async afterCall(usage): Promise<void> {
      // A telemetry persistence outage must not discard a provider result that
      // was already paid for. The pre-call counter remains durable evidence for
      // reconciliation even when token metadata cannot be recorded.
      await recordProviderTokens({
        jobId: input.jobId,
        userId: input.userId,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      }).catch(() => undefined);
    },
  };
}
