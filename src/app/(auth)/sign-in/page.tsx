import type { Metadata } from "next";
import Link from "next/link";

import { SignInForm } from "@/features/auth/components/sign-in-form";

export const metadata: Metadata = {
  title: "Đăng nhập",
};

export default function SignInPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <div className="flex items-center gap-2 font-heading text-lg font-bold">
        <img src="/mascot/logo.png" alt="" aria-hidden="true" className="size-6 object-contain" />
        CapyStudy
      </div>

      <div className="w-full max-w-sm rounded-3xl border border-border-soft bg-surface p-8 text-center shadow-soft-card">
        <h1 className="font-heading text-xl font-bold">Đăng nhập</h1>
        <p className="mt-2 text-sm text-text-secondary">Đăng nhập để tiếp tục học tập.</p>

        <SignInForm />

        <p className="mt-4 text-sm text-text-secondary">
          Chưa có tài khoản?{" "}
          <Link href="/sign-up" className="font-medium text-primary hover:underline">
            Đăng ký
          </Link>
        </p>
      </div>
    </main>
  );
}
