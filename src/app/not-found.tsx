import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MascotImage } from "@/features/mascot/components/mascot-image";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <MascotImage level={1} state="sad" size={96} className="size-24 object-contain" />
      <h1 className="font-heading text-4xl font-extrabold">404</h1>
      <p className="text-text-secondary">Trang bạn đang tìm không tồn tại.</p>
      <Button asChild>
        <Link href="/">Về trang chủ</Link>
      </Button>
    </main>
  );
}
