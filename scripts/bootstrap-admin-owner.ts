import { createClient } from "@supabase/supabase-js";

import { getSupabaseServiceConfig } from "../src/lib/env";
import { isCapyStudyProductionSupabaseUrl } from "../src/lib/supabase/production-project";
import type { Database } from "../src/lib/supabase/types";
import {
  bootstrapOwner,
  resolveAdminCandidate,
} from "../src/features/admin/server/owner-bootstrap";
import { parseBootstrapOwnerOptions } from "./lib/bootstrap-owner-options";

async function main(): Promise<void> {
  const options = parseBootstrapOwnerOptions(process.argv.slice(2));

  const { url, serviceRoleKey } = getSupabaseServiceConfig();
  if (isCapyStudyProductionSupabaseUrl(url)) {
    throw new Error(
      "refusing to bootstrap an admin owner on the production Supabase project; use staging",
    );
  }
  const client = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const candidate = await resolveAdminCandidate(client, options.email);
  if (!candidate) {
    console.error(
      JSON.stringify({
        mode: options.execute ? "execute" : "dry-run",
        email: options.email,
        status: "error",
        errorCode: "user_not_found",
      }),
    );
    process.exitCode = 1;
    return;
  }
  if (!candidate.emailConfirmedAt) {
    console.error(
      JSON.stringify({
        mode: options.execute ? "execute" : "dry-run",
        email: options.email,
        status: "error",
        errorCode: "email_not_confirmed",
      }),
    );
    process.exitCode = 1;
    return;
  }

  if (!options.execute) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          email: options.email,
          candidate: {
            userId: candidate.userId,
            email: candidate.email,
            emailConfirmedAt: candidate.emailConfirmedAt,
            isActiveOwner: candidate.isActiveOwner,
          },
          wouldCreateOwner: !candidate.isActiveOwner,
          status: "ok",
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = await bootstrapOwner(client, {
    email: options.email,
    reason: options.reason,
    correlationId: options.correlationId,
    actorUserId: options.operatorUserId,
  });

  console.log(
    JSON.stringify(
      {
        mode: "execute",
        email: options.email,
        status: result.status === "idempotent" ? "already_owner" : "owner_created",
        result: {
          roleId: result.roleId,
          role: result.role,
          grantedAt: result.grantedAt,
          status: result.status,
        },
      },
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "owner_bootstrap_failed";
  console.error(`Owner bootstrap failed: ${message}`);
  process.exitCode = 1;
});
