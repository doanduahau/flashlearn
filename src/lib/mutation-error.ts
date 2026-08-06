export type MutationResult = { ok: true } | { ok: false; error: string };

interface MutationError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

const FALLBACK_MESSAGE = "Không thể hoàn tất thao tác. Hãy thử lại.";

export function mapMutationError(error: MutationError | null | undefined): string {
  if (!error) return FALLBACK_MESSAGE;
  switch (error.code) {
    case "42501":
      return "Bạn không có quyền thực hiện thao tác này.";
    case "23503":
      return "Bản ghi liên quan không còn tồn tại.";
    case "23505":
      return "Tên đã tồn tại.";
    case "22023":
      return "Dữ liệu gửi lên không hợp lệ.";
    default:
      return FALLBACK_MESSAGE;
  }
}
