import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  classifierReset: vi.fn(),
  getCalls: vi.fn(() => 7),
  readFileSync: vi.fn(() => "4"),
  writeFileSync: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/imports/adapters/gemini-classifier", () => ({
  mockClassifierCount: {
    get calls() {
      return mocks.getCalls();
    },
    reset: mocks.classifierReset,
  },
}));
vi.mock("node:fs", () => ({
  default: {
    readFileSync: mocks.readFileSync,
    writeFileSync: mocks.writeFileSync,
    existsSync: vi.fn(() => true),
  },
  readFileSync: mocks.readFileSync,
  writeFileSync: mocks.writeFileSync,
  existsSync: vi.fn(() => true),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
  mocks.getCalls.mockReturnValue(7);
  mocks.readFileSync.mockReturnValue("4");
});

describe("test-only import instrumentation routes", () => {
  it("returns 404 for classifier instrumentation unless its trusted E2E env is enabled", async () => {
    vi.stubEnv("FLASHLEARN_CLASSIFIER_MOCK", "");
    const { GET } = await import("@/app/api/test/classifier-count/route");

    const response = await GET(new Request("http://localhost/api/test/classifier-count?reset=1"));

    expect(response.status).toBe(404);
    expect(mocks.classifierReset).not.toHaveBeenCalled();
  });

  it("allows classifier reset only after the server environment enables the mock", async () => {
    vi.stubEnv("FLASHLEARN_CLASSIFIER_MOCK", "1");
    const { GET } = await import("@/app/api/test/classifier-count/route");

    const response = await GET(new Request("http://localhost/api/test/classifier-count?reset=1"));

    expect(response.status).toBe(200);
    expect(mocks.classifierReset).toHaveBeenCalledTimes(1);
  });

  it("returns 404 for generation instrumentation unless its trusted E2E env is enabled", async () => {
    vi.stubEnv("FLASHLEARN_GENERATION_MOCK", "");
    const { GET } = await import("@/app/api/test/generation-count/route");

    const response = await GET(
      new Request("http://localhost/api/test/generation-count?fail=1&path=../../outside"),
    );

    expect(response.status).toBe(404);
    expect(mocks.readFileSync).not.toHaveBeenCalled();
    expect(mocks.writeFileSync).not.toHaveBeenCalled();
  });

  it("uses only configured server paths and ignores request path parameters", async () => {
    vi.stubEnv("FLASHLEARN_GENERATION_MOCK", "1");
    vi.stubEnv("FLASHLEARN_GENERATION_COUNT_FILE", "test-results/generation-count.txt");
    vi.stubEnv("FLASHLEARN_GENERATION_MOCK_FAIL_FILE", "test-results/generation-fail.txt");
    const { GET } = await import("@/app/api/test/generation-count/route");

    const response = await GET(
      new Request("http://localhost/api/test/generation-count?fail=1&path=../../outside"),
    );

    expect(response.status).toBe(200);
    expect(mocks.writeFileSync).toHaveBeenCalledWith(
      "test-results/generation-fail.txt",
      "1",
      "utf8",
    );
    expect(mocks.writeFileSync).not.toHaveBeenCalledWith(
      "../../outside",
      expect.anything(),
      "utf8",
    );
  });
});
