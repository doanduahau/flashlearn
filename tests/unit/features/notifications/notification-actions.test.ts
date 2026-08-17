import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deletePushSubscription,
  saveNotificationPreferences,
  savePushSubscription,
} from "@/features/notifications/server/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Notification Server Actions", () => {
  const mockGetClaims = vi.fn();
  const mockUpsert = vi.fn();
  const mockDelete = vi.fn();
  const mockEq = vi.fn();
  const mockFrom = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(createClient).mockResolvedValue({
      auth: { getClaims: mockGetClaims },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    mockEq.mockImplementation(() => ({
      eq: mockEq,
      then: (resolve: (val: { error: null }) => void) => resolve({ error: null }),
    }));
    mockDelete.mockReturnValue({ eq: mockEq });
    mockUpsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      upsert: mockUpsert,
      delete: mockDelete,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof createAdminClient>);
  });

  describe("saveNotificationPreferences", () => {
    it("fails validation on invalid streak time format", async () => {
      const result = await saveNotificationPreferences({
        pushEnabled: true,
        streakEnabled: true,
        streakTime: "25:00",
        reviewEnabled: true,
        reviewTime: "19:00",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Giờ nhắc giữ streak không hợp lệ");
      }
    });

    it("fails when user is unauthenticated", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: null }, error: null });

      const result = await saveNotificationPreferences({
        pushEnabled: true,
        streakEnabled: true,
        streakTime: "19:00",
        reviewEnabled: true,
        reviewTime: "19:00",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("Phiên đăng nhập đã hết hạn.");
      }
    });

    it("upserts notification preferences successfully when authenticated", async () => {
      mockGetClaims.mockResolvedValue({
        data: { claims: { sub: "user-123" } },
        error: null,
      });

      const result = await saveNotificationPreferences({
        pushEnabled: true,
        streakEnabled: true,
        streakTime: "08:30",
        reviewEnabled: false,
        reviewTime: "20:00",
      });

      expect(result.ok).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith("notification_preferences");
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-123",
          push_enabled: true,
          streak_enabled: true,
          streak_time: "08:30",
          review_enabled: false,
          review_time: "20:00",
        }),
        { onConflict: "user_id" },
      );
    });
  });

  describe("savePushSubscription", () => {
    it("fails validation when endpoint is empty", async () => {
      const result = await savePushSubscription({
        endpoint: "",
        p256dh: "key-p256",
        auth: "key-auth",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("Endpoint không được để trống.");
      }
    });

    it("upserts push subscription successfully", async () => {
      mockGetClaims.mockResolvedValue({
        data: { claims: { sub: "user-123" } },
        error: null,
      });

      const result = await savePushSubscription({
        endpoint: "https://push.example.com/sub-1",
        p256dh: "key-p256",
        auth: "key-auth",
        userAgent: "TestBrowser/1.0",
      });

      expect(result.ok).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith("push_subscriptions");
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-123",
          endpoint: "https://push.example.com/sub-1",
          p256dh: "key-p256",
          auth: "key-auth",
          user_agent: "TestBrowser/1.0",
        }),
        { onConflict: "user_id,endpoint" },
      );
    });
  });

  describe("deletePushSubscription", () => {
    it("deletes all subscriptions for user when endpoint is omitted", async () => {
      mockGetClaims.mockResolvedValue({
        data: { claims: { sub: "user-123" } },
        error: null,
      });

      const result = await deletePushSubscription();

      expect(result.ok).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith("push_subscriptions");
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
