# CapyStudy — Task S2: Share UI (chủ sở hữu) — nút + dialog Share + toggle "Chế độ lớp học"

> **Loại:** UI + server actions (không migration — DB foundation đã có ở S1).
> **Tier:** DeepSeek Flash + Gemini (Codex hết token) — KHÔNG bắt buộc review riêng (không chạm DB), nhưng nếu Gemini rảnh thì review thêm cho chắc.
> **Baseline:** commit S1 đã push (`feat: add set share tokens and classroom membership foundation` — main đồng bộ origin/main, migration đã apply production).
> **Quy tắc:** KHÔNG đụng file ngoài danh sách. 1 commit. KHÔNG push — gửi evidence report.

---

## 0. Bối cảnh (đã chốt với user)

S1 đã tạo DB foundation: `share_token` (32 hex) + `share_classroom_enabled` + bảng `shared_set_memberships` + 6 RPC (create/revoke token, get set/cards, set classroom, register membership — đều SECURITY DEFINER, service_role cho mutation, authenticated + service_role cho read). Task này làm **giao diện cho chủ sở hữu** ở trang chi tiết bộ `/sets/[setId]`.

**Luồng đã chốt:**

- Giáo viên mở bộ → nút **"Chia sẻ"** → dialog: tạo link / copy link / tắt chia sẻ + **toggle "Chế độ lớp học"** (chỉ hiện khi share đang bật).
- Khi bật toggle → dialog hiện **giải thích ngắn**: học sinh mở link sẽ thấy thông báo và khi lưu vào bộ của họ, giáo viên xem được tiến độ + xếp hạng.
- Nút "Thống kê" (xếp hạng) là **S7 — KHÔNG làm ở task này**.

## 1. Files

**Mới:**

- `src/features/sharing/components/share-dialog.tsx` — dialog client ("use client", nhỏ).
- `src/features/sharing/server/actions.ts` — 3 server actions.
- `src/features/sharing/schemas/share-schema.ts` — Zod schema cho input.

**Sửa:**

- `src/app/(app)/sets/[setId]/page.tsx` — load thêm 2 cột + render nút Chia sẻ.

## 2. Server page — /sets/[setId]/page.tsx

- Select đổi từ `"id, name"` thành `"id, name, share_token, share_classroom_enabled"`.
- Header (khu vực cạnh RenameSetForm/DeleteSetButton) thêm:
  ```tsx
  <ShareDialog
    setId={set.id}
    hasToken={Boolean(set.share_token)}
    token={set.share_token ?? null}
    classroomEnabled={Boolean(set.share_classroom_enabled)}
  />
  ```
- Không đổi gì khác trong page.

## 3. Server actions — src/features/sharing/server/actions.ts

Pattern: auth server-side (`authenticatedUserId`/`createClient` như các actions khác), Zod validate input, gọi RPC qua `createAdminClient()` (service role — S1 đã grant), `revalidatePath("/sets/[setId]")` sau mutation.

3 actions (đều `"use server"`, trả `{ ok: true } | { ok: false; error: string }`):

1. **`createShareLink(setId: string)`** → `admin.rpc("create_set_share_token", { p_user_id: userId, p_set_id: setId })` — lỗi → generic message "Không thể tạo link chia sẻ lúc này."
2. **`revokeShareLink(setId: string)`** → `admin.rpc("revoke_set_share_token", { p_user_id: userId, p_set_id: setId })` — lỗi → "Không thể tắt chia sẻ lúc này."
3. **`setClassroomEnabled(setId: string, enabled: boolean)`** → `admin.rpc("set_set_classroom_enabled", { p_user_id: userId, p_set_id: setId, p_enabled: enabled })` — lỗi → "Không thể đổi chế độ lớp học lúc này."

- Zod schema `shareActionSchema`: `{ setId: z.string().uuid(), enabled: z.boolean().optional() }` — parse ở mỗi action.
- Lấy `userId` bằng pattern hiện có (`authenticatedUserId(supabase)` — xem `src/features/quiz/server/actions.ts` làm mẫu). Không tin input client.
- Sau mỗi action thành công: `revalidatePath(\`/sets/\${setId}\`)`.

## 4. Component — share-dialog.tsx

- Props: `{ setId, hasToken, token, classroomEnabled }` (server truyền state hiện tại).
- "use client" — nhỏ, chỉ chứa tương tác dialog.
- UI (mobile-first, đúng design system — dialog 24px bo góc, màu brand, MascotImage KHÔNG cần ở đây):

**Trạng thái 1 — chưa có token:** nút chính "Tạo link chia sẻ" → gọi `createShareLink` (pending state, lỗi inline nếu fail) → thành công thì hiện trạng thái 2.

**Trạng thái 2 — đã có token:**

- Ô hiển thị link: `{NEXT_PUBLIC_APP_URL}/share/{token}` (dùng `process.env.NEXT_PUBLIC_APP_URL` — nếu thiếu thì bỏ prefix, chỉ `/share/{token}`; ghi rõ cách xử lý). Link đọc-only (input readonly hoặc text mono, wrap).
- Nút **"Sao chép link"** → `navigator.clipboard.writeText` + feedback "Đã sao chép!" (fallback: `document.execCommand("copy")` nếu clipboard API lỗi — mobile cũ).
- Nút **"Tắt chia sẻ"** (danger/outline) → `revokeShareLink` → về trạng thái 1. Có confirm nhỏ trong dialog (Hủy / Tắt) — dùng pattern `ExitConfirmDialog` (xem `src/features/learning-modes/components/exit-confirm-dialog.tsx`) hoặc confirm đơn giản, KHÔNG dùng `window.confirm`.
- **Toggle "Chế độ lớp học"** (chỉ render khi có token): switch/checkbox → `setClassroomEnabled`. Khi bật → hiện text giải thích (đã chốt): _"Học sinh mở link sẽ thấy thông báo đây là link lớp học. Khi họ lưu vào bộ của mình, bạn xem được tiến độ học và xếp hạng của họ."_
- Nút đóng dialog (X) + `role="dialog"` + `aria-modal` + focus trap (pattern dialog hiện có của dự án — xem các dialog khác).

## 5. KHÔNG làm (phạm vi loại trừ)

- KHÔNG route `/share/[token]` (S3), KHÔNG clone (S4), KHÔNG Match persistence (S5), KHÔNG stats RPC (S6), KHÔNG nút "Thống kê" (S7).
- KHÔNG sửa migration/RPC/RLS — S1 đã xong và applied.
- KHÔNG đụng các trang/feature khác (study/quiz/match/memory/runner/import...).

## 6. Verification

```bash
npm run check
npm run test:e2e -- sets-library flashcard-set-ordering primary-navigation   # chắc chắn không regression /sets
```

- Unit test nếu khả thi: `share-dialog` component test (mock server actions) — render 2 trạng thái, toggle, copy. Nếu quá khó (navigator.clipboard) thì chứng minh bằng lý luận + E2E.
- E2E: spec mới `tests/e2e/share-dialog.spec.ts` — đăng nhập → mở bộ → mở dialog → tạo link (assert URL /share/<32 hex> xuất hiện) → copy (assert clipboard hoặc feedback) → bật toggle (assert text giải thích hiện) → tắt share (assert về trạng thái tạo link).

## 7. Commit

```bash
git add <các file task>
git commit -m "feat: add share dialog with classroom mode toggle to set detail"
```

## 8. Evidence report

- Repository: start/final commit, push status.
- Trích code: page select, 3 server actions (pattern auth + RPC + revalidate), dialog 2 trạng thái + toggle + copy.
- Tests: unit (nếu có) + E2E kết quả.
- Safety: migrations NO, deps NO, env NO, AI NO, production NO.
- Ambiguities (vd: NEXT_PUBLIC_APP_URL thiếu, clipboard fallback, vị trí nút).
- Verdict: `EVIDENCE READY FOR REVIEW` / `INCOMPLETE — BLOCKER REQUIRES USER DECISION`.
