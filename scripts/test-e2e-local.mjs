import { spawn } from "node:child_process";

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

const status = JSON.parse(
  await runNpm(["exec", "--", "supabase", "status", "-o", "json"], process.env),
);
const supabaseUrl = status.API_URL;
const key = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const hostname = new URL(supabaseUrl).hostname;
if (!key || !["localhost", "127.0.0.1", "::1"].includes(hostname)) {
  throw new Error(
    "E2E safety guard: local Supabase URL and publishable key are required; refusing non-local tests.",
  );
}

const localEnv = {
  ...process.env,
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
};
await runNpm(["run", "build"], localEnv);
const child = spawn(process.execPath, [npmCliPath, "exec", "--", "playwright", "test"], {
  stdio: "inherit",
  env: localEnv,
});
child.once("exit", (code) => (process.exitCode = code ?? 1));
