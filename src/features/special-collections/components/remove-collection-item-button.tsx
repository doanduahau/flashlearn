"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DialogOverlay } from "@/components/ui/dialog-overlay";
import { removeCollectionItem } from "@/features/special-collections/server/actions";

export function RemoveCollectionItemButton({
  collectionId,
  cardId,
}: Readonly<{ collectionId: string; cardId: string }>) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function confirm(): void {
    setError("");
    startTransition(async () => {
      const result = await removeCollectionItem({ collectionId, cardId });
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
        aria-label="Gỡ thẻ khỏi bộ đặc biệt"
        title="Gỡ thẻ khỏi bộ đặc biệt"
      >
        <X aria-hidden="true" />
        <span className="hidden sm:inline">Bỏ thẻ</span>
      </Button>
      {error && !isConfirming ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      {isConfirming ? (
        <DialogOverlay
          title="Bỏ thẻ khỏi bộ đặc biệt"
          onClose={isPending ? () => undefined : close}
        >
          <h2 className="text-xl font-bold">Bỏ thẻ này khỏi bộ đặc biệt?</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Thẻ gốc trong bộ flashcard không bị xóa.
          </p>
          {error ? (
            <p role="alert" className="mt-3 text-danger">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" variant="destructive" disabled={isPending} onClick={confirm}>
              {isPending ? "Đang bỏ…" : "Bỏ thẻ"}
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
