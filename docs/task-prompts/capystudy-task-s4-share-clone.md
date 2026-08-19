# CapyStudy Task S4 — Clone bộ chia sẻ (nút lưu + đăng nhập + giới hạn + membership)

> Prompt giao việc cho agent. Đọc toàn bộ trước khi làm. KHÔNG push — gửi evidence report.

## 0. Baseline

- Commit hiện tại: **S3 đã push** (`833f216`, main đồng bộ origin/main, migration `20260816120000` đã apply production).
- Doc tham khảo bắt buộc: `AGENTS.md` (§15 Supabase/security, §16 lỗi & thông báo, §17 accessibility, §18 responsive), `docs/task-prompts/capystudy-task-s1-share-db-foundation.md` (thiết kế RPC + quyết định classroom đã chốt).

## 1. Mục tiêu

Người nhận link `/share/[token]` có thể **lưu bộ chia sẻ vào tài khoản của mình** (clone độc lập — snapshot, không sync bộ gốc). Khi link là **link lớp học** (classroom ON), clone phải **tự động ghi membership** để giáo viên thấy học sinh trong bảng thống kê (S6/S7). Giới hạn clone: **2000 thẻ** (dùng chung `IMPORT_MAX_ROWS`).

## 2. Migration mới (additive — KHÔNG sửa migration cũ)

Tạo `supabase/migrations/20260816130000_clone_shared_set.sql` — RPC duy nhất:

`public.clone_shared_set(p_token text, p_user_id uuid)` returns `table (new_set_id uuid)`

- `security definer`, `set search_path = ''`, đúng pattern các RPC S1.
- Validate: `p_token` null/sai format `^[0-9a-f]{32}$` → raise `22023`; `p_user_id` null → raise `42501`.
- Tìm set gốc theo `share_token = p_token`; không tồn tại → raise `42501` (không tiết lộ token hợp lệ hay không).
- Lấy toàn bộ thẻ gốc (`front, back, position` theo position asc). Nếu `count > 2000` → raise `22023` (thông báo rõ "Bộ này vượt quá giới hạn 2000 thẻ" — về mặt lý thuyết hiếm vì import đã giới hạn, nhưng thẻ thêm thủ công có thể đẩy vượt).
- Insert set mới: `user_id = p_user_id`, **giữ nguyên tên gốc** (user đổi tên sau được), `description` giữ nguyên.
- Insert thẻ copy (chỉ `front, back, position`) — **KHÔNG** copy mastery/stats/special collections/learning history.
- Nếu `share_classroom_enabled = true` → ghi membership. **Tái sử dụng RPC `register_set_membership(p_token, p_clone_set_id, p_member_user_id)` đã có** (validate classroom ON + clone thuộc member + upsert unique(set_id, member_user_id)) — gọi trong cùng transaction; nếu nó raise thì toàn bộ rollback. (Nếu agent thấy gọi RPC trong RPC bất tiện, có thể inline cùng logic — nhưng PHẢI giữ đúng hành vi: classroom OFF → không ghi; classroom ON → upsert.)
- Trả `new_set_id`.
- Grant: `revoke all from public, anon; grant execute ... to service_role` (KHÔNG authenticated — server action gọi qua admin client, đúng pattern `create_set_share_token`). Không mở RLS.

## 3. Server action `cloneSharedSet` — `src/features/sharing/server/actions.ts`

Thêm action mới (giữ nguyên 3 action S2):

```ts
export async function cloneSharedSet(token: string): Promise<{ setId: string } | { error: string }>;
```

- Schema zod: `token: z.string().regex(/^[0-9a-f]{32}$/)` — pattern `shareActionSchema` (tạo schema riêng hoặc mở rộng — chọn 1, không tạo trùng).
- Auth: `authenticatedUserId` (pattern có sẵn trong file — lấy `getClaims().claims.sub`). Chưa đăng nhập → `{ error: "Bạn cần đăng nhập để lưu bộ flashcard này." }` (UI đã chặn anon từ trước, action chỉ phòng thủ).
- Gọi `createAdminClient().rpc("clone_shared_set", { p_token: token, p_user_id: userId })`.
- Thành công → `revalidatePath("/sets")` + `revalidatePath("/sets/library")` + trả `{ setId }`.
- Lỗi → thông báo generic tiếng Việt (không lộ lỗi DB).

## 4. UI — nút lưu trên `/share/[token]`

Trang preview (S3) hiện chưa có nút. Thêm:

1. **Server page** (`src/app/share/[token]/page.tsx`): check đăng nhập bằng `createClient()` server-side (đọc cookie session — trang public vẫn đọc được nếu có). Truyền `isAuthenticated: boolean` + `token` xuống component nút. KHÔNG redirect anon (preview vẫn xem được).
2. **Component mới** `src/features/sharing/components/clone-set-button.tsx` — `"use client"` nhỏ, nhận `{ token, isAuthenticated, isClassroom }`:
   - **Anon**: `<Button asChild><Link href={`/sign-in?next=/share/${token}`}>` nhãn **"Đăng nhập để lưu"** — sign-in đã hỗ trợ `?next` qua `sanitizeRedirect` (không cần sửa auth); sau đăng nhập quay về preview.
   - **Đã đăng nhập**: Button gọi `cloneSharedSet(token)` trong `useTransition` (pattern ShareDialog): pending → "Đang lưu…"; thành công → `router.push(`/sets/${setId}`)` (pattern importFlashcards); lỗi → hiển thị inline `role="alert"` (không toast).
   - Nhãn khi authed: classroom → **"Tham gia lớp học"**, ngược lại → **"Lưu vào bộ của tôi"** (đúng banner S3).
   - Chống double-click: `disabled={isPending}`.
3. Đặt nút trên page: ngay dưới banner (nếu có) / dưới thông tin bộ, trước danh sách thẻ. `mt-6`.

## 5. Phạm vi KHÔNG làm

- KHÔNG sửa auth (sign-in/sign-up/actions) — `?next` đã hoạt động.
- KHÔNG đụng: `/sets/*`, share-dialog (S2), migration S1/S3, bộ đặc biệt, study/quiz/match/memory/runner, import flow.
- KHÔNG copy mastery/stats/history khi clone (chỉ front/back/position).
- KHÔNG thêm dependency, KHÔNG đổi env, KHÔNG mở RLS/anon.

## 6. Verification bắt buộc

1. `npx supabase db reset` (sạch từ DB trống) rồi `npm run db:test` — 31 files PASS, thêm file pgTAP mới `030_shared_set_clone.sql`: cover validate token, set không tồn tại, >2000 thẻ raise, clone tạo set + đúng số thẻ + position giữ nguyên, clone không copy stats, classroom OFF → không membership, classroom ON → membership + upsert khi clone lại lần 2, isolation (A clone của B không ảnh hưởng B), grant (service_role execute, anon/authenticated không execute).
2. `npm run check` — lint 0 errors, typecheck, unit (1132+), build OK. Unit: test `cloneSharedSet` (schema, chưa đăng nhập, thành công, RPC lỗi) + test `clone-set-button` (anon link, authed pending/success/error, nhãn classroom).
3. E2E `tests/e2e/shared-preview.spec.ts` (mở rộng hoặc spec mới `shared-clone.spec.ts`): chủ sở hữu tạo bộ → share + classroom ON → user khác đăng nhập → mở link → bấm "Tham gia lớp học" → về `/sets/[newId]` → verify thẻ copy đủ + membership tồn tại; classroom OFF → clone không tạo membership. Chạy cả regression share-dialog.spec.ts.
4. **Gemini review độc lập (bắt buộc — chạm DB):** đọc migration mới + pgTAP, xác nhận: atomic (membership + clone cùng transaction, lỗi → rollback), không lộ thẻ/ownership, grant đúng (service_role only), tái sử dụng register_set_membership đúng hành vi, ghi `APPROVE`/`REJECT` kèm findings trong evidence report.

## 7. Commit

- 1 commit duy nhất: `feat: allow cloning shared sets with classroom membership`
- KHÔNG push — gửi evidence report gồm: files changed, trích code RPC + action + button ngắn gọn, kết quả db reset + db:test + check + E2E, Gemini verdict, safety checklist, ambiguities.

## 8. Khi đối chiếu, coordinator sẽ kiểm

1. RPC clone đúng: validate token/user, atomic, giữ tên gốc, chỉ copy front/back/position, giới hạn 2000, membership qua register_set_membership (hoặc inline đúng hành vi), service_role only.
2. Action: zod + auth + admin RPC + revalidate + trả setId; lỗi generic tiếng Việt.
3. Button: anon → `/sign-in?next=...`; authed → pending/chống double-click/error inline; nhãn classroom đúng.
4. pgTAP 030 + db reset sạch + db:test 32 files PASS.
5. `npm run check` pass (coordinator chạy lại), Gemini APPROVE trong report.
6. Không đụng file ngoài phạm vi; 1 commit đúng message.
