import { describe, expect, it } from "vitest";

import {
  BOOTSTRAP_OWNER_CONFIRMATION,
  parseBootstrapOwnerOptions,
} from "../../../scripts/lib/bootstrap-owner-options";

describe("parseBootstrapOwnerOptions", () => {
  it("parses the full option set", () => {
    expect(
      parseBootstrapOwnerOptions([
        "--email",
        "owner@example.test",
        "--reason",
        "first owner bootstrap",
        "--correlation-id",
        "00000000-0000-4000-8000-000000000099",
        "--operator-user-id",
        "dddddddd-0000-4000-8000-000000000004",
      ]),
    ).toEqual({
      email: "owner@example.test",
      reason: "first owner bootstrap",
      correlationId: "00000000-0000-4000-8000-000000000099",
      operatorUserId: "dddddddd-0000-4000-8000-000000000004",
      execute: false,
    });
  });

  it("defaults to dry-run", () => {
    expect(parseBootstrapOwnerOptions(["--email", "a@b.test", "--reason", "r"])).toEqual({
      email: "a@b.test",
      reason: "r",
      execute: false,
    });
  });

  it("requires a confirmation phrase for --execute", () => {
    expect(() =>
      parseBootstrapOwnerOptions(["--email", "a@b.test", "--reason", "r", "--execute"]),
    ).toThrow("--execute requires --confirm");
  });

  it("accepts --execute with the confirmation phrase", () => {
    expect(
      parseBootstrapOwnerOptions([
        "--email",
        "a@b.test",
        "--reason",
        "r",
        "--execute",
        "--confirm",
        BOOTSTRAP_OWNER_CONFIRMATION,
      ]).execute,
    ).toBe(true);
  });

  it("rejects a missing email", () => {
    expect(() => parseBootstrapOwnerOptions(["--reason", "r"])).toThrow("--email is required");
  });

  it("rejects a missing reason", () => {
    expect(() => parseBootstrapOwnerOptions(["--email", "a@b.test"])).toThrow(
      "--reason is required",
    );
  });

  it("rejects a reason longer than 500 characters", () => {
    expect(() =>
      parseBootstrapOwnerOptions(["--email", "a@b.test", "--reason", "x".repeat(501)]),
    ).toThrow("500 characters or fewer");
  });

  it("rejects unknown flags", () => {
    expect(() =>
      parseBootstrapOwnerOptions(["--email", "a@b.test", "--reason", "r", "--nope"]),
    ).toThrow("Unknown argument");
  });
});
