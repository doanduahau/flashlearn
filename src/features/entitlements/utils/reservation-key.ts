import { createHash } from "node:crypto";

const RESERVATION_NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

/**
 * Derives a deterministic UUID idempotency key for a processing-job stage so a
 * multi-stage pipeline (analyze → generate) does not silently reuse the same
 * content-credit reservation across stages. Reservations carry a 15-minute
 * TTL; reusing one reservation for both stages made the second stage fail once
 * the reservation expired.
 */
export function stageReservationKey(jobId: string, stage: "analyze" | "generate"): string {
  const digest = createHash("sha1")
    .update(Buffer.from(RESERVATION_NAMESPACE, "utf8"))
    .update(Buffer.from(`${jobId}:${stage}`, "utf8"))
    .digest();
  digest[6] = (digest[6]! & 0x0f) | 0x50;
  digest[8] = (digest[8]! & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
