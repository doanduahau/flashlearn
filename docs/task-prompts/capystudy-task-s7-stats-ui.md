# CapyStudy Task S7 — Stats UI (bảng xếp hạng giáo viên trong Chế độ lớp học)

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `2069f4a` (đã push, main đồng bộ origin/main, migration S1–S6 đã apply production)
- `Agent tier`: **DeepSeek Flash + Gemini** (UI — không review riêng; coordinator verify)
- `Commit message` (1 commit duy nhất): `feat: add classroom stats leaderboard to set detail`
- `Push`: KHÔNG push — gửi evidence report; chỉ push sau khi coordinator verify + user duyệt

## 1. Bối cảnh

Phase Sharing (S1–S7). Đã xong: S1 (share + classroom + memberships + RPC), S2 (Share UI), S3 (preview), S4 (clone), S5 (match_attempts), S6 (**RPC `get_set_members_with_stats`** đã sẵn sàng trên production). Task này (S7) là **task cuối**: UI bảng xếp hạng cho giáo viên ở trang chi tiết bộ.

**RPC có sẵn (S6):** `get_set_members_with_stats(p_user_id uuid, p_set_id uuid)` — owner-only, trả về `(rank, member_user_id, display_name, avatar_url, joined_at, total_questions, correct_questions, accuracy, last_activity_at)`. Grant authenticated + service_role (KHÔNG anon). accuracy là **phần trăm 0–100 làm tròn 1 số thập phân** (72.2 = 72.2%), null khi chưa làm bài. Người chưa làm bài xếp cuối.

**Trang hiện tại:** `src/app/(app)/sets/[setId]/page.tsx` đã có `ShareDialog` (S2) với prop `classroomEnabled`. Chỉ owner thấy được trang này (RLS `flashcard_sets` theo `user_id` → không phải owner thì query trả empty → `notFound()`). Vì vậy: **nếu trang render được thì user đang xem chính là owner** — điều kiện duy nhất để hiện nút "Thống kê" là `share_classroom_enabled = true`.

## 2. Phạm vi task (chỉ làm đúng những mục này)

1. **Server page `/sets/[setId]`:** khi `share_classroom_enabled = true` → gọi RPC `get_set_members_with_stats` (qua `createClient()` authenticated — teacher đã đăng nhập) với `p_user_id` từ session + `p_set_id` → truyền `members` xuống component client
2. **Component mới `StatsDialog`** (client): nút "Thống kê" (chỉ render khi classroom ON) cạnh ShareDialog + dialog hiển thị bảng xếp hạng teacher-only + empty state + nút "Làm mới" (router.refresh)
3. **Không làm:** không đụng DB/RPC/migration (S6 đã xong), không sửa ShareDialog, không đụng quiz/match/memory/runner/study/import

## 3. Thiết kế chi tiết

### 3.1. Server page (`src/app/(app)/sets/[setId]/page.tsx`)

- Select đã có `share_token, share_classroom_enabled` — giữ nguyên
- Sau khi có `set` + `userId` (từ `supabase.auth.getUser()` — dùng user hiện tại, KHÔNG nhận từ client), **chỉ khi `set.share_classroom_enabled`** gọi:

```ts
const { data: members } = set.share_classroom_enabled
  ? await supabase.rpc("get_set_members_with_stats", {
      p_user_id: userId,
      p_set_id: setId,
    })
  : { data: [] };
```

- Lỗi RPC → `members = []` (không crash trang; dialog hiển thị empty state)
- Render `<StatsDialog members={members ?? []} />` cạnh `<ShareDialog>` trong hàng nút — chỉ render khi `set.share_classroom_enabled`

### 3.2. Component mới `src/features/sharing/components/stats-dialog.tsx` ("use client")

Pattern theo `share-dialog.tsx` (S2) — đọc file này trước:

- **Nút trigger:** `<Button variant="outline">Thống kê</Button>` (kèm icon nhỏ nếu có sẵn — không bắt buộc), aria-label="Thống kê học sinh"
- **Dialog** (dùng Dialog primitive của shadcn — xem cách ShareDialog dùng):
  - Tiêu đề: "Thống kê lớp học" + phụ đề ngắn: "Chỉ bạn xem được bảng này" (teacher-only)
  - **Bảng xếp hạng** — mobile-first (KHÔNG dùng `<table>` — dùng rows/cards stack, desktop có thể grid rộng hơn):
    - Mỗi hàng = 1 thành viên, hiển thị đủ: **Xếp hạng** (badge số 1..N), **Tên** (`display_name`, fallback "Học sinh"), **Tổng câu đã làm** (`total_questions`), **Số câu đúng** (`correct_questions`), **Tỉ lệ chính xác** (`accuracy` → hiển thị "72.2%" hoặc "—" khi null), **Ngày tham gia** (`joined_at` → ngày địa phương gọn), **Hoạt động gần nhất** (`last_activity_at` → ngày giờ gọn, "—" khi null)
    - `avatar_url` nếu có → hiển thị avatar nhỏ (size ~8, rounded-full, object-cover); không có → initials của display_name trong vòng tròn (tone surface-subtle)
    - Hàng xếp hạng 1 có thể highlight nhẹ (vd border-primary-soft) — không bắt buộc, giữ đúng design token
    - Mobile: mỗi member 1 card xếp dọc (rank + tên trên, các chỉ số dưới dạng grid 2–3 cột nhỏ); desktop: 1 hàng ngang đủ cột
  - **Empty state:** chưa có thành viên → `MascotImage level={mascotLevel} state="thinking" size={64} className="mx-auto mb-2 size-16 object-contain"` (pattern empty state page [setId] hiện có) + "Chưa có học sinh nào tham gia lớp học." + giải thích ngắn "Chia sẻ link lớp học để học sinh tham gia." — **cần prop `mascotLevel`** (server page truyền xuống, đã có `mascotLevel` từ `loadMascotLevel`)
  - **Nút "Làm mới"** ở cuối dialog → `router.refresh()` (server-first — data mới từ server)
- Props: `{ members: MemberStats[]; mascotLevel: MascotLevel }` với `MemberStats` = kiểu trả về RPC (tạo type trong file component hoặc feature types — chọn 1, KHÔNG import DB types trực tiếp vào UI nếu domain model khác)

### 3.3. Không cần regen types.ts

RPC gọi qua `supabase.rpc` — nếu TypeScript thiếu kiểu trả về, dùng cast kiểu rõ ràng tại chỗ (vd `as MemberStats[]`) — KHÔNG bắt buộc regen `src/lib/supabase/types.ts` (nếu regen cũng chấp nhận được nhưng không bắt buộc).

## 4. Verification gates (bắt buộc)

1. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
2. Unit test component mới: render rows đủ cột (rank/tên/tổng/đúng/tỉ lệ/ngày tham gia/hoạt động), accuracy null → "—", empty state mascot + text, avatar fallback initials, "Làm mới" gọi router.refresh
3. E2E: bật classroom ở bộ có share → nút "Thống kê" hiện → mở dialog → thấy bảng (hoặc empty state); bộ không classroom → không có nút (regression share-dialog + sets page pass)
4. `git diff --check` sạch

## 5. Files dự kiến thay đổi

- `src/features/sharing/components/stats-dialog.tsx` (mới)
- `src/app/(app)/sets/[setId]/page.tsx` (sửa — gọi RPC + render StatsDialog khi classroom ON)
- `tests/unit/features/sharing/stats-dialog.test.tsx` (mới — nếu pattern component test có sẵn, theo nó)
- `tests/e2e/classroom-stats.spec.ts` (mới) hoặc mở rộng spec share-dialog hiện có — chọn theo cấu trúc E2E hiện tại
- `src/lib/supabase/types.ts` (chỉ khi regen — không bắt buộc)

**KHÔNG đụng:** migration/RPC/DB, ShareDialog, quiz/match/memory/runner/study/import, docs.

## 6. Evidence report template (gửi về coordinator)

```text
Repository: start <baseline> → final <hash> (1 commit, N files, +X/−Y), push status: NOT pushed
Trích code: server page RPC call + StatsDialog render (ngắn)
Verification:
- npm run check: lint X errors / Y warnings, typecheck, unit N passed, build
- npx vitest run tests/unit/features/sharing: N passed
- E2E <specs>: N/N PASS
- git diff --check: PASS
Safety: migrations/DB NO · deps/env/AI/production NO
Ambiguities: <nếu có>
```

## 7. Lưu ý cho implementer

- Đọc kỹ `share-dialog.tsx` (pattern dialog + nút) và `src/app/(app)/sets/[setId]/page.tsx` hiện tại trước khi sửa
- Chỉ hiện nút "Thống kê" khi `share_classroom_enabled = true`; khi classroom tắt → nút biến mất (server page không render)
- Không gọi RPC khi classroom OFF (tránh query thừa); lỗi RPC → members = [] (không crash)
- Giữ đúng design token (apricot #FDC07F primary, border-soft, surface, rounded-2xl card, mascot ≥ 64px, mobile-first)
- Số liệu hiển thị nguyên trạng từ RPC — KHÔNG tự tính lại accuracy/total ở client
