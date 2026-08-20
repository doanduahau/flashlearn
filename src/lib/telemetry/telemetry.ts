import { randomUUID } from "node:crypto";

import * as Sentry from "@sentry/nextjs";

import { logger } from "@/lib/logger";

export type TelemetryCorrelationId = string;

export type DocumentOperation = "extract" | "analyze" | "generate";
export type ImportSource = "paste" | "document" | "google_sheets" | "workbook";
export type TelemetryOutcome = "succeeded" | "rejected" | "failed" | "degraded";
export type ProcessingPath = "deterministic" | "ai" | "mixed" | "not_applicable";
export type RateLimitTelemetryPolicy =
  | "authSignIn"
  | "authSignUp"
  | "import"
  | "importPro"
  | "aiGeneration"
  | "aiGenerationFree"
  | "aiGenerationPro"
  | "googleSheets"
  | "learningSubmit"
  | "catalogInstallFree"
  | "catalogInstallPro"
  | "publicShare";

type TelemetryEvent =
  | {
      name: "capystudy.import.processed";
      correlationId: TelemetryCorrelationId;
      source: ImportSource;
      outcome: TelemetryOutcome;
      processingPath: ProcessingPath;
      inputSizeBucket: string;
      outputCountBucket: string;
    }
  | {
      name: "capystudy.document.processed";
      correlationId: TelemetryCorrelationId;
      operation: DocumentOperation;
      outcome: TelemetryOutcome;
      processingPath: ProcessingPath;
      inputSizeBucket: string;
      outputCountBucket: string;
    }
  | {
      name: "capystudy.rate_limit.decided";
      correlationId: TelemetryCorrelationId;
      policy: RateLimitTelemetryPolicy;
      outcome: "allowed" | "limited" | "unavailable";
      retryAfterBucket: string;
    }
  | {
      name: "capystudy.quota.decided";
      correlationId: TelemetryCorrelationId;
      resource: "import" | "document_ai" | "typing_ai" | "storage";
      mode: "observe" | "warn" | "block";
      outcome: "allowed" | "warning" | "denied";
    }
  | {
      name: "capystudy.provisioning.completed";
      correlationId: TelemetryCorrelationId;
      outcome: "completed" | "partial" | "failed" | "unavailable";
      createdCountBucket: string;
      missingCountBucket: string;
    };

const COUNT_BUCKETS = [0, 1, 10, 25, 50, 100, 500, 1_000, 5_000, 10_000] as const;

export function createTelemetryCorrelationId(): TelemetryCorrelationId {
  return randomUUID();
}

export function bucketCount(value: number): string {
  const normalized = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  for (const limit of COUNT_BUCKETS) {
    if (normalized <= limit) return `lte_${limit}`;
  }
  return "gt_10000";
}

/**
 * Sends only a fixed, low-cardinality event shape. Telemetry is observational:
 * no failure in either sink may alter a user action.
 */
export function recordTelemetry(event: TelemetryEvent): void {
  const { name, ...context } = event;

  try {
    logger.info(name, context);
  } catch {
    // Logging is non-critical and must never break an authenticated mutation.
  }

  try {
    Sentry.addBreadcrumb({
      category: "capystudy.telemetry",
      level: "info",
      message: name,
      data: context,
    });
  } catch {
    // Sentry is optional in local and staging environments.
  }
}

export function recordImportTelemetry(input: {
  correlationId?: TelemetryCorrelationId;
  source: ImportSource;
  outcome: TelemetryOutcome;
  processingPath: ProcessingPath;
  inputSize: number;
  outputCount?: number;
}): TelemetryCorrelationId {
  const correlationId = input.correlationId ?? createTelemetryCorrelationId();
  recordTelemetry({
    name: "capystudy.import.processed",
    correlationId,
    source: input.source,
    outcome: input.outcome,
    processingPath: input.processingPath,
    inputSizeBucket: bucketCount(input.inputSize),
    outputCountBucket: bucketCount(input.outputCount ?? 0),
  });
  return correlationId;
}

export function recordDocumentTelemetry(input: {
  correlationId?: TelemetryCorrelationId;
  operation: DocumentOperation;
  outcome: TelemetryOutcome;
  processingPath: ProcessingPath;
  inputSize: number;
  outputCount?: number;
}): TelemetryCorrelationId {
  const correlationId = input.correlationId ?? createTelemetryCorrelationId();
  recordTelemetry({
    name: "capystudy.document.processed",
    correlationId,
    operation: input.operation,
    outcome: input.outcome,
    processingPath: input.processingPath,
    inputSizeBucket: bucketCount(input.inputSize),
    outputCountBucket: bucketCount(input.outputCount ?? 0),
  });
  return correlationId;
}

export function recordRateLimitTelemetry(input: {
  policy: RateLimitTelemetryPolicy;
  outcome: "allowed" | "limited" | "unavailable";
  retryAfterSeconds?: number;
}): void {
  recordTelemetry({
    name: "capystudy.rate_limit.decided",
    correlationId: createTelemetryCorrelationId(),
    policy: input.policy,
    outcome: input.outcome,
    retryAfterBucket: bucketCount(input.retryAfterSeconds ?? 0),
  });
}
