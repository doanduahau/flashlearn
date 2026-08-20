// @vitest-environment node

import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !serviceKey) {
  describe.skip("storage quota concurrency — needs local Supabase env", () => {
    it("is skipped when local Supabase is absent", () => {});
  });
} else {
  const localUrl = supabaseUrl;
  const localPublishableKey = publishableKey;
  const admin = createClient<Database>(localUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const password = "IntegrationTest1!";
  const users: string[] = [];
  let cappedClient: SupabaseClient<Database>;
  let importClient: SupabaseClient<Database>;
  let cappedSetId = "";

  async function createSignedInUser(label: string) {
    const email = `${label}-${randomUUID()}@test.capystudy.dev`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error("missing user");
    users.push(created.data.user.id);
    const client = createClient<Database>(localUrl, localPublishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signedIn = await client.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;
    return { client, userId: created.data.user.id };
  }

  beforeAll(async () => {
    const enforcement = await admin
      .from("quota_runtime_settings")
      .update({ storage_enforcement_mode: "block" })
      .eq("singleton", true);
    if (enforcement.error) throw enforcement.error;

    const capped = await createSignedInUser("storage-cap");
    cappedClient = capped.client;
    const imported = await createSignedInUser("storage-import");
    importClient = imported.client;

    const set = await admin
      .from("flashcard_sets")
      .insert({ user_id: capped.userId, name: "Near cap" })
      .select("id")
      .single();
    if (set.error) throw set.error;
    cappedSetId = set.data.id;
    const rows = Array.from({ length: 2_999 }, (_, position) => ({
      user_id: capped.userId,
      set_id: cappedSetId,
      front: `F${position}`,
      back: `B${position}`,
      position,
    }));
    for (let start = 0; start < rows.length; start += 1_000) {
      const inserted = await admin.from("flashcards").insert(rows.slice(start, start + 1_000));
      if (inserted.error) throw inserted.error;
    }
  }, 30_000);

  afterAll(async () => {
    for (const userId of users) await admin.auth.admin.deleteUser(userId);
    await admin
      .from("quota_runtime_settings")
      .update({ storage_enforcement_mode: "observe" })
      .eq("singleton", true);
  });

  describe("storage quota concurrency", () => {
    it("allows only one of two concurrent cards at the final Free slot", async () => {
      const [first, second] = await Promise.all([
        cappedClient.rpc("add_flashcard_with_quota", {
          p_set_id: cappedSetId,
          p_front: "Concurrent A",
          p_back: "A",
        }),
        cappedClient.rpc("add_flashcard_with_quota", {
          p_set_id: cappedSetId,
          p_front: "Concurrent B",
          p_back: "B",
        }),
      ]);
      expect([first.error, second.error].filter(Boolean)).toHaveLength(1);
      const count = await admin
        .from("flashcards")
        .select("id", { count: "exact", head: true })
        .eq("set_id", cappedSetId);
      expect(count.count).toBe(3_000);
    });

    it("deduplicates concurrent retries with the same logical import key", async () => {
      const idempotencyKey = randomUUID();
      const args = {
        p_name: "Concurrent import",
        p_cards: [{ front: "A", back: "B" }],
        p_idempotency_key: idempotencyKey,
        p_source_type: "manual",
        p_source_bytes: 0,
        p_source_chars: 0,
        p_ai_used: false,
      };
      const [first, second] = await Promise.all([
        importClient.rpc("commit_flashcard_import", args),
        importClient.rpc("commit_flashcard_import", args),
      ]);
      expect(first.error).toBeNull();
      expect(second.error).toBeNull();
      expect(first.data?.[0]?.set_id).toBe(second.data?.[0]?.set_id);
      expect([first.data?.[0]?.already_exists, second.data?.[0]?.already_exists].sort()).toEqual([
        false,
        true,
      ]);
    });
  });
}
