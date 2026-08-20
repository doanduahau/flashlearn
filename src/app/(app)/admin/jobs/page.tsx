import { redirect } from "next/navigation";

import { JobRetryButton } from "@/features/admin/components/job-retry-button";
import {
  AdminAuthorizationError,
  requireAdminPermission,
} from "@/features/admin/server/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type JobRow = {
  id: string;
  user_id: string;
  job_kind: string;
  source_type: string | null;
  status: string;
  error_code: string | null;
  correlation_id: string;
  physical_calls: number;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

export default async function AdminJobsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    status?: string;
    page?: string;
  }>;
}>) {
  try {
    await requireAdminPermission("jobs.read");
  } catch (error) {
    if (error instanceof AdminAuthorizationError) redirect("/admin");
    throw error;
  }

  const params = await searchParams;
  const statusFilter = params.status || "failed";
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const admin = createAdminClient();

  let query = admin
    .from("processing_jobs")
    .select(
      "id, user_id, job_kind, source_type, status, error_code, correlation_id, physical_calls, created_at, updated_at, finished_at",
      { count: "exact" },
    );

  if (
    statusFilter &&
    ["failed", "reconcile_required", "running", "queued", "succeeded"].includes(statusFilter)
  ) {
    query = query.eq("status", statusFilter);
  }

  query = query.order("created_at", { ascending: false }).range(offset, offset + PAGE_SIZE - 1);

  const { data: jobs, count: totalCount, error } = await query;

  const totalPages = Math.ceil((totalCount ?? 0) / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string>) {
    const sp = new URLSearchParams();
    const s = overrides.status ?? statusFilter;
    if (s) sp.set("status", s);
    const p = overrides.page ?? String(page);
    if (p !== "1") sp.set("page", p);
    const qs = sp.toString();
    return `/admin/jobs${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">Công việc xử lý</h1>
        <p className="text-sm text-text-secondary">Xem danh sách công việc và trạng thái xử lý.</p>
      </header>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["failed", "Lỗi"],
            ["reconcile_required", "Cần xử lý"],
            ["running", "Đang chạy"],
            ["queued", "Đang chờ"],
            ["succeeded", "Thành công"],
          ] as const
        ).map(([value, label]) => (
          <a
            key={value}
            href={buildUrl({ status: value, page: "1" })}
            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === value
                ? "bg-primary text-primary-foreground"
                : "border border-border-soft bg-surface text-text-secondary hover:bg-surface-subtle"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {/* Results */}
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-border-soft bg-surface p-4 text-danger"
        >
          Không thể tải danh sách công việc.
        </div>
      ) : !jobs || jobs.length === 0 ? (
        <div className="rounded-2xl border border-border-soft bg-surface p-8 text-center text-text-secondary">
          Không có công việc nào với trạng thái này.
        </div>
      ) : (
        <>
          <p className="text-xs text-text-secondary">
            {(totalCount ?? 0).toLocaleString("vi-VN")} kết quả
            {totalPages > 1 ? ` · Trang ${page}/${totalPages}` : ""}
          </p>
          <div className="overflow-x-auto rounded-2xl border border-border-soft bg-surface shadow-soft-card">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-soft text-xs uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-3">Loại</th>
                  <th className="px-4 py-3">Nguồn</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Lỗi</th>
                  <th className="px-4 py-3">Correlation</th>
                  <th className="px-4 py-3">Lượt gọi</th>
                  <th className="px-4 py-3">Thao tác</th>
                  <th className="px-4 py-3">Tạo lúc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {jobs.map((job: JobRow) => (
                  <tr key={job.id} className="hover:bg-surface-subtle">
                    <td className="px-4 py-2.5 font-mono text-xs">{job.job_kind}</td>
                    <td className="px-4 py-2.5 text-xs">{job.source_type}</td>
                    <td className="px-4 py-2.5">
                      <JobStatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">
                      {job.error_code ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">
                      {job.correlation_id ? job.correlation_id.slice(0, 8) + "…" : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs">{job.physical_calls}</td>
                    <td className="px-4 py-2.5">
                      <JobRetryButton jobId={job.id} status={job.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-secondary">
                      {new Date(job.created_at).toLocaleString("vi-VN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-2" aria-label="Phân trang">
              {page > 1 && (
                <a
                  href={buildUrl({ page: String(page - 1) })}
                  className="rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-subtle"
                >
                  ← Trước
                </a>
              )}
              <span className="text-sm text-text-secondary">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <a
                  href={buildUrl({ page: String(page + 1) })}
                  className="rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-subtle"
                >
                  Tiếp →
                </a>
              )}
            </nav>
          )}
        </>
      )}

      <p className="text-xs text-text-secondary">
        🔒 Hiển thị mã lỗi an toàn. Không hiển thị nội dung thô từ nhà cung cấp.
      </p>
    </div>
  );
}

function JobStatusBadge({ status }: Readonly<{ status: string }>) {
  const styles: Record<string, string> = {
    failed: "bg-danger/10 text-danger",
    reconcile_required: "bg-warning/10 text-warning",
    running: "bg-info/10 text-info",
    queued: "bg-surface-subtle text-text-secondary",
    succeeded: "bg-success/10 text-success",
    cancelled: "bg-surface-subtle text-text-secondary",
    expired: "bg-surface-subtle text-text-secondary",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? styles.queued}`}
    >
      {status}
    </span>
  );
}
