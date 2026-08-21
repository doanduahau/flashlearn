import { BOOTSTRAP_OWNER_CONFIRMATION } from "./lib/bootstrap-owner-options";
import { isCapyStudyProductionSupabaseUrl } from "../src/lib/supabase/production-project";
import { createClient } from "@supabase/supabase-js";
import {
  resolveAdminCandidate,
  bootstrapOwner,
} from "../src/features/admin/server/owner-bootstrap";
import { getSupabaseServiceConfig } from "../src/lib/env";

export type BootstrapOwnerOptions = {
  email: string;
  reason: string;
  correlationId?: string;
  operatorUserId?: string;
  execute: boolean;
};

export function parseBootstrapOwnerOptions(args: string[]): BootstrapOwnerOptions {
  const options: BootstrapOwnerOptions = {
    email: "",
    reason: "",
    execute: false,
  };
  let confirmation: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--execute") options.execute = true;
    else if (flag === "--email") options.email = args[++index] ?? "";
    else if (flag === "--reason") options.reason = args[++index] ?? "";
    else if (flag === "--correlation-id") options.correlationId = args[++index] ?? "";
    else if (flag === "--operator-user-id") options.operatorUserId = args[++index] ?? "";
    else if (flag === "--confirm") confirmation = args[++index];
    else throw new Error(`Unknown argument: ${flag}`);
  }

  if (!options.email.trim()) throw new Error("--email is required");
  if (!options.reason.trim()) throw new Error("--reason is required");
  if (options.reason.trim().length > 500) {
    throw new Error("--reason must be 500 characters or fewer");
  }
  if (options.execute && confirmation !== BOOTSTRAP_OWNER_CONFIRMATION) {
    throw new Error(`--execute requires --confirm ${BOOTSTRAP_OWNER_CONFIRMATION}`);
  }

  return options;
}

/**
 * Production-safe owner bootstrap procedure.
 * - DRY-RUN mode (default): validates everything, shows what would happen, makes no changes.
 * - Execute mode (--execute + --confirm): performs the bootstrap after all checks pass.
 * - Never hardcodes email/password; all values come from CLI arguments.
 * - All audit logging is handled by the SECURITY DEFINER RPC.
 */
async function main(): Promise<void> {
  const options = parseBootstrapOwnerOptions(process.argv.slice(2));
  const { url, serviceRoleKey } = getSupabaseServiceConfig();

  // 1. Production/ref verification
  if (isCapyStudyProductionSupabaseUrl(url)) {
    console.log(`Production project ref verified: ${url}`);
  } else {
    throw new Error(
      `This bootstrap script is only for CapyStudy production (ref: rtrllrlilupoesikeypt).`,
    );
  }

  // 2. Resolve admin candidate by email (operator-provided, not hardcoded)
  const client = createClient(url, serviceRoleKey, {
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

  // 3. Email confirmation check
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

  // 4. DRY-RUN: show what would happen, don't make changes
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

  // 5. EXECUTE mode: perform the bootstrap with idempotent role grant
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
