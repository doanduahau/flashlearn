"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingDots } from "@/components/shared/loading-dots";
import { Label } from "@/components/ui/label";
import { renameSet } from "@/features/flashcard-sets/server/actions";
import { SET_NAME_MAX_LENGTH } from "@/lib/constants";

export function RenameSetForm({
  setId,
  initialName,
}: Readonly<{ setId: string; initialName: string }>) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(): void {
    setError("");
    startTransition(async () => {
      const result = await renameSet({ setId, name });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setIsOpen(false);
      router.refresh();
    });
  }

  if (!isOpen) {
    return (
      <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
        Đổi tên
      </Button>
    );
  }

  return (
    <form
      className="rounded-2xl border border-border-soft bg-surface-subtle p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Label htmlFor="set-name">Tên bộ</Label>
      <Input
        id="set-name"
        className="mt-1"
        value={name}
        maxLength={SET_NAME_MAX_LENGTH}
        onChange={(event) => setName(event.target.value)}
        autoFocus
      />
      {error ? (
        <p role="alert" className="mt-2 text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button type="submit" disabled={isPending || !name.trim()}>
          {isPending ? <LoadingDots label="Đang lưu" /> : "Lưu"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => {
            setIsOpen(false);
            setError("");
            setName(initialName);
          }}
        >
          Hủy
        </Button>
      </div>
    </form>
  );
}
