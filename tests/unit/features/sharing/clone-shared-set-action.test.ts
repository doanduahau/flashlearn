import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { cloneSharedSet } from "@/features/sharing/server/actions";

const TOKEN = "a".repeat(32);
const SET_ID = "11111111-1111-4111-8111-111111111111";

describe("cloneSharedSet", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.createAdminClient.mockReset();
    mocks.revalidatePath.mockReset();
  });

  function setupAuthenticated() {
    mocks.createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-a" } } }),
      },
    });
  }

  it("rejects a malformed token before touching Supabase", async () => {
    const result = await cloneSharedSet("not-a-valid-token");
    expect(result).toEqual({ error: "Token chia sẻ không hợp lệ." });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("returns a login-required error when not authenticated", async () => {
    mocks.createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: {} } }),
      },
    });

    const result = await cloneSharedSet(TOKEN);
    expect(result).toEqual({ error: "Bạn cần đăng nhập để lưu bộ flashcard này." });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("clones through the admin RPC and revalidates the set lists on success", async () => {
    setupAuthenticated();
    const admin = {
      rpc: vi.fn().mockResolvedValue({ data: [{ new_set_id: SET_ID }], error: null }),
    };
    mocks.createAdminClient.mockReturnValue(admin);

    const result = await cloneSharedSet(TOKEN);
    expect(result).toEqual({ setId: SET_ID });
    expect(admin.rpc).toHaveBeenCalledWith("clone_shared_set", {
      p_token: TOKEN,
      p_user_id: "user-a",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/sets");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/sets/library");
  });

  it("returns a generic error when the RPC fails", async () => {
    setupAuthenticated();
    const admin = { rpc: vi.fn().mockResolvedValue({ data: null, error: new Error("boom") }) };
    mocks.createAdminClient.mockReturnValue(admin);

    const result = await cloneSharedSet(TOKEN);
    expect(result).toEqual({
      error: "Không thể lưu bộ flashcard này lúc này. Vui lòng thử lại.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
