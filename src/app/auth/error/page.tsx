import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import { BrandLogo } from "@/components/shared/brand-logo";

export const metadata: Metadata = {
  title: "Lỗi xác thực",
};

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <div className="flex items-center gap-2 font-heading text-lg font-bold">
        <BrandLogo className="size-6 object-contain" />
        CapyStudy
      </div>

      <div className="w-full max-w-sm rounded-3xl border border-border-soft bg-surface p-8 text-center shadow-soft-card">
        <MascotImage level={1} state="sad" size={96} className="mx-auto size-24 object-contain" />
        <h1 className="font-heading text-xl font-bold">Xác thực không thành công</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Có vấn đề xảy ra trong quá trình xác thực. Vui lòng thử lại.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/sign-in">Đăng nhập</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/sign-up">Tạo tài khoản mới</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
