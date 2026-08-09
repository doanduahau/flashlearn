import { spawn } from "node:child_process";

import { resolveLocalSupabaseEnv } from "./lib/local-supabase-env.mjs";

const npmCliPath = process.env.npm_execpath;
if (!npmCliPath) throw new Error("npm_execpath is required for the local FSRS runner.");

const { supabaseUrl, publishableKey, serviceRoleKey } = await resolveLocalSupabaseEnv(npmCliPath);

const localEnv = {
  ...process.env,
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
};

const child = spawn(
  process.execPath,
  [
    npmCliPath,
    "exec",
    "--",
    "vitest",
    "run",
    "tests/integration/fsrs-reconciliation.integration.test.ts",
  ],
  {
    stdio: "inherit",
    env: localEnv,
  },
);
child.once("exit", (code) => (process.exitCode = code ?? 1));
