import { Leaf } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Tạo tài khoản",
};

export default function SignUpPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <div className="flex items-center gap-2 font-heading text-lg font-bold">
        <Leaf className="size-6 text-primary" aria-hidden="true" />
        FlashLearn
      </div>

      <div className="w-full max-w-sm rounded-3xl border border-border-soft bg-surface p-8 text-center shadow-[0_8px_24px_rgba(39,93,70,0.08)]">
        <h1 className="font-heading text-xl font-bold">Tạo tài khoản</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Đăng ký sẽ được bật ở Phase 2 khi tích hợp Supabase Auth.
        </p>
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link href="/">Quay lại</Link>
        </Button>
      </div>
    </main>
  );
}
