import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/server/actions", () => ({
  signUp: vi.fn(),
}));

import SignUpPage from "@/app/(auth)/sign-up/page";

describe("SignUpPage", () => {
  it("renders all form fields", () => {
    render(<SignUpPage />);

    expect(screen.getByLabelText(/tên hiển thị/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Mật khẩu$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/xác nhận mật khẩu/i)).toBeInTheDocument();
  });

  it("renders a submit button", () => {
    render(<SignUpPage />);

    expect(screen.getByRole("button", { name: /đăng ký/i })).toBeInTheDocument();
  });

  it("has a link to the sign-in page", () => {
    render(<SignUpPage />);

    expect(screen.getByRole("link", { name: /đăng nhập/i })).toBeInTheDocument();
  });

  it("has accessible labels for all form fields", () => {
    render(<SignUpPage />);

    expect(screen.getByLabelText(/tên hiển thị/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Mật khẩu$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/xác nhận mật khẩu/i)).toBeInTheDocument();
  });
});
