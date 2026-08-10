import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  countNewCards,
  loadNewCardCandidateResult,
} from "@/features/spaced-repetition/server/new-cards-repository";

describe("New Cards repository", () => {
  it("uses one database read for the full count and capped ordered candidates", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          total: 14,
          flashcard_id: "00000000-0000-4000-8000-000000000001",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const supabase = { rpc };

    await expect(loadNewCardCandidateResult(supabase as never, 99)).resolves.toEqual({
      total: 14,
      candidates: [
        {
          flashcardId: "00000000-0000-4000-8000-000000000001",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(rpc).toHaveBeenCalledWith("load_new_card_candidates", { p_limit: 10 });
  });

  it("keeps a database failure distinct from an empty New Cards result", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "XX000" } });

    await expect(countNewCards({ rpc } as never)).rejects.toThrow(
      "Unable to load New Card candidates",
    );
  });
});
