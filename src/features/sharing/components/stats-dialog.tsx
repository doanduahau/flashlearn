"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DialogOverlay } from "@/components/ui/dialog-overlay";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";

export type MemberStats = {
  rank: number;
  member_user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  joined_at: string;
  total_questions: number;
  correct_questions: number;
  accuracy: number | null;
  last_activity_at: string | null;
};

export function StatsDialog({
  members,
  mascotLevel,
}: Readonly<{
  members: MemberStats[];
  mascotLevel: MascotLevel;
}>) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        aria-label="Thống kê học sinh"
        onClick={() => setIsOpen(true)}
      >
        Thống kê
      </Button>
      {isOpen ? (
        <DialogOverlay
          title="Thống kê lớp học"
          onClose={() => setIsOpen(false)}
          className="max-w-xl sm:max-w-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-bold text-text-primary">Thống kê lớp học</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Đóng"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </Button>
          </div>
          <p className="mt-1 text-sm text-text-secondary">Chỉ bạn xem được bảng này.</p>

          {members.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-border-soft bg-surface-subtle p-8 text-center">
              <MascotImage
                level={mascotLevel}
                state="thinking"
                size={64}
                className="mx-auto mb-2 size-16 object-contain"
              />
              <p className="font-medium">Chưa có học sinh nào tham gia lớp học.</p>
              <p className="mt-1 text-sm text-text-secondary">
                Chia sẻ link lớp học để học sinh tham gia.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-border-soft bg-surface">
              <table className="w-full table-fixed border-collapse text-center text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border-soft bg-surface-subtle font-semibold text-text-secondary">
                    <th scope="col" className="w-[12%] px-1 py-2 text-center sm:px-2.5 sm:py-2.5">
                      STT
                    </th>
                    <th scope="col" className="w-[30%] px-1.5 py-2 text-center sm:px-2.5 sm:py-2.5">
                      Tên
                    </th>
                    <th scope="col" className="w-[18%] px-1 py-2 text-center sm:px-2 sm:py-2.5">
                      Đã làm
                    </th>
                    <th scope="col" className="w-[18%] px-1 py-2 text-center sm:px-2 sm:py-2.5">
                      Chính xác
                    </th>
                    <th scope="col" className="w-[22%] px-1 py-2 text-center sm:px-2 sm:py-2.5">
                      Gần nhất
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {members.map((member) => (
                    <tr
                      key={member.member_user_id}
                      className="transition-colors hover:bg-surface-subtle/50"
                    >
                      <td className="px-1 py-2 font-semibold text-text-secondary sm:px-2.5 sm:py-2.5">
                        {member.rank}
                      </td>
                      <td
                        className="truncate px-1.5 py-2 font-medium text-text-primary sm:px-2.5 sm:py-2.5"
                        title={member.display_name || "Học sinh"}
                      >
                        {member.display_name || "Học sinh"}
                      </td>
                      <td className="px-1 py-2 text-text-primary sm:px-2 sm:py-2.5">
                        {member.total_questions}
                      </td>
                      <td className="px-1 py-2 font-medium text-text-primary sm:px-2 sm:py-2.5">
                        {member.accuracy === null ? "—" : `${member.accuracy}%`}
                      </td>
                      <td className="px-1 py-2 leading-tight text-text-secondary sm:px-2 sm:py-2.5">
                        {member.last_activity_at === null
                          ? "—"
                          : formatDateTime(member.last_activity_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button type="button" variant="soft" onClick={() => router.refresh()}>
              Làm mới
            </Button>
          </div>
        </DialogOverlay>
      ) : null}
    </>
  );
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const dayMonth = date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  return `${time} ${dayMonth}`;
}
