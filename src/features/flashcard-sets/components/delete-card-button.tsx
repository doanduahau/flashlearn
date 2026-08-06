"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DialogOverlay } from "@/components/ui/dialog-overlay";
import { deleteCard } from "@/features/flashcard-sets/server/actions";

export function DeleteCardButton({ setId, cardId }: Readonly<{ setId: string; cardId: string }>) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function confirm(): void {
    setError("");
    startTransition(async () => {
      const result = await deleteCard({ setId, cardId });
      if (!result.ok) {
        setError(result.error);
        setIsConfirming(false);
        return;
      }
      router.refresh();
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
        variant="ghost"
        className="size-11 p-0 text-destructive sm:h-10 sm:w-auto sm:px-4"
        onClick={() => setIsConfirming(true)}
        aria-label="Xóa thẻ"
        title="Xóa thẻ"
      >
        <Trash2 aria-hidden="true" />
        <span className="hidden sm:inline">Xóa thẻ</span>
      </Button>
      {error && !isConfirming ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      {isConfirming ? (
        <DialogOverlay title="Xóa thẻ" onClose={isPending ? () => undefined : close}>
          <h2 className="text-xl font-bold">Xóa thẻ này khỏi bộ?</h2>
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
