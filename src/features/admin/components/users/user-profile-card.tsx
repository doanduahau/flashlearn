import type { AdminUserDetailData } from "@/features/admin/server/admin-user-queries";

export interface UserProfileCardProps {
  user: AdminUserDetailData;
}

export function UserProfileCard({ user }: UserProfileCardProps) {
  const { profile, roles, plan, stats } = user;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-xl font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            {profile.displayName?.charAt(0)?.toUpperCase() ||
              profile.email?.charAt(0)?.toUpperCase() ||
              "U"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {profile.displayName || "Chưa đặt tên"}
              </h2>
              {profile.emailConfirmedAt ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                  Đã xác thực email
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                  Chưa xác thực email
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 font-mono">{profile.email || profile.id}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
              plan.isPro
                ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {plan.label}
          </span>
          {roles.length > 0 ? (
            roles.map((r) => (
              <span
                key={r.role}
                className="rounded-xl bg-purple-100 px-3 py-1.5 text-xs font-semibold uppercase text-purple-800 dark:bg-purple-950/50 dark:text-purple-300"
              >
                {r.role}
              </span>
            ))
          ) : (
            <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Người dùng thông thường
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4 dark:border-slate-800 text-xs">
        <div>
          <span className="text-slate-400">Mã người dùng (UUID):</span>
          <p
            className="mt-0.5 font-mono text-slate-700 dark:text-slate-300 truncate"
            title={profile.id}
          >
            {profile.id}
          </p>
        </div>
        <div>
          <span className="text-slate-400">Múi giờ:</span>
          <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-300">
            {profile.timezone || "Mặc định (Asia/Ho_Chi_Minh)"}
          </p>
        </div>
        <div>
          <span className="text-slate-400">Số bộ thẻ đang có:</span>
          <p className="mt-0.5 font-bold font-mono text-slate-800 dark:text-slate-200">
            {stats.setCount.toLocaleString("vi-VN")} bộ
          </p>
        </div>
        <div>
          <span className="text-slate-400">Tổng số thẻ flashcard:</span>
          <p className="mt-0.5 font-bold font-mono text-slate-800 dark:text-slate-200">
            {stats.cardCount.toLocaleString("vi-VN")} thẻ
          </p>
        </div>
      </div>
    </div>
  );
}
