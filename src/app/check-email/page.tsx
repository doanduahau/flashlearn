import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Kiểm tra email",
};

export default function CheckEmailPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <div className="flex items-center gap-2 font-heading text-lg font-bold">
        <img src="/mascot/logo.png" alt="" aria-hidden="true" className="size-6 object-contain" />
        CapyStudy
      </div>

      <div className="w-full max-w-sm rounded-3xl border border-border-soft bg-surface p-8 text-center shadow-soft-card">
        <h1 className="font-heading text-xl font-bold">Kiểm tra email của bạn</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Chúng tôi đã gửi một liên kết xác nhận đến email của bạn.
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          Vui lòng kiểm tra hộp thư đến, bao gồm cả thư rác.
        </p>
        <p className="mt-4 text-sm text-text-secondary">
          Đã có tài khoản?{" "}
          <Link href="/sign-in" className="font-medium text-primary hover:underline">
            Đăng nhập
          </Link>
        </p>
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link href="/">Quay lại</Link>
        </Button>
      </div>
    </main>
  );
}
