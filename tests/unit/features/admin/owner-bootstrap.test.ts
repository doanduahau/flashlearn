import { describe, expect, it, vi } from "vitest";

import { bootstrapOwner, resolveAdminCandidate } from "@/features/admin/server/owner-bootstrap";
import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Supabase = SupabaseClient<Database>;

const rpc = vi.fn();
const client = { rpc } as unknown as Supabase;

const EMAIL = "owner@example.test";

describe("resolveAdminCandidate", () => {
  it("returns the candidate when the resolver finds one", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          user_id: "aaaaaaaa-0000-4000-8000-000000000001",
          email: "owner@example.test",
          email_confirmed_at: "2026-08-20T00:00:00Z",
          is_active_owner: false,
        },
      ],
      error: null,
    });

    const candidate = await resolveAdminCandidate(client, EMAIL);

    expect(candidate).toEqual({
      userId: "aaaaaaaa-0000-4000-8000-000000000001",
      email: "owner@example.test",
      emailConfirmedAt: "2026-08-20T00:00:00Z",
      isActiveOwner: false,
    });
    expect(rpc).toHaveBeenCalledWith("get_admin_user_by_email", { p_email: EMAIL });
  });

  it("returns null when the user does not exist", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });

    await expect(resolveAdminCandidate(client, "missing@example.test")).resolves.toBeNull();
  });

  it("throws when the resolver fails", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error("db exploded") });

    await expect(resolveAdminCandidate(client, EMAIL)).rejects.toThrow(
      "admin candidate lookup failed",
    );
  });
});

describe("bootstrapOwner", () => {
  it("bootstraps an owner and returns the created row", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          role_id: "cccccccc-0000-4000-8000-000000000003",
          role: "owner",
          granted_at: "2026-08-20T00:00:00Z",
          bootstrap_status: "created",
        },
      ],
      error: null,
    });

    const result = await bootstrapOwner(client, {
      email: EMAIL,
      reason: "first owner",
      correlationId: "corr-1",
      actorUserId: "dddddddd-0000-4000-8000-000000000004",
    });

    expect(result).toEqual({
      roleId: "cccccccc-0000-4000-8000-000000000003",
      role: "owner",
      grantedAt: "2026-08-20T00:00:00Z",
      status: "created",
    });
    expect(rpc).toHaveBeenCalledWith("bootstrap_owner", {
      p_email: EMAIL,
      p_reason: "first owner",
      p_correlation_id: "corr-1",
      p_actor_user_id: "dddddddd-0000-4000-8000-000000000004",
    });
  });

  it("reports an idempotent rerun", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          role_id: "cccccccc-0000-4000-8000-000000000003",
          role: "owner",
          granted_at: "2026-08-20T00:00:00Z",
          bootstrap_status: "idempotent",
        },
      ],
      error: null,
    });

    const result = await bootstrapOwner(client, { email: EMAIL, reason: "retry" });

    expect(result.status).toBe("idempotent");
  });

  it("throws when the trusted RPC rejects", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error("owner already exists") });

    await expect(bootstrapOwner(client, { email: EMAIL, reason: "second owner" })).rejects.toThrow(
      "owner bootstrap failed",
    );
  });
});
