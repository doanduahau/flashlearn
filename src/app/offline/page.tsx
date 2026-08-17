import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MascotImage } from "@/features/mascot/components/mascot-image";

export const metadata = { title: "Ngoại tuyến" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <MascotImage
        level={1}
        state="thinking"
        size={64}
        className="size-16 object-contain"
        aria-hidden
      />
      <h1 className="text-xl font-bold sm:text-2xl">Bạn đang offline</h1>
      <p className="max-w-md text-sm text-text-secondary">
        Không có kết nối mạng lúc này. Hãy kiểm tra lại kết nối và thử lại.
      </p>
      <Link href="/">
        <Button type="button">Về trang chủ</Button>
      </Link>
    </main>
  );
}
