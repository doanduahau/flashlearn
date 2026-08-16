"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cloneSharedSet } from "@/features/sharing/server/actions";

export function CloneSetButton({
  token,
  isAuthenticated,
  isClassroom,
}: Readonly<{
  token: string;
  isAuthenticated: boolean;
  isClassroom: boolean;
}>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function save(): void {
    setError("");
    startTransition(async () => {
      const result = await cloneSharedSet(token);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(`/sets/${result.setId}`);
    });
  }

  if (!isAuthenticated) {
    return (
      <Button asChild>
        <Link href={`/sign-in?next=/share/${token}`}>Đăng nhập để lưu</Link>
      </Button>
    );
  }

  const label = isClassroom ? "Tham gia lớp học" : "Lưu vào bộ của tôi";

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" disabled={isPending} onClick={save}>
        {isPending ? "Đang lưu…" : label}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
