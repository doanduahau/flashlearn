import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { resolveLocalSupabaseEnv } from "./lib/local-supabase-env.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = resolve(repositoryRoot, "supabase/config.toml");
const npmCliPath = process.env.npm_execpath;

if (!npmCliPath) {
  throw new Error("npm_execpath is required to run the local Supabase test workflow.");
}

function runNpm(args, { showOutput = false, env = process.env } = {}) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(process.execPath, [npmCliPath, ...args], {
      cwd: repositoryRoot,
      stdio: showOutput ? "inherit" : "ignore",
      env,
    });

    child.once("error", () => rejectCommand(new Error(`Could not run npm ${args.join(" ")}.`)));
    child.once("exit", (code) => {
      if (code === 0) {
        resolveCommand();
        return;
      }
      rejectCommand(new Error(`npm ${args.join(" ")} failed with exit code ${code ?? "unknown"}.`));
    });
  });
}

function disableConfirmations(config) {
  const matches = config.match(/^enable_confirmations\s*=\s*true\s*$/gm);
  if (matches?.length !== 1) {
    throw new Error(
      "Expected exactly one enabled email-confirmation setting in supabase/config.toml.",
    );
  }
  return config.replace(/^enable_confirmations\s*=\s*true\s*$/m, "enable_confirmations = false");
}

async function restartAndReset() {
  await runNpm(["run", "supabase:stop"]);
  await runNpm(["run", "supabase:start"]);
  await runNpm(["run", "db:reset"]);
}

const originalConfig = await readFile(configPath, "utf8");
let primaryError;

try {
  await writeFile(configPath, disableConfirmations(originalConfig), "utf8");
  await restartAndReset();
  const { supabaseUrl, publishableKey, mailpitUrl } = await resolveLocalSupabaseEnv(
    npmCliPath,
    repositoryRoot,
  );
  const localEnv = {
    ...process.env,
    NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    MAILPIT_URL: mailpitUrl,
  };
  await runNpm(
    [
      "exec",
      "--",
      "playwright",
      "test",
      "--config=playwright.auth-no-confirm.config.ts",
      "--workers=1",
    ],
    {
      showOutput: true,
      env: localEnv,
    },
  );
} catch (error) {
  primaryError = error;
} finally {
  await writeFile(configPath, originalConfig, "utf8");
  try {
    await restartAndReset();
  } catch (restoreError) {
    if (!primaryError) {
      primaryError = restoreError;
    }
  }
}

if (primaryError) {
  throw primaryError;
}
