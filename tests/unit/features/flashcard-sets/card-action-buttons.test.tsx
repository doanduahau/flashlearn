import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  updateCardCollections: vi.fn(),
  updateCard: vi.fn(),
  deleteCard: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/features/special-collections/server/actions", () => ({
  updateCardCollections: mocks.updateCardCollections,
}));
vi.mock("@/features/flashcard-sets/server/actions", () => ({
  updateCard: mocks.updateCard,
  deleteCard: mocks.deleteCard,
}));

import { CardCollectionsControl } from "@/features/special-collections/components/card-collections-control";
import { DeleteCardButton } from "@/features/flashcard-sets/components/delete-card-button";
import { EditCardForm } from "@/features/flashcard-sets/components/edit-card-form";

const SET_ID = "11111111-1111-4111-8111-111111111111";
const CARD_ID = "22222222-2222-4222-8222-222222222222";
const COLLECTION_A = "33333333-3333-4333-8333-333333333333";

describe("card action icon buttons", () => {
  beforeEach(() => {
    mocks.updateCardCollections.mockReset();
    mocks.updateCard.mockReset();
    mocks.deleteCard.mockReset();
  });

  it("renders uniform icon-only triggers with accessible labels and tooltips", () => {
    render(
      <div>
        <CardCollectionsControl
          cardId={CARD_ID}
          setId={SET_ID}
          collections={[{ id: COLLECTION_A, name: "Khó nhớ" }]}
          memberships={[]}
          variant="icon"
        />
        <EditCardForm setId={SET_ID} cardId={CARD_ID} initialFront="f" initialBack="b" />
        <DeleteCardButton setId={SET_ID} cardId={CARD_ID} />
      </div>,
    );

    const buttons = [
      screen.getByRole("button", { name: "Thêm vào bộ đặc biệt" }),
      screen.getByRole("button", { name: "Sửa thẻ" }),
      screen.getByRole("button", { name: "Xóa thẻ" }),
    ];

    for (const button of buttons) {
      expect(button.querySelector("svg")).not.toBeNull();
      expect(button.getAttribute("title")).toBeTruthy();
      expect(button).not.toHaveTextContent(/\S/);
    }
  });
});
