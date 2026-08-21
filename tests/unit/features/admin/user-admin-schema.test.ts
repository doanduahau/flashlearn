import { describe, expect, it } from "vitest";

import {
  adjustUserUsageSchema,
  overrideUserEntitlementSchema,
  removeUserEntitlementOverrideSchema,
} from "@/features/admin/schemas/user-admin-schema";

describe("User Admin Schemas", () => {
  describe("adjustUserUsageSchema", () => {
    it("validates positive credit adjustment", () => {
      const valid = {
        target_user_id: "00000000-0000-4000-8000-000000000001",
        usage_key: "ai.content_credits.monthly",
        amount: 50,
        reason: "Hỗ trợ khách hàng gặp lỗi kỹ thuật trong phiên học",
        mutation_token: "11111111-1111-4111-8111-111111111111",
      };
      const result = adjustUserUsageSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("validates negative debit adjustment", () => {
      const valid = {
        target_user_id: "00000000-0000-4000-8000-000000000001",
        usage_key: "ai.content_credits.monthly",
        amount: -20,
        reason: "Khấu trừ hạn mức do yêu cầu hoàn hủy tác vụ",
      };
      const result = adjustUserUsageSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects 0 amount", () => {
      const invalid = {
        target_user_id: "00000000-0000-4000-8000-000000000001",
        usage_key: "ai.content_credits.monthly",
        amount: 0,
        reason: "Hỗ trợ khách hàng gặp lỗi kỹ thuật trong phiên học",
      };
      const result = adjustUserUsageSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects amount exceeding 10,000 bounds", () => {
      const invalid = {
        target_user_id: "00000000-0000-4000-8000-000000000001",
        usage_key: "ai.content_credits.monthly",
        amount: 10001,
        reason: "Hỗ trợ khách hàng gặp lỗi kỹ thuật trong phiên học",
      };
      const result = adjustUserUsageSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects reason shorter than 10 chars", () => {
      const invalid = {
        target_user_id: "00000000-0000-4000-8000-000000000001",
        usage_key: "ai.content_credits.monthly",
        amount: 10,
        reason: "ngắn quá",
      };
      const result = adjustUserUsageSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("overrideUserEntitlementSchema", () => {
    it("validates valid integer override with future expiration", () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const valid = {
        target_user_id: "00000000-0000-4000-8000-000000000001",
        entitlement_key: "sets.regular.max",
        value_type: "integer",
        integer_value: 500,
        expires_at: futureDate,
        expected_updated_at: "2026-08-21T10:15:30.123456+00:00",
        reason: "Nâng hạn mức bộ thẻ cho dự án nghiên cứu ngôn ngữ",
      };
      const result = overrideUserEntitlementSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects negative integer value", () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const invalid = {
        target_user_id: "00000000-0000-4000-8000-000000000001",
        entitlement_key: "sets.regular.max",
        value_type: "integer",
        integer_value: -5,
        expires_at: futureDate,
        reason: "Nâng hạn mức bộ thẻ cho dự án nghiên cứu ngôn ngữ",
      };
      const result = overrideUserEntitlementSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects expiration in the past", () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const invalid = {
        target_user_id: "00000000-0000-4000-8000-000000000001",
        entitlement_key: "sets.regular.max",
        value_type: "integer",
        integer_value: 50,
        expires_at: pastDate,
        reason: "Nâng hạn mức bộ thẻ cho dự án nghiên cứu ngôn ngữ",
      };
      const result = overrideUserEntitlementSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects expiration exceeding 365 days", () => {
      const tooFarDate = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString();
      const invalid = {
        target_user_id: "00000000-0000-4000-8000-000000000001",
        entitlement_key: "sets.regular.max",
        value_type: "integer",
        integer_value: 50,
        expires_at: tooFarDate,
        reason: "Nâng hạn mức bộ thẻ cho dự án nghiên cứu ngôn ngữ",
      };
      const result = overrideUserEntitlementSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("removeUserEntitlementOverrideSchema", () => {
    it("validates valid removal input", () => {
      const valid = {
        target_user_id: "00000000-0000-4000-8000-000000000001",
        entitlement_key: "sets.regular.max",
        expected_updated_at: "2026-08-21T10:15:30.123456+00:00",
        reason: "Khôi phục hạn mức mặc định theo gói sau khi kết thúc thử nghiệm",
      };
      const result = removeUserEntitlementOverrideSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects short reason", () => {
      const invalid = {
        target_user_id: "00000000-0000-4000-8000-000000000001",
        entitlement_key: "sets.regular.max",
        reason: "xong rồi",
      };
      const result = removeUserEntitlementOverrideSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
