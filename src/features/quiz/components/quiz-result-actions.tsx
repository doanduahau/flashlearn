"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useBackWithFallback } from "@/hooks/use-back-with-fallback";

export function QuizResultActions() {
  const goBack = useBackWithFallback("/quiz");
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <Button asChild>
        <Link href="/quiz/mode">Chơi lại</Link>
      </Button>
      <Button type="button" variant="outline" onClick={goBack}>
        Quay lại
      </Button>
    </div>
  );
}
