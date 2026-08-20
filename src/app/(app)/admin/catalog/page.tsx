import Link from "next/link";
import { redirect } from "next/navigation";

import { CatalogActionsCell } from "@/features/admin/components/catalog-actions-cell";
import {
  AdminAuthorizationError,
  requireAdminPermission,
} from "@/features/admin/server/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type CatalogSetRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  version: number;
  is_starter: boolean;
  language_front: string;
  language_back: string;
  card_count?: number;
  install_count?: number;
  created_at: string;
  updated_at: string;
};

export default async function AdminCatalogPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
}>) {
  try {
    await requireAdminPermission("catalog.read");
  } catch (error) {
    if (error instanceof AdminAuthorizationError) redirect("/admin");
    throw error;
  }

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const statusFilter = params.status || "";
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const admin = createAdminClient();

  // Build query
  let query = admin
    .from("catalog_sets")
    .select(
      "id, title, slug, status, version, is_starter, language_front, language_back, created_at, updated_at",
      { count: "exact" },
    );

  if (q) {
    query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);
  }
  if (statusFilter && ["draft", "published", "archived"].includes(statusFilter)) {
    query = query.eq("status", statusFilter);
  }

  query = query.order("updated_at", { ascending: false }).range(offset, offset + PAGE_SIZE - 1);

  const { data: sets, count: totalCount, error } = await query;

  const totalPages = Math.ceil((totalCount ?? 0) / PAGE_SIZE);

  // Get card counts and install counts for visible sets
  let enrichedSets: CatalogSetRow[] = (sets as CatalogSetRow[]) ?? [];
  if (enrichedSets.length > 0) {
    const setIds = enrichedSets.map((s) => s.id);

    const { data: cardCounts } = await admin
      .from("catalog_cards")
      .select("catalog_set_id")
      .in("catalog_set_id", setIds);

    const cardMap = new Map<string, number>();
    for (const row of cardCounts ?? []) {
      cardMap.set(row.catalog_set_id, (cardMap.get(row.catalog_set_id) ?? 0) + 1);
    }

    const { data: installCounts } = await admin
      .from("user_catalog_installs")
      .select("catalog_set_id")
      .in("catalog_set_id", setIds)
      .eq("status", "active");

    const installMap = new Map<string, number>();
    for (const row of installCounts ?? []) {
      installMap.set(row.catalog_set_id, (installMap.get(row.catalog_set_id) ?? 0) + 1);
    }

    enrichedSets = enrichedSets.map((s) => ({
      ...s,
      card_count: cardMap.get(s.id) ?? 0,
      install_count: installMap.get(s.id) ?? 0,
    }));
  }

  function buildUrl(overrides: Record<string, string>) {
    const sp = new URLSearchParams();
    if (overrides.q ?? q) sp.set("q", overrides.q ?? q);
    const s = overrides.status ?? statusFilter;
    if (s) sp.set("status", s);
    const p = overrides.page ?? String(page);
    if (p !== "1") sp.set("page", p);
    const qs = sp.toString();
    return `/admin/catalog${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">Quản lý thư viện</h1>
        <p className="text-sm text-text-secondary">
          Xem và tìm kiếm bộ thư viện. Chỉnh sửa sẽ có ở phần sau.
        </p>
      </header>

      {/* Filters */}
      <form className="flex flex-wrap items-end gap-3" action="/admin/catalog" method="get">
        <div className="flex flex-col gap-1">
          <label htmlFor="catalog-q" className="text-xs text-text-secondary">
            Tìm kiếm
          </label>
          <input
            id="catalog-q"
            name="q"
            type="text"
            defaultValue={q}
            placeholder="Tiêu đề hoặc slug..."
            className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="catalog-status" className="text-xs text-text-secondary">
            Trạng thái
          </label>
          <select
            id="catalog-status"
            name="status"
            defaultValue={statusFilter}
            className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">Tất cả</option>
            <option value="draft">Nháp</option>
            <option value="published">Đã xuất bản</option>
            <option value="archived">Đã lưu trữ</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Tìm
        </button>
      </form>

      {/* Results */}
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-border-soft bg-surface p-4 text-danger"
        >
          Không thể tải danh sách thư viện.
        </div>
      ) : enrichedSets.length === 0 ? (
        <div className="rounded-2xl border border-border-soft bg-surface p-8 text-center text-text-secondary">
          Không tìm thấy bộ thư viện nào.
        </div>
      ) : (
        <>
          <p className="text-xs text-text-secondary">
            {(totalCount ?? 0).toLocaleString("vi-VN")} kết quả
            {totalPages > 1 ? ` · Trang ${page}/${totalPages}` : ""}
          </p>
          <div className="overflow-x-auto rounded-2xl border border-border-soft bg-surface shadow-soft-card">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-soft text-xs uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-3">Tiêu đề</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Phiên bản</th>
                  <th className="px-4 py-3">Thẻ</th>
                  <th className="px-4 py-3">Cài đặt</th>
                  <th className="px-4 py-3">Ngôn ngữ</th>
                  <th className="px-4 py-3">Thao tác</th>
                  <th className="px-4 py-3">Cập nhật</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {enrichedSets.map((set) => (
                  <tr key={set.id} className="hover:bg-surface-subtle">
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col">
                        <span className="font-medium">{set.title}</span>
                        <span className="text-xs text-text-secondary">
                          {set.slug}
                          {set.is_starter ? " · Starter" : ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={set.status} />
                    </td>
                    <td className="px-4 py-2.5 text-xs">v{set.version}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {(set.card_count ?? 0).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {(set.install_count ?? 0).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {set.language_front} → {set.language_back}
                    </td>
                    <td className="px-4 py-2.5">
                      <CatalogActionsCell
                        setId={set.id}
                        status={set.status as "draft" | "published" | "archived"}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-secondary">
                      {new Date(set.updated_at).toLocaleDateString("vi-VN")}
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
                <Link
                  href={buildUrl({ page: String(page - 1) })}
                  className="rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-subtle"
                >
                  ← Trước
                </Link>
              )}
              <span className="text-sm text-text-secondary">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={buildUrl({ page: String(page + 1) })}
                  className="rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-subtle"
                >
                  Tiếp →
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: Readonly<{ status: string }>) {
  const styles: Record<string, string> = {
    draft: "bg-surface-subtle text-text-secondary",
    published: "bg-success/10 text-success",
    archived: "bg-warning/10 text-warning",
  };
  const labels: Record<string, string> = {
    draft: "Nháp",
    published: "Đã xuất bản",
    archived: "Đã lưu trữ",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? styles.draft}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
