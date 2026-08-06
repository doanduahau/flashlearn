import { describe, expect, it } from "vitest";

import { mapMutationError } from "@/lib/mutation-error";

describe("mapMutationError", () => {
  it("returns a safe fallback for null or unknown errors", () => {
    expect(mapMutationError(null)).toBe("Không thể hoàn tất thao tác. Hãy thử lại.");
    expect(mapMutationError(undefined)).toBe("Không thể hoàn tất thao tác. Hãy thử lại.");
    expect(mapMutationError({ message: "random failure" })).toBe(
      "Không thể hoàn tất thao tác. Hãy thử lại.",
    );
  });

  it("never leaks raw database messages", () => {
    const leaked = "relation public.flashcard_sets does not exist at character 123";
    const mapped = mapMutationError({ message: leaked, code: "42P01" });
    expect(mapped).not.toContain("flashcard_sets");
    expect(mapped).not.toContain("42P01");
  });

  it("maps known error codes to safe messages", () => {
    expect(
      mapMutationError({ code: "42501", message: "new row violates row-level security policy" }),
    ).toBe("Bạn không có quyền thực hiện thao tác này.");
    expect(mapMutationError({ code: "23503", message: "foreign key violation" })).toBe(
      "Bản ghi liên quan không còn tồn tại.",
    );
    expect(mapMutationError({ code: "23505", message: "duplicate key value" })).toBe(
      "Tên đã tồn tại.",
    );
    expect(mapMutationError({ code: "22023", message: "invalid set id" })).toBe(
      "Dữ liệu gửi lên không hợp lệ.",
    );
  });
});
