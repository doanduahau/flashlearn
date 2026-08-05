"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { deleteSet } from "@/features/flashcard-sets/server/actions";

export function DeleteSetButton({ setId }: Readonly<{ setId: string }>) {
  const router = useRouter();
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
      router.replace("/sets");
    });
  }

  if (!isConfirming) {
    return (
      <div className="space-y-2">
        <Button type="button" variant="destructive" onClick={() => setIsConfirming(true)}>
          Xóa bộ
        </Button>
        {error ? (
          <p role="alert" className="text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-border-soft bg-surface-subtle p-4">
        <p className="font-medium">Xóa bộ flashcard này và toàn bộ thẻ bên trong?</p>
        <p className="mt-1 text-sm text-text-secondary">Hành động này không thể hoàn tác.</p>
        {error ? (
          <p role="alert" className="mt-2 text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="destructive" disabled={isPending} onClick={confirm}>
            {isPending ? "Đang xóa…" : "Xóa vĩnh viễn"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              setIsConfirming(false);
              setError("");
            }}
          >
            Hủy
          </Button>
        </div>
      </div>
    </div>
  );
}
