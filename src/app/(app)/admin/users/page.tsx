import { redirect } from "next/navigation";

import {
  AdminAuthorizationError,
  requireAdminPermission,
} from "@/features/admin/server/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type UserResult = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  created_at: string;
  email?: string;
  email_confirmed_at?: string | null;
  plan?: string;
  flashcard_set_count?: number;
  flashcard_count?: number;
};

export default async function AdminUsersPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    q?: string;
  }>;
}>) {
  try {
    await requireAdminPermission("users.read");
  } catch (error) {
    if (error instanceof AdminAuthorizationError) redirect("/admin");
    throw error;
  }

  const params = await searchParams;
  const q = params.q?.trim() || "";

  let result: UserResult | null = null;
  let error: string | null = null;

  if (q) {
    const admin = createAdminClient();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q);

    if (isUuid) {
      // Lookup by UUID
      const { data: profile } = await admin
        .from("profiles")
        .select("id, display_name, avatar_url, timezone, created_at")
        .eq("id", q)
        .maybeSingle();

      if (profile) {
        const { data: authUser } = await admin.auth.admin.getUserById(q);
        const { count: setCount } = await admin
          .from("flashcard_sets")
          .select("id", { count: "exact", head: true })
          .eq("user_id", q);
        const { count: cardCount } = await admin
          .from("flashcards")
          .select("id", { count: "exact", head: true })
          .eq("user_id", q);

        // Get plan
        const { data: planData } = await admin.rpc("get_effective_plan", {
          p_user_id: q,
        });

        result = {
          ...profile,
          email: authUser?.user?.email,
          email_confirmed_at: authUser?.user?.email_confirmed_at,
          plan: planData ?? "free",
          flashcard_set_count: setCount ?? 0,
          flashcard_count: cardCount ?? 0,
        };
      }
    } else if (isEmail) {
      // Lookup by exact email via RPC (admin.auth.admin.listUsers doesn't support filter)
      const normalizedEmail = q.toLowerCase().trim();
      const { data: emailLookup } = await admin.rpc("get_admin_user_by_email", {
        p_email: normalizedEmail,
      });
      const lookup = emailLookup?.[0];

      if (lookup) {
        const authUser = {
          id: lookup.user_id,
          email: lookup.email,
          email_confirmed_at: lookup.email_confirmed_at,
        };
        const { data: profile } = await admin
          .from("profiles")
          .select("id, display_name, avatar_url, timezone, created_at")
          .eq("id", authUser.id)
          .maybeSingle();

        if (profile) {
          const { count: setCount } = await admin
            .from("flashcard_sets")
            .select("id", { count: "exact", head: true })
            .eq("user_id", authUser.id);
          const { count: cardCount } = await admin
            .from("flashcards")
            .select("id", { count: "exact", head: true })
            .eq("user_id", authUser.id);

          const { data: planData } = await admin.rpc("get_effective_plan", {
            p_user_id: authUser.id,
          });

          result = {
            ...profile,
            email: authUser.email,
            email_confirmed_at: authUser.email_confirmed_at,
            plan: planData ?? "free",
            flashcard_set_count: setCount ?? 0,
            flashcard_count: cardCount ?? 0,
          };
        }
      }
    } else {
      error = "Vui lòng nhập email hoặc UUID hợp lệ.";
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">Tra cứu người dùng</h1>
        <p className="text-sm text-text-secondary">
          Nhập email chính xác hoặc UUID để xem thông tin.
        </p>
      </header>

      {/* Search */}
      <form className="flex items-end gap-3" action="/admin/users" method="get">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="user-q" className="text-xs text-text-secondary">
            Email hoặc UUID
          </label>
          <input
            id="user-q"
            name="q"
            type="text"
            defaultValue={q}
            placeholder="user@example.com hoặc uuid..."
            className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Tìm
        </button>
      </form>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-border-soft bg-surface p-4 text-danger"
        >
          {error}
        </div>
      )}

      {/* No results */}
      {q && !result && !error && (
        <div className="rounded-2xl border border-border-soft bg-surface p-8 text-center text-text-secondary">
          Không tìm thấy người dùng với thông tin đã nhập.
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-2xl border border-border-soft bg-surface p-4 shadow-soft-card sm:rounded-3xl sm:p-6">
          <div className="flex items-start gap-4">
            {result.avatar_url ? (
              <img src={result.avatar_url} alt="" className="size-12 rounded-full object-cover" />
            ) : (
              <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary-foreground">
                {(result.display_name ?? result.email ?? "?")[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold">{result.display_name || "Chưa có tên"}</h2>
              {result.email && <p className="text-sm text-text-secondary">{result.email}</p>}
              <p className="mt-1 text-xs text-text-secondary">
                ID: <span className="font-mono">{result.id}</span>
              </p>
            </div>
            <PlanBadge plan={result.plan ?? "free"} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <InfoItem label="Bộ thẻ" value={result.flashcard_set_count ?? 0} />
            <InfoItem label="Tổng thẻ" value={result.flashcard_count ?? 0} />
            <InfoItem label="Múi giờ" value={result.timezone ?? "Chưa đặt"} />
            <InfoItem
              label="Ngày tạo"
              value={
                result.created_at ? new Date(result.created_at).toLocaleDateString("vi-VN") : "—"
              }
            />
          </div>
        </div>
      )}

      {/* Privacy note */}
      <p className="text-xs text-text-secondary">
        🔒 Thông tin hiển thị giới hạn ở các trường an toàn. Không hiển thị mật khẩu, session, token
        hoặc nội dung flashcard riêng tư.
      </p>
    </div>
  );
}

function PlanBadge({ plan }: Readonly<{ plan: string }>) {
  const styles: Record<string, string> = {
    free: "bg-surface-subtle text-text-secondary",
    pro_monthly: "bg-primary-soft text-primary-foreground",
    pro_yearly: "bg-primary-soft text-primary-foreground",
  };
  const labels: Record<string, string> = {
    free: "Free",
    pro_monthly: "Pro (tháng)",
    pro_yearly: "Pro (năm)",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[plan] ?? styles.free}`}
    >
      {labels[plan] ?? plan}
    </span>
  );
}

function InfoItem({
  label,
  value,
}: Readonly<{
  label: string;
  value: string | number;
}>) {
  return (
    <div className="rounded-xl bg-surface-subtle p-3">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}
