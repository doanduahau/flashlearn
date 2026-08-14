import { describe, expect, it, vi } from "vitest";

import {
  ALLOWED_PRODUCTION_PROJECT_REFS,
  assertConfirmation,
  parseProductionArgs,
  PRODUCTION_CONFIRMATION_TOKEN,
  resolveProductionIdentity,
  validateProductionIdentity,
  isSecondPassClean,
  type ProductionIdentity,
  type RunnerMode,
} from "@/../scripts/fsrs-reconcile-production";
import { EMPTY_BACKFILL_AGGREGATE } from "@/features/spaced-repetition/types/reconciliation-types";

const TEST_ALLOWLIST = new Set(["abcd1234"]);
const HTTPS_PROD_URL = "https://abcd1234.supabase.co";

function identity(): ProductionIdentity {
  return { url: HTTPS_PROD_URL, projectRef: "abcd1234", serviceRoleKey: "svc-key" };
}

function envWith(values: Record<string, string>): NodeJS.ProcessEnv {
  return { ...values } as unknown as NodeJS.ProcessEnv;
}

describe("parseProductionArgs", () => {
  it("parses dry-run by default when --dry-run given", () => {
    const args = parseProductionArgs(["--dry-run"]);
    expect(args.mode).toBe("dry-run");
    expect(args.batchSize).toBe(50);
  });

  it("rejects no mode", () => {
    expect(() => parseProductionArgs([])).toThrow(/dry-run or --execute/);
  });

  it("rejects both modes", () => {
    expect(() => parseProductionArgs(["--dry-run", "--execute"])).toThrow(/not both/);
  });

  it("parses execute with batch size and confirm", () => {
    const args = parseProductionArgs([
      "--execute",
      "--batch-size",
      "100",
      "--confirm",
      PRODUCTION_CONFIRMATION_TOKEN,
    ]);
    expect(args.mode).toBe("execute");
    expect(args.batchSize).toBe(100);
    expect(args.confirm).toBe(PRODUCTION_CONFIRMATION_TOKEN);
  });

  it("rejects out-of-range batch sizes", () => {
    expect(() => parseProductionArgs(["--execute", "--batch-size", "0"])).toThrow(/batch-size/);
    expect(() => parseProductionArgs(["--execute", "--batch-size", "100000"])).toThrow(
      /batch-size/,
    );
    expect(() => parseProductionArgs(["--execute", "--batch-size", "abc"])).toThrow(/batch-size/);
  });

  it("keeps default batch size when not provided", () => {
    expect(parseProductionArgs(["--execute", "--confirm", "x"]).batchSize).toBe(50);
  });
});

describe("validateProductionIdentity", () => {
  it("accepts a valid allowlisted production identity", () => {
    expect(() => validateProductionIdentity(identity(), TEST_ALLOWLIST)).not.toThrow();
  });

  it("rejects non-https URLs", () => {
    expect(() =>
      validateProductionIdentity(
        { ...identity(), url: "http://abcd1234.supabase.co" },
        TEST_ALLOWLIST,
      ),
    ).toThrow(/https/);
  });

  it("rejects localhost", () => {
    expect(() =>
      validateProductionIdentity({ ...identity(), url: "https://127.0.0.1:54321" }, TEST_ALLOWLIST),
    ).toThrow(/must not point/);
    expect(() =>
      validateProductionIdentity({ ...identity(), url: "https://localhost:54321" }, TEST_ALLOWLIST),
    ).toThrow(/must not point/);
  });

  it("rejects a non-supabase hostname", () => {
    expect(() =>
      validateProductionIdentity({ ...identity(), url: "https://example.com" }, TEST_ALLOWLIST),
    ).toThrow(/supabase\.co/);
  });

  it("rejects a mismatched project ref", () => {
    expect(() =>
      validateProductionIdentity(
        { ...identity(), url: "https://other1234.supabase.co" },
        TEST_ALLOWLIST,
      ),
    ).toThrow(/does not match/);
  });

  it("rejects a project not in the allowlist", () => {
    expect(() =>
      validateProductionIdentity(
        { ...identity(), projectRef: "other1234", url: "https://other1234.supabase.co" },
        TEST_ALLOWLIST,
      ),
    ).toThrow(/not in the production allowlist/);
  });

  it("fails closed when the allowlist is empty", () => {
    expect(() => validateProductionIdentity(identity(), ALLOWED_PRODUCTION_PROJECT_REFS)).toThrow(
      /not in the production allowlist/,
    );
  });
});

describe("resolveProductionIdentity", () => {
  it("fails when required env vars are missing", () => {
    expect(() => resolveProductionIdentity(envWith({}), TEST_ALLOWLIST)).toThrow(
      /CAPYSTUDY_PRODUCTION_SUPABASE_URL/,
    );
    expect(() =>
      resolveProductionIdentity(
        envWith({
          CAPYSTUDY_PRODUCTION_SUPABASE_URL: HTTPS_PROD_URL,
          CAPYSTUDY_PRODUCTION_PROJECT_REF: "abcd1234",
        }),
        TEST_ALLOWLIST,
      ),
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("resolves a valid identity", () => {
    const resolved = resolveProductionIdentity(
      envWith({
        CAPYSTUDY_PRODUCTION_SUPABASE_URL: HTTPS_PROD_URL,
        CAPYSTUDY_PRODUCTION_PROJECT_REF: "abcd1234",
        SUPABASE_SERVICE_ROLE_KEY: "svc",
      }),
      TEST_ALLOWLIST,
    );
    expect(resolved.projectRef).toBe("abcd1234");
  });
});

describe("assertConfirmation", () => {
  it("allows dry-run without confirmation", () => {
    expect(() => assertConfirmation("dry-run", undefined)).not.toThrow();
  });

  it("rejects execute without the token", () => {
    expect(() => assertConfirmation("execute", undefined)).toThrow(/--confirm/);
    expect(() => assertConfirmation("execute", "wrong")).toThrow(/--confirm/);
    expect(() => assertConfirmation("execute", "capystudy-prod")).toThrow(/--confirm/);
  });

  it("accepts execute with the exact token", () => {
    expect(() => assertConfirmation("execute", PRODUCTION_CONFIRMATION_TOKEN)).not.toThrow();
  });

  it("does not rely on NODE_ENV alone", () => {
    // Even with NODE_ENV=production, execution still needs the token.
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(() => assertConfirmation("execute", undefined)).toThrow();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("isSecondPassClean", () => {
  it("reports clean when nothing was mutated", () => {
    const agg = { ...EMPTY_BACKFILL_AGGREGATE, alreadyCurrent: 10, scanned: 10 };
    expect(isSecondPassClean(agg)).toBe(true);
  });

  it("reports dirty when anything was mutated", () => {
    expect(isSecondPassClean({ ...EMPTY_BACKFILL_AGGREGATE, created: 1 })).toBe(false);
    expect(isSecondPassClean({ ...EMPTY_BACKFILL_AGGREGATE, incrementallyUpdated: 1 })).toBe(false);
    expect(isSecondPassClean({ ...EMPTY_BACKFILL_AGGREGATE, rebuilt: 1 })).toBe(false);
    expect(isSecondPassClean({ ...EMPTY_BACKFILL_AGGREGATE, configMismatchRebuilt: 1 })).toBe(
      false,
    );
  });
});

// Guard: the runner's mode union is exercised at runtime.
const _modeCheck: RunnerMode = "dry-run";
void _modeCheck;
