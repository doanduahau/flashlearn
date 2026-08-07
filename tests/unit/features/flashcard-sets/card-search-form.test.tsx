import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { router, searchParams } = vi.hoisted(() => ({
  router: { replace: vi.fn() },
  searchParams: new URLSearchParams("page=2&sort=position&filter=active&tab=regular&q=cũ"),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/sets/set-id",
  useRouter: () => router,
  useSearchParams: () => searchParams,
}));

import { CardSearchForm } from "@/features/flashcard-sets/components/card-search-form";

describe("CardSearchForm", () => {
  beforeEach(() => {
    router.replace.mockReset();
  });

  it("resets pagination while preserving other list state", async () => {
    const user = userEvent.setup();
    render(<CardSearchForm defaultValue="cũ" />);

    await user.clear(screen.getByLabelText("Tìm thẻ"));
    await user.type(screen.getByLabelText("Tìm thẻ"), "mới");
    await user.keyboard("{Enter}");

    expect(router.replace).toHaveBeenCalledWith(
      "/sets/set-id?sort=position&filter=active&tab=regular&q=m%E1%BB%9Bi",
      { scroll: false },
    );
  });
});
