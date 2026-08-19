# CapyStudy Task S8 — Chống clone trùng (đã tham gia lớp học / đã lưu bộ) + lưu nguồn clone (`source_share_token`)

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `bc6e71c` (đã push, main đồng bộ origin/main, migration S1–S6 đã apply production)
- `Agent tier`: **DeepSeek Flash (implementer) + Gemini (independent review — bắt buộc, task chạm DB)**
- `Commit message` (1 commit duy nhất): `feat: prevent duplicate shared set clones with source tracking`
- `Push`: KHÔNG push — gửi evidence report; chỉ push sau khi coordinator verify + user duyệt

## 1. Bối cảnh + quyết định đã chốt (2026-08-16)

Hiện trạng: `clone_shared_set` (S4) khi bộ là lớp học gọi `register_set_membership` (S1) — RPC này **upsert** trên `(set_id, member_user_id)`, nên bấm "Tham gia lớp học" lần 2 **âm thầm tạo bản clone mới + trỏ membership sang bản mới** → thư viện học sinh có 2 bản sao cùng 1 bộ (bản cũ bỏ rơi). Bản clone cũng **không lưu nguồn** (không biết clone từ link nào).

User đã chốt 3 quyết định:

1. **Đã tham gia lớp học** (membership tồn tại) → bấm "Tham gia lớp học" lần nữa → **KHÔNG tạo clone mới**, **tự điều hướng thẳng** tới bộ đã lưu (không hiện thông báo dừng).
2. **Bộ thường clone trước → chủ bật lớp học sau** → **KHÔNG backfill membership**; học sinh muốn tham gia phải bấm "Tham gia lớp học" (tạo clone mới + membership; bản cũ để lại tự xóa). → Đường classroom **CHỈ kiểm tra membership**, KHÔNG kiểm tra `source_share_token` (để luồng tham gia lại này không bị chặn).
3. **Bộ thường lưu 2 lần** → **CHẶN** + thông báo "Bạn đã lưu bộ này" + link "Mở bộ flashcard của bạn" → `/sets/[bản đã lưu]` (không tự điều hướng).

## 2. Phạm vi task (chỉ làm đúng những mục này)

1. **Migration mới `20260816165000_clone_dedupe_and_source.sql`**: thêm cột `source_share_token` + index + **drop + recreate `clone_shared_set`** (đổi return type — thêm cột `already_exists boolean`; pattern drop+create của S3 `20260816120000_add_classroom_flag_to_shared_preview.sql`)
2. **Server action** `cloneSharedSet` → trả `{ setId, alreadyExists }`
3. **UI** `CloneSetButton`: nhánh `alreadyExists` (classroom → `router.push`; regular → thông báo + link)
4. **Cập nhật pgTAP `030_shared_set_clone.sql`** (hành vi re-clone THAY ĐỔI — bắt buộc) + regen `types.ts`
5. **KHÔNG làm:** đổi `register_set_membership` / `set_set_classroom_enabled` / `share-schema.ts`, backfill membership, ShareDialog/StatsDialog, layout preview page, migration cũ

## 3. Thiết kế chi tiết

### 3.1. Migration `20260816165000_clone_dedupe_and_source.sql`

**a) Cột + index (additive):**

```sql
alter table public.flashcard_sets add column source_share_token text;

create index idx_flashcard_sets_source_share_token
  on public.flashcard_sets(source_share_token)
  where source_share_token is not null;
```

- Comment: cột provenance — bản clone đến từ link chia sẻ nào. Nullable, **không unique** (1 token có nhiều clone). KHÔNG expose qua `get_shared_set_by_token` (không thêm vào returns table).

**b) Drop + recreate `clone_shared_set`** (return type đổi → drop trước, restore grants sau — đúng pattern S3):

Signature mới:

```sql
returns table (new_set_id uuid, already_exists boolean)
```

Logic (giữ nguyên mọi validations cũ, thêm 3 bước mới):

1. Validations giữ nguyên: token null/sai format `^[0-9a-f]{32}$` → 22023; user null → 42501; source `share_token = p_token` không có → 42501 'link not found or disabled'; `card_count > 2000` → 22023.
2. **Advisory lock chống race** (trước mọi check trùng — mirror pattern S1):
   `perform pg_advisory_xact_lock(hashtext('clone_shared_set:' || p_token || ':' || p_user_id::text));`
3. **Nếu `v_source.share_classroom_enabled`** (chốt 1) — tìm membership CÒN HIỆU LỰC:
   ```sql
   select m.clone_set_id into v_existing
   from public.shared_set_memberships m
   join public.flashcard_sets f
     on f.id = m.clone_set_id and f.user_id = m.member_user_id
   where m.set_id = v_source.id and m.member_user_id = p_user_id;
   ```
   - Join đảm bảo bản clone vẫn tồn tại + thuộc user (nếu học sinh đã xóa bản clone → không tìm thấy → tạo mới như bình thường, `register_set_membership` upsert trỏ lại bản mới).
   - Nếu found → `return query select v_existing, true;` — **KHÔNG tạo clone, KHÔNG gọi register** (membership giữ nguyên, `clone_set_id` không bị trỏ lại).
4. **Ngược lại (share thường — chốt 3)** — tìm bản đã lưu từ cùng nguồn:
   ```sql
   select id into v_existing
   from public.flashcard_sets
   where user_id = p_user_id and source_share_token = p_token
   order by created_at asc
   limit 1;
   ```
   - Chọn bản SỚM NHẤT (deterministic — "bạn đã lưu" = lần lưu đầu).
   - Nếu found → `return query select v_existing, true;`
5. Chưa từng lưu → tạo clone như cũ, **thêm `source_share_token`**:
   ```sql
   insert into public.flashcard_sets (user_id, name, description, source_share_token)
   values (p_user_id, v_source.name, v_source.description, p_token)
   returning id into v_new_set_id;
   ```
   (copy flashcards front/back/position giữ nguyên)
6. Classroom ON → `perform public.register_set_membership(p_token, v_new_set_id, p_user_id);` (chỉ khi tạo clone MỚI — membership không bao giờ bị re-point nữa vì re-clone đã bị chặn ở bước 3)
7. `return query select v_new_set_id, false;`

Grants (sau drop+create): `revoke all on function public.clone_shared_set(text, uuid) from public, anon, authenticated; grant execute on function public.clone_shared_set(text, uuid) to service_role;` + cập nhật comment hàm (thêm ý nghĩa dedupe).

### 3.2. Server action (`src/features/sharing/server/actions.ts`)

`cloneSharedSet` → `Promise<{ setId: string; alreadyExists: boolean } | { error: string }>`:

- Sau guard `error || !data?.[0]` → `const { new_set_id, already_exists } = data[0]`
- Return `{ setId: new_set_id, alreadyExists: already_exists ?? false }`
- `revalidatePath("/sets")` + `("/sets/library")` giữ nguyên

### 3.3. UI (`src/features/sharing/components/clone-set-button.tsx`)

Nhánh authed, sau khi action OK:

- **`alreadyExists && isClassroom`** → `router.push(\`/sets/${result.setId}\`)` — tự điều hướng thẳng, không hiện thông báo (chốt 1)
- **`alreadyExists && !isClassroom`** → set state `savedNotice` → render thay nút:
  - `<p role="status" className="text-sm text-text-secondary">Bạn đã lưu bộ này.</p>`
  - `<Button asChild variant="outline"><Link href={\`/sets/${result.setId}\`}>Mở bộ flashcard của bạn</Link></Button>` (chốt 3 — KHÔNG tự điều hướng)
- **Không alreadyExists** → `router.push` như hiện tại
- Nhãn nút, pending, error `role="alert"` giữ nguyên

### 3.4. pgTAP `030_shared_set_clone.sql` (CẬP NHẬT — hành vi re-clone thay đổi)

- `plan(26)` → đếm lại theo số assert mới (tăng)
- **Section 4 (classroom OFF)** — thêm:
  - `source_share_token` của clone = `token_a`
  - Gọi `clone_shared_set` lần 2 (cùng token + user) → trả về **đúng clone cũ** (`new_set_id` khớp clone_id) + `already_exists = true`
  - Số `flashcard_sets` thuộc B **không tăng** (không tạo bản mới)
- **Section 5 (classroom ON)** — SỬA khối re-clone:
  - Lần gọi thứ 2 (sau khi đã có membership trỏ clone_id_2) → trả về **clone_id_2** + `already_exists = true`
  - Membership vẫn **1 row**; `clone_set_id` **KHÔNG đổi** (vẫn clone_id_2) — **BỎ** assert cũ "re-clone refreshes clone_set_id to the latest snapshot"
  - Số `flashcard_sets` thuộc B không tăng
  - Thêm: clone classroom (clone_id_2) có `source_share_token = token_a`

### 3.5. `src/lib/supabase/types.ts`

Regen (convention đã có — S7 regen) để type RPC `clone_shared_set` có `new_set_id` + `already_exists`.

### 3.6. Edge cases (ghi rõ trong comment migration + ambiguities)

- Học sinh **xóa bản clone** nhưng membership còn → lần sau tham gia → tạo clone mới + `register_set_membership` upsert trỏ lại (khôi phục hợp lý — được xử lý bởi join ở 3.1.b3)
- Clone tạo **TRƯỚC migration này** có `source_share_token = NULL` → check trùng bộ thường không bắt được (1 lần duy nhất; chấp nhận — ghi chú)
- Classroom path **KHÔNG** check `source_share_token` (chỉ membership) — cố ý (chốt 2): học sinh clone bộ thường trước, chủ bật lớp học, học sinh bấm "Tham gia lớp học" → được tạo clone mới + membership
- Regular dedupe chọn bản clone **sớm nhất** (`created_at asc`) — deterministic

## 4. Verification gates (bắt buộc)

1. `npx supabase db reset` TRƯỚC `npm run db:test` (supabase test db không tự reset)
2. `npm run db:test`: **34 files PASS** (030 assertions tăng; KHÔNG thêm file test mới)
3. `npm run check`: lint 0 errors, typecheck clean, unit pass (cập nhật `clone-shared-set-action.test.ts` + `clone-set-button.test.tsx`), build OK
4. E2E: `npm run test:e2e -- shared-clone share-dialog shared-preview` — pass; cập nhật `shared-clone.spec.ts` thêm 2 case: (a) classroom join 2 lần → lần 2 về đúng `/sets/[id]` không đổi + không bản trùng; (b) regular save 2 lần → lần 2 hiện "Bạn đã lưu bộ này" + link mở bản đã lưu
5. `git diff --check` sạch

## 5. Files dự kiến

- `supabase/migrations/20260816165000_clone_dedupe_and_source.sql` (mới)
- `supabase/tests/030_shared_set_clone.sql` (cập nhật)
- `src/features/sharing/server/actions.ts` (sửa return + mapping alreadyExists)
- `src/features/sharing/components/clone-set-button.tsx` (nhánh alreadyExists)
- `src/lib/supabase/types.ts` (regen)
- `tests/unit/features/sharing/clone-shared-set-action.test.ts` (cập nhật)
- `tests/unit/features/sharing/clone-set-button.test.tsx` (cập nhật)
- `tests/e2e/shared-clone.spec.ts` (cập nhật)
- KHÔNG đụng: `register_set_membership`, `set_set_classroom_enabled`, `share-schema.ts`, `share-dialog.tsx`, `stats-dialog.tsx`, `get_shared_set_by_token`/`get_shared_set_cards`, migration cũ, docs

## 6. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files, +X/−Y), push status: NOT pushed
Trích code: RPC clone_shared_set mới (phần check trùng + return) + nhánh alreadyExists của button (ngắn)
Verification:
- npx supabase db reset: PASS/FAIL
- npm run db:test: N files / N assertions PASS (030 = N)
- npm run check: lint X errors / Y warnings, typecheck, unit N passed, build
- E2E shared-clone + share-dialog + shared-preview: N/N PASS
- git diff --check: PASS
Gemini review: APPROVE/REJECT kèm findings (file:line) — BẮT BUỘC trước khi gửi
Safety: migrations YES (1 additive, đã reset+test) · DB YES · deps/env/AI/production NO
Ambiguities: <nếu có>
```

## 7. Lưu ý cho implementer

- Đọc kỹ: `20260816130000_clone_shared_set.sql` (RPC hiện tại), `20260816082928_set_sharing.sql` (register + memberships + advisory lock pattern), `20260816120000_add_classroom_flag_to_shared_preview.sql` (pattern drop+create + restore grants)
- Đếm lại `plan()` pgTAP sau khi sửa — `npm run db:test` phải PASS
- Migration N8 của Phase sau dùng `20260816160000`, N12 dùng `20260816170000`, N13 dùng `20260816180000` — S8 dùng `20260816165000` để **không trùng slot** (các object độc lập nên thứ tự apply không ảnh hưởng)
- Giữ nguyên mọi migration đã apply; không sửa S1–S7
