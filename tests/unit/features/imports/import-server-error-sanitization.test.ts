import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { importFlashcards } from "@/features/imports/server/actions";

afterEach(() => {
  vi.clearAllMocks();
});

describe("import server error boundaries", () => {
  it("does not expose infrastructure error details when Supabase initialization fails", async () => {
    mocks.createClient.mockRejectedValue(new Error("internal SUPABASE_URL diagnostic"));

    const result = await importFlashcards({
      name: "An toàn",
      cards: [{ front: "Mặt trước", back: "Mặt sau" }],
    });

    expect("error" in result && result.error).toBe(
      "Không thể kết nối đến máy chủ. Vui lòng thử lại.",
    );
    expect(JSON.stringify(result)).not.toContain("SUPABASE_URL");
  });
});
