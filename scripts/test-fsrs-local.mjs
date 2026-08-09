import { spawn } from "node:child_process";

import { resolveLocalSupabaseEnv } from "./lib/local-supabase-env.mjs";

const npmCliPath = process.env.npm_execpath;
if (!npmCliPath) throw new Error("npm_execpath is required for the local FSRS runner.");

const { supabaseUrl, publishableKey, serviceRoleKey } = await resolveLocalSupabaseEnv(npmCliPath);
const child = spawn(
  process.execPath,
  [
    npmCliPath,
    "run",
    "test",
    "--",
    "tests/integration/fsrs-reconciliation.integration.test.ts",
    "tests/integration/fsrs-shadow-quiz.integration.test.ts",
    "tests/integration/fsrs-due-read.integration.test.ts",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    },
  },
);

child.once("exit", (code) => (process.exitCode = code ?? 1));
