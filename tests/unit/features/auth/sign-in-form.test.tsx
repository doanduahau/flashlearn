import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams({ error: "Email hoặc mật khẩu không đúng." }),
}));

import { SignInForm } from "@/features/auth/components/sign-in-form";

vi.mock("@/features/auth/server/actions", () => ({
  signIn: vi.fn(),
}));

describe("SignInForm", () => {
  it("renders email and password fields", () => {
    render(<SignInForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Mật khẩu$/i)).toBeInTheDocument();
  });

  it("renders a submit button", () => {
    render(<SignInForm />);

    expect(screen.getByRole("button", { name: /đăng nhập/i })).toBeInTheDocument();
  });

  it("renders a password visibility toggle", () => {
    render(<SignInForm />);

    expect(screen.getByRole("button", { name: /hiện mật khẩu/i })).toBeInTheDocument();
  });

  it("toggles password visibility when the toggle button is clicked", async () => {
    const user = userEvent.setup();
    render(<SignInForm />);

    const passwordInput = screen.getByLabelText(/^Mật khẩu$/i) as HTMLInputElement;
    const toggleButton = screen.getByRole("button", { name: /hiện mật khẩu/i });

    expect(passwordInput.type).toBe("password");

    await user.click(toggleButton);
    expect(passwordInput.type).toBe("text");

    await user.click(toggleButton);
    expect(passwordInput.type).toBe("password");
  });

  it("displays an error message when an error is present in search params", () => {
    render(<SignInForm />);

    expect(screen.getByRole("alert")).toHaveTextContent("Email hoặc mật khẩu không đúng.");
  });
});
