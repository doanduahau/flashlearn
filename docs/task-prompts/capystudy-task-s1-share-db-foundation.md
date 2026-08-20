# CapyStudy — Task S1: Sharing DB foundation (share + classroom: token, memberships + 6 RPC + pgTAP)

> **Loại:** Database/security — migration mới + RPC SECURITY DEFINER.
> **Tier:** Codex + Terra — **BẮT BUỘC Sol review độc lập trước khi push** (chạm public read boundary).
> **Baseline commit:** commit mới nhất trên main tại thời điểm giao (đã push, main đồng bộ origin/main).
> **Quy tắc:** KHÔNG đụng file ngoài danh sách. 1 commit. KHÔNG push — gửi evidence report.

---

## 0. Bối cảnh (đã chốt với user)

Feature "Sharing": chủ sở hữu bộ flashcard thường tạo share link → người khác xem preview (không cần đăng nhập) → clone về tài khoản của họ. Quyết định frozen:

1. Chỉ **bộ flashcard thường** (KHÔNG bộ đặc biệt).
2. Preview **không cần đăng nhập** — nhưng anon KHÔNG được query trực tiếp bảng; mọi đọc qua RPC.
3. Clone = bản sao độc lập (snapshot, không sync) — **S4 làm sau, task này KHÔNG làm clone**.
4. Chủ sở hữu **tạo + revoke** link; revoke = token hết hiệu lực ngay.
5. Giới hạn clone 2000 thẻ — **S4 làm sau**.

**BỔ SUNG 2026-08-16 — Chế độ lớp học (đã chốt với user):**

6. Giáo viên share 1 bộ cho nhiều học sinh → học sinh clone → giáo viên xem **bảng thống kê + xếp hạng** (chỉ giáo viên thấy, học sinh không).
7. Xếp hạng theo **tổng số câu trả lời đúng** (Trắc nghiệm + Match); tie-break: nhiều bài hơn → tham gia sớm hơn; học sinh chưa làm bài xếp cuối.
8. Ghi nhận thành viên **CHỈ khi giáo viên bật toggle "Chế độ lớp học"** trong dialog Share — share thường không ghi nhận ai (tránh nhiễu bởi người lạ).
9. Thống kê tính cả **Trắc nghiệm + Match** → cần lưu kết quả Match (**bảng `match_attempts` + luồng hoàn thành Match ghi kết quả — luồng làm ở task riêng S5; task này chỉ tạo TABLE**, không sửa luồng Match).

**Task này chỉ làm:** migration DB (share + classroom foundation) + 6 RPC + pgTAP. KHÔNG UI, KHÔNG route, KHÔNG clone, KHÔNG sửa luồng Match. Các bảng/RPC stats cho Match được nối ở task sau.

## 1. Yêu cầu migration

Tạo file mới: `supabase/migrations/<timestamp>_set_sharing.sql` (timestamp = ngày giờ hiện tại theo convention dự án `YYYYMMDDHHMMSS_name.sql` — xem `ls supabase/migrations/ | tail -3` để lấy format).

### 1.1 Cột share_token trên flashcard_sets

```sql
alter table public.flashcard_sets
  add column share_token text;

create unique index idx_flashcard_sets_share_token
  on public.flashcard_sets (share_token)
  where share_token is not null;
```

- Token = `replace(gen_random_uuid()::text, '-', '')` (32 ký tự hex, không đoán được) — **sinh trong RPC, không nhận từ client**.
- Không thêm cột `shared_at` (chưa cần; nếu cần sau này thêm migration mới).

### 1.2 RPC 1 — `create_set_share_token(p_user_id uuid, p_set_id uuid) returns text`

- SECURITY DEFINER, `set search_path = ''`, theo đúng pattern `create_quiz_session_prioritized` (xem file đó làm mẫu).
- Validate: `p_user_id` không null (errcode `42501`), `p_set_id` là uuid hợp lệ.
- Ownership: `select id from public.flashcard_sets where id = p_set_id and user_id = p_user_id` — không có → raise `42501`.
- Sinh token mới (`gen_random_uuid()` không dấu gạch) và `update flashcard_sets set share_token = <token> where id = p_set_id and user_id = p_user_id`.
- Trả token. **Idempotent-ish:** gọi lại khi đã có token → tạo token MỚI (rotate) — hợp lý vì revoke cũng là tạo lại. Ghi rõ trong comment.
- Revoke/grant cuối file (pattern chuẩn):
  ```sql
  revoke all on function public.create_set_share_token(uuid, uuid) from public, anon, authenticated;
  grant execute on function public.create_set_share_token(uuid, uuid) to service_role;
  ```

### 1.3 RPC 2 — `revoke_set_share_token(p_user_id uuid, p_set_id uuid) returns void`

- Cùng boundary: SECURITY DEFINER, empty search_path, ownership check → `update flashcard_sets set share_token = null where id = p_set_id and user_id = p_user_id`.
- Grant chỉ service_role.

### 1.4 RPC 3 — `get_shared_set_by_token(p_token text) returns table(...)`

**RPC này là trọng tâm bảo mật — đọc PUBLIC data qua token, không lộ dữ liệu người khác.**

- SECURITY DEFINER, `set search_path = ''`.
- Validate `p_token`: không null, độ dài 32, chỉ ký tự hex (regex `^[0-9a-f]{32}$`) — không hợp lệ → raise `22023`.
- Query set theo token:
  ```sql
  select s.id, s.name, s.description, s.created_at,
         p.display_name as owner_display_name
  from public.flashcard_sets s
  left join public.profiles p on p.id = s.user_id
  where s.share_token = p_token
  ```
  - Không tìm thấy → **return empty** (KHÔNG raise — để UI render "link không tồn tại hoặc đã bị tắt", không lộ thông tin token hợp lệ hay không).
  - KHÔNG trả `user_id` của chủ sở hữu (chỉ display_name) — giảm lộ thông tin.
  - KHÔNG trả thẻ trong RPC này; thẻ lấy ở RPC riêng (1.5).
- Return type: `table(set_id uuid, name text, description text, created_at timestamptz, owner_display_name text, card_count bigint)` — card_count tính bằng subquery count trên flashcards (chỉ để hiển thị).
- Grant: **`authenticated`** (pattern các RPC read khác của dự án — kiểm tra 1 RPC read hiện có để khớp, vd runner/quiz read RPC; anon KHÔNG được grant). Server page gọi bằng client có session (hoặc service role nếu cần — xem mục 3).

### 1.5 RPC 4 — `get_shared_set_cards(p_token text) returns table(card_id uuid, front text, back text, position integer)`

- Cùng boundary/validation token như 1.4.
- Trả toàn bộ thẻ của set khớp token, sắp theo `position asc`:
  ```sql
  select f.id, f.front, f.back, f.position
  from public.flashcard_sets s
  join public.flashcards f on f.set_id = s.id and f.user_id = s.user_id
  where s.share_token = p_token
  order by f.position asc
  ```
  - Ràng buộc `f.user_id = s.user_id` (composite FK đã có) — an toàn kép.
- Token không tồn tại → return empty (KHÔNG raise).
- Grant `authenticated` (giống 1.4).

### 1.6 Cột share_classroom_enabled trên flashcard_sets

```sql
alter table public.flashcard_sets
  add column share_classroom_enabled boolean not null default false;
```

- Nghĩa: link hiện tại là **link lớp học** — clone qua link này sẽ ghi nhận thành viên (chỉ có ý nghĩa khi `share_token` khác null).
- **Revoke share (RPC 2) phải đồng thời set `share_classroom_enabled = false`** — tắt share là dừng mọi ghi nhận mới, tránh bất ngờ khi tạo link lại.
- `create_set_share_token` (RPC 1) KHÔNG tự bật classroom — giáo viên bật riêng qua RPC 5.

### 1.7 Bảng shared_set_memberships (ghi nhận thành viên lớp học)

```sql
create table public.shared_set_memberships (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.flashcard_sets(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  clone_set_id uuid not null references public.flashcard_sets(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (set_id, member_user_id)
);

create index idx_shared_set_memberships_set on public.shared_set_memberships(set_id);

alter table public.shared_set_memberships enable row level security;
```

- Chỉ **chủ sở hữu set** đọc được (policy `select` cho authenticated where set thuộc `auth.uid()` — hoặc chỉ đọc qua RPC stats, chọn 1 và ghi rõ; KHÔNG cho member đọc bảng này — họ không cần).
- Mọi ghi (insert/update) chỉ qua RPC 6 (service_role) — browser không ghi trực tiếp.
- `clone_set_id` = bản sao mà học sinh tạo (snapshot độc lập) — để thống kê biết học sinh học trên bản sao nào.
- `unique (set_id, member_user_id)` → học sinh clone lại lần 2: **upsert, cập nhật `clone_set_id` + `joined_at`** (bản sao mới nhất là dữ liệu thống kê).

### 1.8 RPC 5 — `set_set_classroom_enabled(p_user_id uuid, p_set_id uuid, p_enabled boolean) returns void`

> Lưu ý: đánh số RPC trong doc hơi lệch (mục 1.4/1.5 là RPC 3/4) — KHÔNG quan trọng, chỉ để tham chiếu.

- SECURITY DEFINER, empty search_path, ownership check (như RPC 1).
- `update flashcard_sets set share_classroom_enabled = p_enabled where id = p_set_id and user_id = p_user_id`.
- KHÔNG tự tạo token — chỉ bật/tắt cờ. Grant chỉ service_role.

### 1.9 RPC 6 — `register_set_membership(p_token text, p_clone_set_id uuid, p_member_user_id uuid) returns uuid`

**RPC này là trọng tâm của chế độ lớp học — ghi nhận thành viên khi clone.**

- SECURITY DEFINER, empty search_path.
- Validate `p_token` (32 hex, như 1.4); `p_clone_set_id` + `p_member_user_id` không null.
- Lấy set theo token: `select id, share_classroom_enabled from public.flashcard_sets where share_token = p_token`:
  - Không có set → raise `42501` ("Link không tồn tại hoặc đã bị tắt").
  - `share_classroom_enabled = false` → raise `42501` ("Bộ này không ở chế độ lớp học") — KHÔNG ghi nhận.
- Validate chủ sở hữu clone: `p_clone_set_id` phải thuộc `p_member_user_id` (không được trỏ sang set người khác).
- Upsert:
  ```sql
  insert into public.shared_set_memberships (set_id, member_user_id, clone_set_id)
  values (v_set_id, p_member_user_id, p_clone_set_id)
  on conflict (set_id, member_user_id)
  do update set clone_set_id = excluded.clone_set_id, joined_at = now()
  returning id
  ```
- Grant chỉ service_role (clone chạy server-side qua admin client — pattern `create_quiz_session_prioritized`).

## 2. Quy tắc bảo mật (bắt buộc)

- **KHÔNG mở RLS public/anon** trên `flashcard_sets` hay `flashcards` — mọi chính sách hiện có (`*_select_own` cho authenticated) giữ nguyên 100%.
- Mọi RPC: `security definer`, `set search_path = ''`, validate đầu vào ở boundary, không lộ stack trace/SQL error cho client.
- SECURITY DEFINER function KHÔNG được dùng `search_path` mặc định — phải `set search_path = ''` (pattern bắt buộc dự án).
- Không trả `user_id`/email/avatar của chủ sở hữu qua RPC public.
- Revoke/grant đúng: create/revoke/set_classroom/register_membership → service_role only; get_shared_* → authenticated (không anon, không public).
- **Membership chỉ ghi nhận khi `share_classroom_enabled = true`** — RPC 6 phải raise khi cờ tắt (không âm thầm bỏ qua).
- `shared_set_memberships`: member KHÔNG đọc được; chỉ owner (qua RLS hoặc RPC stats ở task sau).
- Revoke share = token null + classroom false (đã ghi ở 1.6).

## 3. Ghi chú cho S3 (không làm bây giờ, chỉ để hiểu)

Preview page `/share/[token]` sẽ: server page (ngoài `(app)` group) dùng supabase server client có session nếu user đăng nhập, hoặc service role client nếu anon — gọi `get_shared_set_by_token` + `get_shared_set_cards`. Nếu RPC chỉ grant authenticated thì anon path cần service role (server-only, đã có `createAdminClient`). **KHÔNG cần thay đổi gì ở task này** — chỉ cần RPC đúng boundary. Nếu agent thấy mâu thuẫn (anon không thể gọi authenticated RPC), ghi rõ trong ambiguities — KHÔNG tự ý đổi grant.

## 4. pgTAP test

Tạo `supabase/tests/<stt>_set_share_tokens.sql` (stt = số tiếp theo sau file pgTAP lớn nhất hiện có — xem `ls supabase/tests/ | tail -3`):

Bắt buộc cover:

1. Security boundary: 6 RPC đều `prosecdef = true`, search_path rỗng, grant đúng role (service_role vs authenticated), revoke khỏi public/anon.
2. `create_set_share_token`: chủ sở hữu tạo được token (32 hex); user khác gọi → lỗi 42501; set không tồn tại → lỗi; rotate (gọi 2 lần → token khác nhau, cũ vô hiệu); tạo token KHÔNG bật classroom.
3. `revoke_set_share_token`: revoke xong → `get_shared_set_by_token` trả empty; **`share_classroom_enabled` cũng về false**; chỉ owner revoke được.
4. `get_shared_set_by_token`: token hợp lệ trả đúng set + card_count + owner display_name; KHÔNG trả user_id (assert column không tồn tại trong output); token lạ → empty (không lỗi); token sai format → lỗi 22023; token của user B không trả thẻ user A.
5. `get_shared_set_cards`: trả đúng thẻ theo position; token lạ → empty; không lộ thẻ của set khác.
6. Ownership isolation: set user A share → user B đọc được qua token (đúng mục đích), nhưng user B KHÔNG query được bảng trực tiếp (RLS vẫn chặn) — assert qua `set_config('role','anon')` hoặc authenticated không phải chủ sở hữu.
7. `set_set_classroom_enabled`: owner bật/tắt được; user khác → 42501; cờ lưu đúng.
8. `register_set_membership`: token hợp lệ + classroom ON → tạo membership (set_id/member/clone đúng); gọi lại cùng member → upsert (clone_set_id mới, joined_at mới, vẫn 1 row); classroom OFF → raise 42501 và KHÔNG tạo row; token lạ → raise; clone_set_id không thuộc member → raise; member KHÔNG đọc được bảng memberships (RLS).

Dùng pattern file `028_prioritized_quiz_session.sql` làm mẫu (insert auth.users + flashcard_sets + flashcards với UUID cố định, `select plan(N)`).

## 5. Verification

```bash
npm run db:test        # hoặc lệnh pgTAP của dự án (xem package.json scripts)
npx supabase db reset  # sạch từ DB trống — migration chain chạy được
npm run check
```

## 6. Commit

```bash
git add supabase/migrations/<file>.sql supabase/tests/<file>.sql
git commit -m "feat: add set share tokens and classroom membership foundation"
```

## 7. Evidence report

- Repository: start/final commit, push status.
- Migration: cột + index + từng RPC (signature, boundary, grant) — trích code ngắn.
- pgTAP: số file/assertions pass.
- Safety: DB local reset YES, production NO.
- Ambiguities (vd: quyết định rotate token, grant authenticated vs service_role cho get_shared_*).
- Verdict: `EVIDENCE READY FOR REVIEW` / `INCOMPLETE — BLOCKER REQUIRES USER DECISION`.
