import { describe, expect, it } from "vitest";

import { mapAuthError } from "@/features/auth/utils/auth-error";

describe("mapAuthError", () => {
  it("maps invalid_credentials to a user-friendly message", () => {
    const message = mapAuthError("invalid_credentials");
    expect(message).toBe("Email hoặc mật khẩu không đúng.");
  });

  it("maps sign_up_failed to a user-friendly message", () => {
    const message = mapAuthError("sign_up_failed");
    expect(message).toBe("Đăng ký thất bại. Vui lòng thử lại.");
  });

  it("maps sign_in_failed to a user-friendly message", () => {
    const message = mapAuthError("sign_in_failed");
    expect(message).toBe("Đăng nhập thất bại. Vui lòng thử lại.");
  });

  it("maps sign_out_failed to a user-friendly message", () => {
    const message = mapAuthError("sign_out_failed");
    expect(message).toBe("Đăng xuất thất bại. Vui lòng thử lại.");
  });

  it("maps confirmation_failed to a user-friendly message", () => {
    const message = mapAuthError("confirmation_failed");
    expect(message).toBe("Xác nhận email không thành công hoặc mã đã hết hạn.");
  });

  it("maps session_missing to a user-friendly message", () => {
    const message = mapAuthError("session_missing");
    expect(message).toBe("Phiên đăng nhập không tồn tại. Vui lòng đăng nhập lại.");
  });

  it("maps unknown_error to a user-friendly message", () => {
    const message = mapAuthError("unknown_error");
    expect(message).toBe("Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.");
  });
});
