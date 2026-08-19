import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import { CloneSetButton } from "@/features/sharing/components/clone-set-button";
import { SharedCardsList } from "@/features/sharing/components/shared-cards-list";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/security/rate-limit";
import { BrandLogo } from "@/components/shared/brand-logo";

export const metadata: Metadata = { title: "Bộ flashcard chia sẻ" };

export default async function SharedSetPreviewPage({
  params,
}: Readonly<{
  params: Promise<{ token: string }>;
}>) {
  const { token } = await params;
  const rateLimit = await consumeRateLimit(
    "publicShare",
    await requestRateLimitKey("public-share", token),
  );
  if (!rateLimit.ok) return <MissingLinkState />;

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(authData.user);

  const admin = createAdminClient();
  const { data: sets, error } = await admin.rpc("get_shared_set_by_token", {
    p_token: token,
  });

  if (error) {
    return <InvalidLinkState />;
  }

  const set = sets?.[0];
  if (!set) {
    return <MissingLinkState />;
  }

  const { data: cards } = await admin.rpc("get_shared_set_cards", {
    p_token: token,
  });
  const cardList = (cards ?? []).map((card) => ({
    id: card.card_id,
    front: card.front,
    back: card.back,
  }));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <header className="flex items-center gap-2 font-heading text-lg font-bold">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary-soft">
            <BrandLogo className="size-6 object-contain" />
          </span>
          CapyStudy
        </Link>
      </header>

      <section className="mt-8">
        <h1 className="text-3xl font-bold text-text-primary">{set.name}</h1>
        {set.description ? <p className="mt-2 text-text-secondary">{set.description}</p> : null}
        <p className="mt-2 text-sm text-text-secondary">
          Tạo bởi {set.owner_display_name} · {set.card_count} flashcard
        </p>
      </section>

      {set.share_classroom_enabled ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-primary-soft p-4 text-primary-foreground">
          <span aria-hidden="true">🔔</span>
          <p className="text-sm">
            Đây là link lớp học. Khi lưu vào bộ của bạn, giáo viên sẽ xem được số câu đã làm, tỉ lệ
            chính xác và thứ hạng của bạn.
          </p>
        </div>
      ) : null}

      <div className="mt-6">
        <CloneSetButton
          token={token}
          isAuthenticated={isAuthenticated}
          isClassroom={Boolean(set.share_classroom_enabled)}
        />
      </div>

      {cardList.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border-soft bg-surface-subtle p-8 text-center">
          <MascotImage
            level={1}
            state="thinking"
            size={64}
            className="mx-auto mb-2 size-16 object-contain"
          />
          <p className="font-medium">Bộ này chưa có thẻ.</p>
        </div>
      ) : (
        <section aria-label="Danh sách flashcard" className="mt-8">
          <SharedCardsList cards={cardList} />
        </section>
      )}
    </main>
  );
}

function PublicShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      {children}
    </main>
  );
}

function InvalidLinkState() {
  return (
    <PublicShell>
      <MascotImage level={1} state="sad" size={96} className="size-24 object-contain" />
      <h1 className="font-heading text-2xl font-extrabold text-text-primary">Link không hợp lệ</h1>
      <p className="text-text-secondary">Đường dẫn này không đúng định dạng link chia sẻ.</p>
      <Button asChild>
        <Link href="/">Về trang chủ</Link>
      </Button>
    </PublicShell>
  );
}

function MissingLinkState() {
  return (
    <PublicShell>
      <MascotImage level={1} state="sad" size={96} className="size-24 object-contain" />
      <h1 className="font-heading text-2xl font-extrabold text-text-primary">
        Link không tồn tại hoặc đã bị tắt chia sẻ
      </h1>
      <p className="text-text-secondary">
        Bộ flashcard này không còn được chia sẻ hoặc link đã bị thu hồi.
      </p>
      <Button asChild>
        <Link href="/">Về trang chủ</Link>
      </Button>
    </PublicShell>
  );
}
