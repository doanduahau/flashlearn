"use client";

import Link from "next/link";
import { useBackWithFallback } from "@/hooks/use-back-with-fallback";
import { cn } from "@/lib/utils";

export function BackButton({
  fallbackHref,
  href,
  className,
  label = "← Thoát",
  ariaLabel = "Thoát",
}: Readonly<{
  fallbackHref?: string;
  href?: string;
  className?: string;
  label?: string;
  ariaLabel?: string;
}>) {
  const goBack = useBackWithFallback(fallbackHref ?? "/");

  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel}
        className={cn("inline-flex min-h-11 items-center px-1 text-sm underline", className)}
      >
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={ariaLabel}
      className={cn("min-h-11 px-1 text-sm underline", className)}
    >
      {label}
    </button>
  );
}
