// @vitest-environment node

import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  describe.skip("starter provisioning concurrency — needs local Supabase env", () => {
    it("is skipped when local Supabase is absent", () => {});
  });
} else {
  const admin = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let userId = "";

  beforeAll(async () => {
    const created = await admin.auth.admin.createUser({
      email: `starter-${randomUUID()}@test.capystudy.dev`,
      password: "IntegrationTest1!",
      email_confirm: true,
    });
    if (created.error || !created.data.user) throw created.error ?? new Error("missing user");
    userId = created.data.user.id;
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  describe("starter provisioning concurrency", () => {
    it("serializes simultaneous requests into exactly three sets", async () => {
      const [first, second] = await Promise.all([
        admin.rpc("provision_starter_sets", { p_user_id: userId }),
        admin.rpc("provision_starter_sets", { p_user_id: userId }),
      ]);
      expect(first.error).toBeNull();
      expect(second.error).toBeNull();
      expect(first.data?.[0]?.provisioning_status).toBe("completed");
      expect(second.data?.[0]?.provisioning_status).toBe("completed");

      const [sets, cards] = await Promise.all([
        admin
          .from("flashcard_sets")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
        admin.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);
      expect(sets.count).toBe(3);
      expect(cards.count).toBe(150);
    });
  });
}
