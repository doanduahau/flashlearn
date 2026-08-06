"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DialogOverlay } from "@/components/ui/dialog-overlay";
import { deleteCollection } from "@/features/special-collections/server/actions";

export function DeleteCollectionButton({ collectionId }: Readonly<{ collectionId: string }>) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function confirm(): void {
    setError("");
    startTransition(async () => {
      const result = await deleteCollection({ collectionId });
      if (!result.ok) {
        setError(result.error);
        setIsConfirming(false);
        return;
      }
      router.replace("/collections");
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
        <DialogOverlay title="Xóa bộ đặc biệt" onClose={isPending ? () => undefined : close}>
          <h2 className="text-xl font-bold">Xóa bộ đặc biệt này và mọi liên kết thẻ bên trong?</h2>
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
