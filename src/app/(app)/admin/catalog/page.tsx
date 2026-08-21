import Link from "next/link";
import { redirect } from "next/navigation";

import { CatalogListHeader } from "@/features/admin/components/catalog/catalog-list-header";
import { getAdminCatalogCategories } from "@/features/admin/server/admin-catalog-queries";
import {
  AdminAuthorizationError,
  hasAdminPermission,
  requireAdminPermission,
} from "@/features/admin/server/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeatureFlags } from "@/lib/telemetry/feature-flags";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type CatalogSetRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  version: number;
  is_starter: boolean;
  starter_order: number | null;
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

  const canWrite = await hasAdminPermission("catalog.write");
  const mutationsEnabled = getFeatureFlags().adminCatalogMutationsEnabled;
  const categories = await getAdminCatalogCategories();

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const statusFilter = params.status || "";
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const admin = createAdminClient();

  // Bounded query
  let query = admin
    .from("catalog_sets")
    .select(
      "id, title, slug, status, version, is_starter, starter_order, language_front, language_back, created_at, updated_at",
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
    <div className="flex flex-col gap-5">
      <CatalogListHeader
        categories={categories}
        canWrite={canWrite}
        mutationsEnabled={mutationsEnabled}
      />

      {/* Filters */}
      <form
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        action="/admin/catalog"
        method="get"
      >
        <div className="flex flex-1 min-w-[200px] flex-col gap-1">
          <label
            htmlFor="catalog-q"
            className="text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Tìm kiếm
          </label>
          <input
            id="catalog-q"
            name="q"
            type="text"
            defaultValue={q}
            placeholder="Tiêu đề hoặc slug..."
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <div className="flex flex-col gap-1 min-w-[150px]">
          <label
            htmlFor="catalog-status"
            className="text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Trạng thái
          </label>
          <select
            id="catalog-status"
            name="status"
            defaultValue={statusFilter}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">Tất cả</option>
            <option value="draft">Bản thảo (Draft)</option>
            <option value="published">Đã xuất bản</option>
            <option value="archived">Đã lưu trữ</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          Lọc
        </button>
      </form>

      {/* Results */}
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700"
        >
          Không thể tải danh sách thư viện.
        </div>
      ) : enrichedSets.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Không tìm thấy bộ thư viện nào.
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {(totalCount ?? 0).toLocaleString("vi-VN")} kết quả
            {totalPages > 1 ? ` · Trang ${page}/${totalPages}` : ""}
          </p>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                  <th className="px-4 py-3">Tiêu đề</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Phiên bản</th>
                  <th className="px-4 py-3">Thẻ</th>
                  <th className="px-4 py-3">Cài đặt</th>
                  <th className="px-4 py-3">Ngôn ngữ</th>
                  <th className="px-4 py-3">Cập nhật</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {enrichedSets.map((set) => (
                  <tr key={set.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <Link
                          href={`/admin/catalog/${set.id}`}
                          className="font-semibold text-slate-900 hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400"
                        >
                          {set.title}
                        </Link>
                        <span className="text-xs text-slate-400">
                          {set.slug}
                          {set.is_starter ? ` · Starter #${set.starter_order}` : ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={set.status} />
                    </td>
                    <td className="px-4 py-3 text-xs font-mono">v{set.version}</td>
                    <td className="px-4 py-3 text-xs">
                      {(set.card_count ?? 0).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {(set.install_count ?? 0).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {set.language_front} → {set.language_back}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {new Date(set.updated_at).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/admin/catalog/${set.id}`}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        Chi tiết →
                      </Link>
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
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  ← Trước
                </Link>
              )}
              <span className="text-sm text-slate-500">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={buildUrl({ page: String(page + 1) })}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
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
    draft: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    published: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    archived: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
  };
  const labels: Record<string, string> = {
    draft: "Bản thảo",
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
