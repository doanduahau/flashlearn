# CapyStudy Task S3 — Preview page `/share/[token]` (public, read-only)

> Prompt giao việc cho agent. Đọc toàn bộ trước khi làm. KHÔNG push — gửi evidence report.

## 0. Baseline

- Commit hiện tại: **S2 đã push** (`1eabe22` → sau khi coordinator duyệt push, main đồng bộ origin/main).
- Migration đã apply production: `20260816082928_set_sharing.sql` (share_token + classroom + memberships + 6 RPC).
- Doc tham khảo bắt buộc: `AGENTS.md` (đặc biệt §8 route map, §9 data model, §15 Supabase/security, §16 lỗi & thông báo, §17 accessibility, §18 responsive).

## 1. Mục tiêu

Tạo trang **preview công khai** cho link chia sẻ: người nhận mở `/share/[token]` (KHÔNG cần đăng nhập) → xem thông tin bộ + toàn bộ thẻ (read-only, phân trang) + banner thông báo khi là link lớp học. Nút lưu/clone **KHÔNG thuộc task này** (Task S4 sẽ thêm) — trang này chỉ preview.

## 2. Migration nhỏ kèm theo (additive — KHÔNG sửa migration cũ)

`get_shared_set_by_token` hiện **không trả** `share_classroom_enabled` → preview không biết link có phải lớp học để hiện banner + S4 cũng cần cờ này khi clone.

- Tạo migration mới: `supabase/migrations/20260816120000_add_classroom_flag_to_shared_preview.sql`
- Nội dung: `alter function public.get_shared_set_by_token(text) ... ` — thêm cột `share_classroom_enabled boolean` vào `returns table(...)` và thêm `s.share_classroom_enabled` vào `select` (dòng `from public.flashcard_sets s` giữ nguyên, không đổi logic khác).
- KHÔNG đổi: signature (vẫn nhận `p_token text`), search_path, security definer, grant hiện có (authenticated + service_role).
- Cập nhật pgTAP: sửa `supabase/tests/029_set_share_tokens.sql` (file test — được phép sửa) thêm 1–2 assert: `share_classroom_enabled` trả về đúng giá trị (true khi bật, false khi tắt), giữ nguyên 75 assert hiện có (không xóa). Chạy lại `npx supabase db reset` trước `npm run db:test` (lưu ý: `supabase test db` KHÔNG tự reset — đã dính lỗi này ở S1).

## 3. Route (public, ngoài nhóm `(app)`)

- Tạo `src/app/share/[token]/page.tsx` — **server component**, đặt ở root level (`src/app/share/...`), KHÔNG nằm trong `(app)`/`(auth)`/`(marketing)` group → không bị auth guard (dự án không có middleware).
- KHÔNG tạo layout riêng — trang tự render đầy đủ (logo + heading + nội dung), mobile-first, theo design token (§11 AGENTS.md).

## 4. Logic page (server component)

1. `createAdminClient()` (`@/lib/supabase/admin` — server-only, service role) gọi `get_shared_set_by_token({ p_token })`.
   - RPC raise `22023` (token sai format) → bắt lỗi, render trạng thái "Link không hợp lệ" (hoặc `notFound()`).
   - Trả về rỗng (token hợp lệ nhưng không tồn tại / đã tắt share) → render trạng thái: **"Link không tồn tại hoặc đã bị tắt chia sẻ"** + nút về trang chủ.
2. Nếu có set → gọi `get_shared_set_cards({ p_token })` → toàn bộ thẻ (đã order theo position).
3. Render:
   - **Header**: logo CapyStudy + link về trang chủ.
   - **Thông tin bộ**: tên (to, bold), mô tả (nếu có), tên chủ sở hữu (`owner_display_name`), số thẻ (`card_count`).
   - **Banner lớp học** (chỉ khi `share_classroom_enabled = true`): hiển thị rõ, ví dụ: _"🔔 Đây là link lớp học. Khi lưu vào bộ của bạn, giáo viên sẽ xem được số câu đã làm, tỉ lệ chính xác và thứ hạng của bạn."_ — dùng màu `info`/`primary-soft`, không phải modal.
   - **Danh sách thẻ read-only**: mỗi thẻ hiện mặt trước + mặt sau (2 dòng trong 1 card), KHÔNG có nút sửa/xóa/thêm bộ đặc biệt.
   - **Phân trang client-side**: nếu > 50 thẻ → component con `"use client"` nhỏ phân trang (50/page), có nút trước/sau + số trang. Tải toàn bộ thẻ ở server, phân trang ở client (không fetch thêm).
   - **Empty state**: bộ hợp lệ nhưng 0 thẻ → thông báo "Bộ này chưa có thẻ" + mascot `thinking` size ≥ 64px (pattern MascotImage — KHÔNG dùng `level` mặc định 1, dùng `level={1}` vì trang public không có streak — đúng quy ước error pages).
4. KHÔNG render: nút lưu/clone, thông tin nhạy cảm (user_id, email, avatar của chủ sở hữu — RPC đã lo, đừng query thêm), nút sửa/xóa.

## 5. Phạm vi KHÔNG làm

- KHÔNG làm nút "Lưu vào bộ của tôi" / "Tham gia lớp học" / clone / đăng nhập (Task S4).
- KHÔNG đụng: `/sets/*`, `share-dialog.tsx`, sharing server actions (S2), migration `20260816082928_set_sharing.sql`, bộ đặc biệt, study/quiz/match/memory/runner, import flow.
- KHÔNG thêm dependency mới, KHÔNG đổi env, KHÔNG đổi design token.
- KHÔNG mở RLS public/anon hay grant anon trên RPC (giữ nguyên boundary hiện có).

## 6. Verification bắt buộc

1. `npx supabase db reset` (sạch từ DB trống — migration chain gồm cả migration mới) rồi `npm run db:test` — 31 files PASS, 029 có assert mới.
2. `npm run check` — lint 0 errors, typecheck, unit (1129+), build OK.
3. E2E: tạo spec mới `tests/e2e/shared-preview.spec.ts` — luồng: tạo bộ + share token (gọi RPC qua test setup hoặc UI) → mở `/share/[token]` anon → thấy tên bộ + thẻ + (khi classroom ON) banner lớp học; token lạ → "Link không tồn tại…". Chạy spec mới + 1–2 spec regression chạm `/sets` (share-dialog.spec.ts) — pass.
4. **Gemini review độc lập (bắt buộc — task chạm DB):** đọc migration mới + phần sửa pgTAP, xác nhận additive đúng, không đổi grant/boundary, ghi `APPROVE`/`REJECT` kèm findings trong evidence report.

## 7. Commit

- 1 commit duy nhất: `feat: add public share preview page with classroom banner`
- KHÔNG push — gửi evidence report gồm: files changed, trích code page + migration ngắn, kết quả db reset + db:test + check + E2E, Gemini verdict, safety checklist, ambiguities (nếu có).

## 8. Khi đối chiếu, coordinator sẽ kiểm

1. Route `/share/[token]` public, server component, dùng `createAdminClient` (không lộ service role).
2. Migration mới additive đúng (thêm cột trả về + select, không đổi grant/boundary/search_path); pgTAP 029 có assert mới + pass sau reset.
3. 3 trạng thái: token lỗi / không tồn tại (hoặc đã tắt) / hợp lệ; banner lớp học chỉ khi cờ true.
4. Thẻ read-only + phân trang client 50/page + empty state mascot 64px.
5. Không có nút lưu/clone (S4), không lộ thông tin nhạy cảm.
6. `npm run check` + `npm run db:test` pass (coordinator chạy lại), Gemini APPROVE trong report.
