"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DialogOverlay } from "@/components/ui/dialog-overlay";
import { deleteSet } from "@/features/flashcard-sets/server/actions";

export function DeleteSetButton({ setId }: Readonly<{ setId: string }>) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function confirm(): void {
    setError("");
    startTransition(async () => {
      const result = await deleteSet({ setId });
      if (!result.ok) {
        setError(result.error);
        setIsConfirming(false);
        return;
      }
      router.replace("/sets/library");
    });
  }

  function close(): void {
    setIsConfirming(false);
    setError("");
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="destructive"
        onClick={() => setIsConfirming(true)}
      >
        Xóa bộ
      </Button>
      {error && !isConfirming ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      {isConfirming ? (
        <DialogOverlay title="Xóa bộ flashcard" onClose={isPending ? () => undefined : close}>
          <h2 className="text-xl font-bold">Xóa bộ flashcard này và toàn bộ thẻ bên trong?</h2>
          <p className="mt-2 text-sm text-text-secondary">Hành động này không thể hoàn tác.</p>
          {error ? (
            <p role="alert" className="mt-3 text-danger">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" variant="destructive" disabled={isPending} onClick={confirm}>
              {isPending ? "Đang xóa…" : "Xóa vĩnh viễn"}
            </Button>
            <Button type="button" variant="ghost" disabled={isPending} onClick={close}>
              Hủy
            </Button>
          </div>
        </DialogOverlay>
      ) : null}
    </>
  );
}
