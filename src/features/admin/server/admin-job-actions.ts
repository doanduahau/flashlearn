"use server";

import { revalidatePath } from "next/cache";

import {
  AdminAuthorizationError,
  requireAdminPermission,
} from "@/features/admin/server/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export type JobMutationResult =
  { ok: true; job_id: string; status: string } | { ok: false; error: string };

function adminError(message: string): JobMutationResult {
  return { ok: false, error: message };
}

/**
 * Retry a failed processing job. Only allowlisted job kinds are retried.
 * Requires: jobs.retry permission (support, owner).
 */
export async function adminRetryProcessingJob(
  jobId: string,
  reason: string,
  correlationId?: string,
): Promise<JobMutationResult> {
  try {
    const identity = await requireAdminPermission("jobs.retry");
    const admin = createAdminClient();

    const { data, error } = await admin.rpc("admin_retry_processing_job", {
      p_actor_user_id: identity.userId,
      p_job_id: jobId,
      p_reason: reason,
      ...(correlationId && { p_correlation_id: correlationId }),
    });

    if (error) {
      const msg = error.message;
      if (msg.includes("can only retry failed"))
        return adminError("Chỉ có thể thử lại công việc ở trạng thái lỗi.");
      if (msg.includes("job kind not allowed"))
        return adminError("Loại công việc này không được phép thử lại.");
      if (msg.includes("reason required")) return adminError("Vui lòng nhập lý do.");
      return adminError(`Không thể thử lại: ${msg}`);
    }

    const row = data?.[0];
    if (!row) return adminError("Không có kết quả từ server.");

    revalidatePath("/admin/jobs");
    return { ok: true, job_id: row.job_id, status: row.status };
  } catch (error) {
    if (error instanceof AdminAuthorizationError)
      return adminError("Không có quyền thử lại công việc.");
    return adminError("Lỗi server khi thử lại công việc.");
  }
}
