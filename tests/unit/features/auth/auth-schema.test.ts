import { describe, expect, it } from "vitest";

import { signUpSchema, signInSchema } from "@/features/auth/schemas/auth-schema";

describe("signUpSchema", () => {
  it("validates a complete sign-up payload", () => {
    const result = signUpSchema.safeParse({
      displayName: "Nguyen Van A",
      email: "test@example.com",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayName).toBe("Nguyen Van A");
      expect(result.data.email).toBe("test@example.com");
    }
  });

  it("accepts an empty display name", () => {
    const result = signUpSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a whitespace-only display name", () => {
    const result = signUpSchema.safeParse({
      displayName: "   ",
      email: "test@example.com",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a display name longer than 100 characters", () => {
    const longName = "a".repeat(101);
    const result = signUpSchema.safeParse({
      displayName: longName,
      email: "test@example.com",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = signUpSchema.safeParse({
      email: "not-an-email",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = signUpSchema.safeParse({
      email: "test@example.com",
      password: "short",
      confirmPassword: "short",
    });

    expect(result.success).toBe(false);
  });

  it("rejects when passwords do not match", () => {
    const result = signUpSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      confirmPassword: "different123",
    });

    expect(result.success).toBe(false);
  });

  it("rejects when required fields are missing", () => {
    const result = signUpSchema.safeParse({
      email: "test@example.com",
    });

    expect(result.success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("validates a complete sign-in payload", () => {
    const result = signInSchema.safeParse({
      email: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = signInSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing password", () => {
    const result = signInSchema.safeParse({
      email: "test@example.com",
    });

    expect(result.success).toBe(false);
  });
});
