"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

export function useBackWithFallback(fallbackHref: string): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }, [router, fallbackHref]);
}
