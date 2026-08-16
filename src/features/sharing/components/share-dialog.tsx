"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DialogOverlay } from "@/components/ui/dialog-overlay";
import {
  createShareLink,
  revokeShareLink,
  setClassroomEnabled,
} from "@/features/sharing/server/actions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

export function ShareDialog({
  setId,
  hasToken,
  token,
  classroomEnabled,
}: Readonly<{
  setId: string;
  hasToken: boolean;
  token: string | null;
  classroomEnabled: boolean;
}>) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmingRevoke, setIsConfirmingRevoke] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const shareUrl = token ? `${APP_URL ?? ""}/share/${token}` : "";

  function close(): void {
    if (isPending) return;
    setIsOpen(false);
    setIsConfirmingRevoke(false);
    setCopied(false);
    setError("");
  }

  function create(): void {
    setError("");
    startTransition(async () => {
      const result = await createShareLink(setId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCopied(false);
      setIsConfirmingRevoke(false);
      router.refresh();
    });
  }

  function revoke(): void {
    setError("");
    startTransition(async () => {
      const result = await revokeShareLink(setId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCopied(false);
      setIsConfirmingRevoke(false);
      router.refresh();
    });
  }

  function toggleClassroom(): void {
    setError("");
    startTransition(async () => {
      const result = await setClassroomEnabled(setId, !classroomEnabled);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCopied(false);
      router.refresh();
    });
  }

  async function copy(): Promise<void> {
    setError("");
    if (!token) return;
    const ok = await copyText(shareUrl);
    if (!ok) {
      setError("Không thể sao chép link trên thiết bị này. Hãy tự sao chép nội dung ở trên.");
      return;
    }
    setCopied(true);
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
        Chia sẻ
      </Button>
      {isOpen ? (
        <DialogOverlay title="Chia sẻ bộ flashcard" onClose={close}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-bold text-text-primary">Chia sẻ bộ flashcard</h2>
            <Button type="button" variant="ghost" size="icon" aria-label="Đóng" onClick={close}>
              ✕
            </Button>
          </div>

          {!hasToken ? (
            <div className="mt-4">
              <p className="text-sm text-text-secondary">
                Tạo một link để học sinh xem và lưu bộ flashcard này vào tài khoản của họ.
              </p>
              <Button type="button" disabled={isPending} onClick={create} className="mt-4">
                {isPending ? "Đang tạo…" : "Tạo link chia sẻ"}
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="share-url" className="text-sm font-medium text-text-primary">
                  Link chia sẻ
                </label>
                <p
                  id="share-url"
                  className="mt-1 break-all rounded-xl border border-border-soft bg-surface-subtle p-3 font-mono text-xs text-text-primary"
                >
                  {shareUrl}
                </p>
              </div>
              {copied ? (
                <p role="status" className="text-sm font-medium text-success">
                  Đã sao chép!
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="soft" disabled={isPending} onClick={copy}>
                  {isPending ? "Đang xử lý…" : "Sao chép link"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setIsConfirmingRevoke(true)}
                >
                  Tắt chia sẻ
                </Button>
              </div>

              {isConfirmingRevoke ? (
                <div className="rounded-2xl border border-border-soft bg-surface-subtle p-4">
                  <p className="text-sm font-medium text-text-primary">
                    Tắt chia sẻ link này? Học sinh không thể mở lại sau khi tắt.
                  </p>
                  {error ? (
                    <p role="alert" className="mt-2 text-sm text-danger">
                      {error}
                    </p>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={isPending}
                      onClick={revoke}
                    >
                      {isPending ? "Đang tắt…" : "Tắt"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => {
                        setIsConfirmingRevoke(false);
                        setError("");
                      }}
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-border-soft p-4">
                <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  <input
                    type="checkbox"
                    checked={classroomEnabled}
                    disabled={isPending}
                    onChange={toggleClassroom}
                  />
                  Chế độ lớp học
                </label>
                {classroomEnabled ? (
                  <p className="mt-2 text-sm text-text-secondary">
                    Học sinh mở link sẽ thấy thông báo đây là link lớp học. Khi họ lưu vào bộ của
                    mình, bạn xem được tiến độ học và xếp hạng của họ.
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {error && !isConfirmingRevoke ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </DialogOverlay>
      ) : null}
    </>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path below.
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
