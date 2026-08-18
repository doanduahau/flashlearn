"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { LoadingDots } from "@/components/shared/loading-dots";
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
  const [savedSet, setSavedSet] = useState<string | null>(null);

  function save(): void {
    setError("");
    startTransition(async () => {
      const result = await cloneSharedSet(token);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (result.alreadyExists && !isClassroom) {
        // Plain link, already saved: show the notice + link instead of
        // creating a second copy.
        setSavedSet(result.setId);
        return;
      }
      // New clone, or already-joined classroom link: go straight to the set.
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

  if (savedSet) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p role="status" className="text-sm text-text-secondary">
          Bạn đã lưu bộ này.
        </p>
        <Button asChild variant="outline">
          <Link href={`/sets/${savedSet}`}>Mở bộ flashcard của bạn</Link>
        </Button>
      </div>
    );
  }

  const label = isClassroom ? "Tham gia lớp học" : "Lưu vào bộ của tôi";

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" disabled={isPending} onClick={save}>
        {isPending ? <LoadingDots label="Đang lưu" /> : label}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
