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
        <DialogOverlay title="Thống kê lớp học" onClose={() => setIsOpen(false)}>
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
            <ol className="mt-4 grid gap-3">
              {members.map((member) => (
                <li
                  key={member.member_user_id}
                  className={
                    member.rank === 1
                      ? "rounded-2xl border border-primary-soft bg-surface p-4"
                      : "rounded-2xl border border-border-soft bg-surface p-4"
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-foreground">
                      {member.rank}
                    </span>
                    <div className="flex min-w-0 items-center gap-2">
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt=""
                          aria-hidden="true"
                          className="size-8 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-xs font-semibold text-text-primary">
                          {initials(member.display_name)}
                        </span>
                      )}
                      <span className="truncate font-semibold text-text-primary">
                        {member.display_name || "Học sinh"}
                      </span>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 sm:gap-3">
                    <div>
                      <dt className="text-text-secondary">Tổng câu đã làm</dt>
                      <dd className="mt-0.5 font-medium text-text-primary">
                        {member.total_questions}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary">Số câu đúng</dt>
                      <dd className="mt-0.5 font-medium text-text-primary">
                        {member.correct_questions}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary">Tỉ lệ chính xác</dt>
                      <dd className="mt-0.5 font-medium text-text-primary">
                        {member.accuracy === null ? "—" : `${member.accuracy}%`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary">Ngày tham gia</dt>
                      <dd className="mt-0.5 text-text-primary">{formatDate(member.joined_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary">Hoạt động gần nhất</dt>
                      <dd className="mt-0.5 text-text-primary">
                        {member.last_activity_at === null
                          ? "—"
                          : formatDateTime(member.last_activity_at)}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ol>
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

function initials(displayName: string | null): string {
  const name = displayName?.trim() || "Học sinh";
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "H";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN");
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
