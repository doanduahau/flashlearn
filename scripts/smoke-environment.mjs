const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const readinessToken = process.env.HEALTHCHECK_TOKEN;

if (!appUrl || !readinessToken) {
  throw new Error("NEXT_PUBLIC_APP_URL and HEALTHCHECK_TOKEN are required for a smoke check.");
}

const liveness = await fetch(new URL("/api/health", appUrl));
if (!liveness.ok) throw new Error(`Liveness failed with ${liveness.status}.`);

const readiness = await fetch(new URL("/api/health/ready", appUrl), {
  headers: { Authorization: `Bearer ${readinessToken}` },
});
if (readiness.status !== 204) throw new Error(`Readiness failed with ${readiness.status}.`);

console.log("Environment smoke check passed.");
