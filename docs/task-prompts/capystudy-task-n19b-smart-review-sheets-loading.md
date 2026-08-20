# Task N19b — Che 2 chỗ còn lộ chữ load (smart-review + Google Sheets)

## Loại task

**Giao diện / Nhỏ** — UI thuần, 2 file, cơ học. Không cần review riêng.

## Baseline

- Branch: `main`
- Baseline commit: `eca859a` ("feat: cover all loading moments with brand splash + inline dots" — N19, đã push).
- Chỉ làm đúng phạm vi task này.

## Bối cảnh

Task N19 che toàn bộ moment load bằng `BrandLoading`/`LoadingDots`, nhưng còn sót 2 chỗ hiển thị chữ (ngoài bảng §C của prompt N19). Người dùng yêu cầu **không còn chữ load lộ ra trên màn hình** → cần xử nốt.

## Phạm vi

### 1. `src/features/smart-review/components/start-smart-review-button.tsx` (~dòng 44)

- Hiện: `{pending ? "Đang mở…" : label}`.
- Sửa: `{pending ? <LoadingDots label="Đang mở" /> : label}`.
- Import `LoadingDots` từ `@/components/shared/loading-dots`.

### 2. `src/features/imports/components/google-sheets-import.tsx` (~dòng 613–625)

- Hiện: block `role="status"` gồm mascot thinking + `<p>` chữ `"Đang kết nối Google Drive..."` / `"Đang đọc bảng tính..."`.
- Sửa: giữ nguyên layout (mascot + `role="status"`), thay chữ trong `<p>` bằng `<LoadingDots label={mode === "picker_loading" ? "Đang kết nối Google Drive" : "Đang đọc bảng tính"} />` (không dấu "..." — label là sr-only).
- Import `LoadingDots`.

## Ngoài phạm vi

- Không đổi component `LoadingDots`/`BrandLoading`/`BrandSplash`, keyframes CSS.
- Không đổi file khác; không đổi màu/token; không cài dependency.

## Acceptance criteria

1. Grep không còn chữ load hiển thị: `"Đang mở…"` render trực tiếp (trừ prop `pendingLabel` sr-only) và không còn `"Đang kết nối Google Drive..."`/`"Đang đọc bảng tính..."` render ra chữ — chỉ còn ở dạng sr-only/aria-label.
2. `npm run check` xanh.

## Verification bắt buộc

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

E2E: chạy lại `typing-mode` + `share-dialog` nếu cần (đã biết fail pre-existing ở bước auth helper — ghi rõ nếu còn fail cùng lỗi `auth-helpers.ts:20`).

## Constraints

- Không dùng `any`/`@ts-ignore`/cast tùy tiện.
- Không dùng `--no-verify` khi commit.
- Không sửa ngoài phạm vi.

## Report cuối task

- Summary.
- Files changed.
- Verification từng lệnh.
- Remaining issues.
- Commit hash + message.
