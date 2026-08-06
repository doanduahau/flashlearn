"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCollection } from "@/features/special-collections/server/actions";
import { COLLECTION_NAME_MAX_LENGTH } from "@/lib/constants";

export function CreateCollectionForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(): void {
    setError("");
    startTransition(async () => {
      const result = await createCollection({ name });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Label htmlFor="collection-name">Tên bộ</Label>
      <Input
        id="collection-name"
        className="mt-1"
        value={name}
        maxLength={COLLECTION_NAME_MAX_LENGTH}
        placeholder="Ví dụ: Khó nhớ, Yêu thích"
        onChange={(event) => setName(event.target.value)}
      />
      {error ? (
        <p role="alert" className="mt-2 text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="mt-3" disabled={isPending || !name.trim()}>
        {isPending ? "Đang tạo…" : "Tạo bộ"}
      </Button>
    </form>
  );
}
