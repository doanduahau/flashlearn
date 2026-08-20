import "server-only";

import type { Json } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { acquireHeavyJobSlot } from "@/lib/security/distributed-semaphore";

export type ProcessingJobKind =
  "paste_generate" | "google_sheets_generate" | "document_pipeline" | "typing_ai_review";
export type ProcessingJobSource =
  "paste_prose" | "google_sheets_semantic" | "docx" | "pdf" | "typing";
export type ReservationPurpose =
  "content_credit" | "typing_review" | "heavy_monthly" | "heavy_rolling_day";

export type ProcessingJob = Readonly<{
  id: string;
  status: string;
  replayed: boolean;
  physicalCallLimit: number;
}>;

function firstRow<T>(value: T[] | T | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function startProcessingJob(input: {
  userId: string;
  kind: ProcessingJobKind;
  source: ProcessingJobSource;
  idempotencyKey: string;
  correlationId: string;
}): Promise<ProcessingJob> {
  const { data, error } = await createAdminClient().rpc("start_processing_job", {
    p_user_id: input.userId,
    p_job_kind: input.kind,
    p_source_type: input.source,
    p_idempotency_key: input.idempotencyKey,
    p_correlation_id: input.correlationId,
  });
  const row = firstRow(data);
  if (error || !row) throw new Error("processing_job_start_failed");
  return {
    id: row.job_id,
    status: row.job_status,
    replayed: row.replayed,
    physicalCallLimit: row.physical_call_limit,
  };
}

export async function runProcessingJobPhase<T>(
  job: Pick<ProcessingJob, "id"> & { userId: string },
  operation: () => Promise<T>,
): Promise<T> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("begin_processing_job_phase", {
    p_job_id: job.id,
    p_user_id: job.userId,
  });
  const phase = firstRow(data);
  if (error || !phase) throw new Error("processing_job_concurrency_failed");

  const lease = await acquireHeavyJobSlot(job.userId, phase.concurrent_limit);
  try {
    return await operation();
  } finally {
    try {
      await lease.release();
    } finally {
      await admin.rpc("pause_processing_job", { p_job_id: job.id, p_user_id: job.userId });
    }
  }
}

export async function recordProviderCall(input: {
  jobId: string;
  userId: string;
  inputCharacters: number;
}): Promise<number> {
  const { data, error } = await createAdminClient().rpc("record_processing_job_call", {
    p_job_id: input.jobId,
    p_user_id: input.userId,
    p_input_characters: input.inputCharacters,
  });
  if (error || typeof data !== "number") throw new Error("physical_call_limit_exceeded");
  return data;
}

export async function recordProviderTokens(input: {
  jobId: string;
  userId: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const { error } = await createAdminClient().rpc("record_processing_job_tokens", {
    p_job_id: input.jobId,
    p_user_id: input.userId,
    p_provider_input_tokens: Math.max(0, Math.floor(input.inputTokens)),
    p_provider_output_tokens: Math.max(0, Math.floor(input.outputTokens)),
  });
  if (error) throw new Error("processing_job_token_record_failed");
}

export async function finishProcessingJob(input: {
  jobId: string;
  userId: string;
  status: "succeeded" | "failed" | "cancelled" | "expired" | "reconcile_required";
  errorCode?: string;
  outputItems?: number;
  providerInputTokens?: number;
  providerOutputTokens?: number;
}): Promise<void> {
  const { error } = await createAdminClient().rpc("finish_processing_job", {
    p_job_id: input.jobId,
    p_user_id: input.userId,
    p_status: input.status,
    p_error_code: input.errorCode,
    p_output_items: input.outputItems ?? 0,
    p_provider_input_tokens: input.providerInputTokens ?? 0,
    p_provider_output_tokens: input.providerOutputTokens ?? 0,
  });
  if (error) throw new Error("processing_job_finish_failed");
}

export async function linkJobReservation(input: {
  jobId: string;
  userId: string;
  reservationId: string;
  purpose: ReservationPurpose;
}): Promise<void> {
  const { error } = await createAdminClient().rpc("link_processing_job_reservation", {
    p_job_id: input.jobId,
    p_user_id: input.userId,
    p_reservation_id: input.reservationId,
    p_purpose: input.purpose,
  });
  if (error) throw new Error("processing_job_reservation_link_failed");
}

export async function storeTypingJobResults(input: {
  jobId: string;
  userId: string;
  results: Array<{ itemId: string; correct: boolean }>;
}): Promise<void> {
  const { error } = await createAdminClient().rpc("store_typing_ai_job_results", {
    p_job_id: input.jobId,
    p_user_id: input.userId,
    p_results: input.results.map((result) => ({
      item_id: result.itemId,
      correct: result.correct,
    })) as Json,
  });
  if (error) throw new Error("typing_job_result_store_failed");
}

export async function loadTypingJobResults(
  jobId: string,
  userId: string,
): Promise<Array<{ itemId: string; correct: boolean }>> {
  const admin = createAdminClient();
  const { data: job, error: jobError } = await admin
    .from("processing_jobs")
    .select("id")
    .eq("id", jobId)
    .eq("user_id", userId)
    .eq("job_kind", "typing_ai_review")
    .maybeSingle();
  if (jobError || !job) throw new Error("typing_job_result_ownership_failed");
  const { data, error } = await admin
    .from("typing_ai_job_results")
    .select("item_id, correct")
    .eq("job_id", jobId);
  if (error) throw new Error("typing_job_result_load_failed");
  return (data ?? []).map((row) => ({ itemId: row.item_id, correct: row.correct }));
}

export async function storeProcessingJobOutput(input: {
  jobId: string;
  userId: string;
  outputKind: "flashcards" | "document_analysis";
  payload: Json;
}): Promise<void> {
  const admin = createAdminClient();
  const { data: job, error: jobError } = await admin
    .from("processing_jobs")
    .select("id")
    .eq("id", input.jobId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (jobError || !job) throw new Error("processing_job_output_ownership_failed");
  const { error } = await admin.from("processing_job_outputs").upsert({
    job_id: input.jobId,
    output_kind: input.outputKind,
    payload: input.payload,
  });
  if (error) throw new Error("processing_job_output_store_failed");
}

export async function loadProcessingJobOutput(
  jobId: string,
  userId: string,
  outputKind: "flashcards" | "document_analysis" = "flashcards",
): Promise<{ outputKind: string; payload: Json } | null> {
  const admin = createAdminClient();
  const { data: job, error: jobError } = await admin
    .from("processing_jobs")
    .select("id")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  if (jobError || !job) throw new Error("processing_job_output_ownership_failed");
  const { data, error } = await admin
    .from("processing_job_outputs")
    .select("output_kind, payload, expires_at")
    .eq("job_id", jobId)
    .eq("output_kind", outputKind)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error("processing_job_output_load_failed");
  return data ? { outputKind: data.output_kind, payload: data.payload } : null;
}
