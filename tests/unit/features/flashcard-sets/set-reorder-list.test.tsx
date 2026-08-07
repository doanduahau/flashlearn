import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ moveSet: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));
vi.mock("@/features/flashcard-sets/server/actions", () => ({ moveSet: mocks.moveSet }));

import { SetReorderList } from "@/features/flashcard-sets/components/set-reorder-list";

const sets = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Bộ một", cardCount: 1 },
  { id: "22222222-2222-4222-8222-222222222222", name: "Bộ hai", cardCount: 2 },
  { id: "33333333-3333-4333-8333-333333333333", name: "Bộ ba", cardCount: 3 },
];

describe("SetReorderList", () => {
  beforeEach(() => {
    mocks.moveSet.mockReset();
    mocks.moveSet.mockResolvedValue({ ok: true });
  });

  it("uses touch-friendly move controls instead of a draggable card", () => {
    render(<SetReorderList initialSets={sets} doneHref="/sets?tab=regular" />);

    expect(screen.getByRole("button", { name: "Đưa Bộ một lên" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đưa Bộ ba xuống" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Xong" })).toHaveAttribute("href", "/sets?tab=regular");
    expect(screen.queryByText(/kéo thả/i)).not.toBeInTheDocument();
  });

  it("updates the visible order immediately and persists the selected move", async () => {
    const user = userEvent.setup();
    render(<SetReorderList initialSets={sets} doneHref="/sets?tab=regular" />);

    await user.click(screen.getByRole("button", { name: "Đưa Bộ hai lên" }));

    expect(mocks.moveSet).toHaveBeenCalledWith({ setId: sets[1].id, direction: "up" });
    const list = within(screen.getByRole("list", { name: "Thứ tự bộ flashcard" }));
    expect(list.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Bộ hai"),
      expect.stringContaining("Bộ một"),
      expect.stringContaining("Bộ ba"),
    ]);
  });

  it("restores the previous order and explains a recoverable save failure", async () => {
    mocks.moveSet.mockResolvedValue({ ok: false, error: "Không thể lưu thứ tự." });
    const user = userEvent.setup();
    render(<SetReorderList initialSets={sets} doneHref="/sets?tab=regular" />);

    await user.click(screen.getByRole("button", { name: "Đưa Bộ hai lên" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể lưu thứ tự.");
    const list = within(screen.getByRole("list", { name: "Thứ tự bộ flashcard" }));
    expect(list.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Bộ một"),
      expect.stringContaining("Bộ hai"),
      expect.stringContaining("Bộ ba"),
    ]);
  });
});
