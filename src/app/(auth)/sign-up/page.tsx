import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignUpErrorDisplay } from "@/features/auth/components/sign-up-error-display";
import { BrandLogo } from "@/components/shared/brand-logo";

import { signUp } from "@/features/auth/server/actions";

export const metadata: Metadata = {
  title: "Đăng ký",
};

function DisplayNameInput() {
  return (
    <div>
      <Label htmlFor="displayName">Tên hiển thị</Label>
      <Input
        id="displayName"
        name="displayName"
        type="text"
        maxLength={100}
        placeholder="Nguyễn Văn A"
        className="mt-1"
        autoComplete="name"
      />
    </div>
  );
}

function EmailInput() {
  return (
    <div>
      <Label htmlFor="email">Email</Label>
      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="ten@example.com"
        className="mt-1"
        required
      />
    </div>
  );
}

function PasswordInput() {
  return (
    <div>
      <Label htmlFor="password">Mật khẩu</Label>
      <Input
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        placeholder="Ít nhất 8 ký tự"
        className="mt-1"
        required
      />
    </div>
  );
}

function ConfirmPasswordInput() {
  return (
    <div>
      <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
      <Input
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        placeholder="Nhập lại mật khẩu"
        className="mt-1"
        required
      />
    </div>
  );
}

export default function SignUpPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <div className="flex items-center gap-2 font-heading text-lg font-bold">
        <BrandLogo className="size-6 object-contain" />
        CapyStudy
      </div>

      <div className="w-full max-w-sm rounded-3xl border border-border-soft bg-surface p-8 text-center shadow-soft-card">
        <h1 className="font-heading text-xl font-bold">Tạo tài khoản</h1>
        <p className="mt-2 text-sm text-text-secondary">Điền thông tin bên dưới để bắt đầu.</p>

        <SignUpErrorDisplay />

        <form action={signUp} className="mt-6 flex flex-col gap-4">
          <DisplayNameInput />
          <EmailInput />
          <PasswordInput />
          <ConfirmPasswordInput />
          <Button type="submit" className="mt-2 w-full">
            Đăng ký
          </Button>
        </form>

        <p className="mt-4 text-sm text-text-secondary">
          Đã có tài khoản?{" "}
          <Link href="/sign-in" className="font-medium text-primary hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </main>
  );
}
