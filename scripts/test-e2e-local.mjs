import { spawn } from "node:child_process";

import { resolveLocalSupabaseEnv } from "./lib/local-supabase-env.mjs";

const npmCliPath = process.env.npm_execpath;
if (!npmCliPath) throw new Error("npm_execpath is required for the local E2E runner.");

function runNpm(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npmCliPath, ...args], {
      stdio: ["ignore", "pipe", "inherit"],
      env,
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error(`npm ${args.join(" ")} failed with exit code ${code ?? "unknown"}.`)),
    );
  });
}

const { supabaseUrl, publishableKey, mailpitUrl, serviceRoleKey } =
  await resolveLocalSupabaseEnv(npmCliPath);

const localEnv = {
  ...process.env,
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  FLASHLEARN_ENVIRONMENT: "test",
  MAILPIT_URL: mailpitUrl,
  // Use the test-only classifier mock so E2E never calls real Gemini.
  CAPYSTUDY_CLASSIFIER_MOCK: "1",
  CAPYSTUDY_CLASSIFIER_COUNT_FILE: "test-results/classifier-count.txt",
  // Use the test-only generation mock so E2E never calls real Gemini.
  CAPYSTUDY_GENERATION_MOCK: "1",
  CAPYSTUDY_GENERATION_COUNT_FILE: "test-results/generation-count.txt",
  CAPYSTUDY_GENERATION_MOCK_FAIL_FILE: "test-results/generation-fail.txt",
  // Use the test-only typing AI reviewer mock so E2E never calls real Gemini.
  CAPYSTUDY_TYPING_AI_MOCK: "1",
  CAPYSTUDY_TYPING_AI_COUNT_FILE: "test-results/typing-ai-count.txt",
};
await runNpm(["run", "build"], localEnv);
const child = spawn(
  process.execPath,
  [npmCliPath, "exec", "--", "playwright", "test", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: localEnv,
  },
);
child.once("exit", (code) => (process.exitCode = code ?? 1));
