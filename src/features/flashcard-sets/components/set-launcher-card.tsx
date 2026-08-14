import Link from "next/link";

import { MascotImage } from "@/features/mascot/components/mascot-image";

export function SetLauncherCard({
  href,
  mascotState,
  title,
  description,
}: Readonly<{
  href: string;
  mascotState: "point-right" | "normal";
  title: string;
  description: string;
}>) {
  return (
    <Link
      href={href}
      className="flex min-h-[calc(100dvh-16rem)] flex-col items-center justify-center gap-3 rounded-3xl border border-border-soft bg-surface-subtle p-6 text-center outline-none transition-colors hover:bg-surface/70 focus-visible:ring-2 focus-visible:ring-ring/50 sm:min-h-0 sm:p-10"
    >
      <MascotImage level={1} state={mascotState} size={96} className="size-24 object-contain" />
      <span className="text-xl font-bold sm:text-2xl">{title}</span>
      <span className="text-sm text-text-secondary">{description}</span>
    </Link>
  );
}
