import { spawn } from "node:child_process";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function runStatus(npmCliPath, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [npmCliPath, "exec", "--", "supabase", "status", "-o", "json"],
      {
        cwd,
        stdio: ["ignore", "pipe", "inherit"],
        env: process.env,
      },
    );
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error(`supabase status failed with exit code ${code ?? "unknown"}.`)),
    );
  });
}

export function requireLocalEndpoint(name, value) {
  if (!value || !value.trim()) {
    throw new Error(`Missing local Supabase endpoint ${name}; is the local stack running?`);
  }

  let hostname;
  try {
    hostname = new URL(value).hostname;
  } catch {
    throw new Error(`${name} is not a valid URL (${value}); refusing to continue.`);
  }

  if (!LOCAL_HOSTNAMES.has(hostname)) {
    throw new Error(
      `${name} points to a non-local host (${value}); refusing to run E2E against a remote Supabase project.`,
    );
  }

  return value;
}

export async function resolveLocalSupabaseEnv(npmCliPath, cwd = process.cwd()) {
  const status = JSON.parse(await runStatus(npmCliPath, cwd));

  const supabaseUrl = requireLocalEndpoint("API_URL", status.API_URL);
  const publishableKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
  if (!publishableKey) {
    throw new Error("Missing local Supabase publishable/anon key from supabase status.");
  }

  const mailpitUrl = requireLocalEndpoint("MAILPIT_URL", status.MAILPIT_URL ?? status.INBUCKET_URL);

  const serviceRoleKey = status.SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing local Supabase service role key from supabase status.");
  }

  return { supabaseUrl, publishableKey, mailpitUrl, serviceRoleKey };
}
