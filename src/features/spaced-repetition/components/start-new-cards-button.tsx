"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { startNewCardsLearning } from "@/features/spaced-repetition/server/actions";

export function StartNewCardsButton({ label = "Học thẻ mới" }: Readonly<{ label?: string }>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await startNewCardsLearning();
      if (result.ok) {
        router.push(`/quiz/${result.sessionId}`);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Không thể bắt đầu học thẻ mới. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
      <Button size="sm" onClick={handleClick} disabled={pending}>
        {pending ? "Đang tải..." : label}
      </Button>
    </div>
  );
}
