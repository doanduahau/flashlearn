"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { startSmartReview } from "@/features/smart-review/server/actions";

export function StartSmartReviewButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const startingRef = useRef(false);

  function start(): void {
    if (pending || startingRef.current) return;

    startingRef.current = true;
    startTransition(async () => {
      try {
        setError(null);
        const result = await startSmartReview();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/quiz/${result.sessionId}`);
      } finally {
        startingRef.current = false;
      }
    });
  }

  return (
    <div className="shrink-0">
      <Button
        type="button"
        size="sm"
        className="min-h-10"
        onClick={start}
        disabled={pending}
        aria-describedby={error ? "smart-review-start-error" : undefined}
      >
        {pending ? "Đang mở…" : "Ôn ngay"}
      </Button>
      {error ? (
        <p id="smart-review-start-error" role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
