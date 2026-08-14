"use client";

import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBackWithFallback } from "@/hooks/use-back-with-fallback";
import { cn } from "@/lib/utils";

export function BackButton({
  fallbackHref,
  className,
  label = "Quay lại trang trước",
}: Readonly<{
  fallbackHref: string;
  className?: string;
  label?: string;
}>) {
  const goBack = useBackWithFallback(fallbackHref);
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn("size-11 shrink-0 gap-1 p-0", className)}
      aria-label={label}
      onClick={goBack}
    >
      <ChevronLeft className="size-6" aria-hidden="true" />
    </Button>
  );
}
