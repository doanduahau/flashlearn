const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

export function requireLocalEndpoint(name: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(
      `Missing local endpoint ${name}; run E2E through "npm run test:e2e" so endpoints are injected.`,
    );
  }

  let hostname: string;
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

export function mailpitUrl(): string {
  return requireLocalEndpoint("MAILPIT_URL", process.env.MAILPIT_URL);
}
