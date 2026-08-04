export type AuthErrorCode =
  | "invalid_credentials"
  | "sign_up_failed"
  | "sign_in_failed"
  | "sign_out_failed"
  | "confirmation_failed"
  | "session_missing"
  | "unknown_error";

export function mapAuthError(code: AuthErrorCode): string {
  switch (code) {
    case "invalid_credentials":
      return "Email hoặc mật khẩu không đúng.";
    case "sign_up_failed":
      return "Đăng ký thất bại. Vui lòng thử lại.";
    case "sign_in_failed":
      return "Đăng nhập thất bại. Vui lòng thử lại.";
    case "sign_out_failed":
      return "Đăng xuất thất bại. Vui lòng thử lại.";
    case "confirmation_failed":
      return "Xác nhận email không thành công hoặc mã đã hết hạn.";
    case "session_missing":
      return "Phiên đăng nhập không tồn tại. Vui lòng đăng nhập lại.";
    case "unknown_error":
      return "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.";
  }
}
