"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";

export function ViewTransitionLink({
  href,
  onClick,
  children,
  ...props
}: ComponentProps<typeof Link>) {
  const router = useRouter();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);

    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
      return;
    }

    const hrefString = typeof href === "string" ? href : (href.pathname ?? "");
    if (!hrefString || hrefString.startsWith("#")) return;

    if (typeof document !== "undefined" && "startViewTransition" in document) {
      e.preventDefault();
      (
        document as unknown as { startViewTransition: (cb: () => void) => void }
      ).startViewTransition(() => {
        router.push(hrefString);
      });
    }
  }

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
