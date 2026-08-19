import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  flush: vi.fn(),
  runtimeEnvironment: "staging",
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
  flush: mocks.flush,
}));
vi.mock("@/lib/env", () => ({
  env: {
    get runtimeEnvironment() {
      return mocks.runtimeEnvironment;
    },
  },
}));

import { GET } from "@/app/api/sentry-test/route";

const TOKEN = "staging-healthcheck-token";

function request(token?: string): Request {
  return new Request("https://staging.example.test/api/sentry-test", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

beforeEach(() => {
  vi.stubEnv("HEALTHCHECK_TOKEN", TOKEN);
  mocks.runtimeEnvironment = "staging";
  mocks.flush.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("GET /api/sentry-test", () => {
  it("returns 404 outside staging without sending an event", async () => {
    mocks.runtimeEnvironment = "production";

    const response = await GET(request(TOKEN));

    expect(response.status).toBe(404);
    expect(mocks.captureException).not.toHaveBeenCalled();
    expect(mocks.flush).not.toHaveBeenCalled();
  });

  it.each([undefined, "wrong-token"])(
    "returns 404 in staging for a missing or invalid bearer token",
    async (token) => {
      const response = await GET(request(token));

      expect(response.status).toBe(404);
      expect(mocks.captureException).not.toHaveBeenCalled();
      expect(mocks.flush).not.toHaveBeenCalled();
    },
  );

  it("captures and flushes the staging test exception before returning 204", async () => {
    const response = await GET(request(TOKEN));

    expect(response.status).toBe(204);
    expect(mocks.captureException).toHaveBeenCalledTimes(1);
    expect(mocks.captureException.mock.calls[0]?.[0]).toMatchObject({
      message: "capystudy-staging-sentry-test",
    });
    expect(mocks.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { event: "capystudy-staging-sentry-test" },
    });
    expect(mocks.flush).toHaveBeenCalledWith(5_000);
    expect(mocks.captureException.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.flush.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it("returns 503 when Sentry cannot flush the event", async () => {
    mocks.flush.mockResolvedValue(false);

    const response = await GET(request(TOKEN));

    expect(response.status).toBe(503);
    expect(mocks.captureException).toHaveBeenCalledTimes(1);
    expect(mocks.flush).toHaveBeenCalledTimes(1);
  });
});
