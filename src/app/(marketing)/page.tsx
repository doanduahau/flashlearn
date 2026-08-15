import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function MarketingPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex items-center gap-2 font-heading text-lg font-bold">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-primary-soft">
          <img src="/mascot/logo.png" alt="" aria-hidden="true" className="size-6 object-contain" />
        </span>
        CapyStudy
      </div>

      <h1 className="max-w-3xl font-heading text-4xl font-extrabold leading-tight sm:text-5xl">
        CapyStudy
      </h1>

      <p className="max-w-xl text-text-secondary">
        tạo bộ flashcard từ tài liệu của riêng bạn. Vừa học vừa chơi cùng CapyStudy
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/sign-in">Đăng nhập</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/sign-up">Tạo tài khoản</Link>
        </Button>
      </div>
    </main>
  );
}
