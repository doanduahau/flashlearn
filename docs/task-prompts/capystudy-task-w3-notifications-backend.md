# CapyStudy Task W3 — Notifications backend: push subscriptions + Edge Function gửi nhắc (cron)

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `684361a` (độc lập W1/W2 — có thể chạy song song)
- `Agent tier`: **Gemini (implementer) + coordinator review — BẮT BUỘC 2 review độc lập** (task chạm DB + production: migration mới + VAPID secrets + deploy Edge Function)
- `Commit message`: `feat: add push subscriptions and scheduled reminder sender`
- `Push`: KHÔNG push — gửi evidence report + chờ user duyệt (deploy production gồm: migration db push + secrets + functions deploy — làm riêng, có xác nhận)

## 1. Yêu cầu (từ user — đã chốt)

> Notifications: **nhắc streak hằng ngày** + **nhắc ôn tập**, **tách 2 tin riêng**, giờ **người dùng tự chọn** (mặc định 19:00), nền tảng Android + iOS cài PWA (iOS 16.4+).

Task này = **back-end toàn bộ**: schema, VAPID, Edge Function cron. UI (W4) làm sau.

## 2. Phạm vi task

1. **Migration mới**: 3 bảng (`push_subscriptions`, `notification_preferences`, `push_notifications_log`) + RLS + helper SQL `get_due_review_card_count` + pgTAP
2. **VAPID keys**: sinh cặp key; public key vào `.env.example`/env client; private key vào Supabase secret (edge function env)
3. **Edge Function `send-reminders`** (Deno): đọc user + subscription + preferences → gửi web push (web-push npm qua npm: specifier)
4. **Cron schedule**: pg_cron (migration) gọi edge function qua pg_net `*/15 phút` — đủ chi tiết cho giờ tùy chọn theo phút
5. Ghi log gửi (dedupe 1 tin/loại/ngày/user)
6. Hướng dẫn deploy production (migration + secrets + functions deploy) — KHÔNG tự deploy, chỉ chuẩn bị

KHÔNG làm: UI cài đặt (W4), subscribe/unsubscribe client (W4), xử lý click notification (có thể để W4).

## 3. Thiết kế chi tiết

### 3.1. Migration `supabase/migrations/20260817XXXXXX_push_notifications.sql` (timestamp thực tế)

**Bảng `push_subscriptions`**

```sql
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
```

- RLS: policy owner CRUD (`user_id = auth.uid()`): select/insert/update/delete own rows; authenticated chỉ thao tác row của mình; service_role all (mirror `daily_learning_records` grants — xem migration cũ để copy đúng pattern revoke/grant).
- Index: `(user_id)`, `(endpoint)`.

**Bảng `notification_preferences`** (1 row/user)

```sql
create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default false,
  streak_enabled boolean not null default true,
  streak_time time not null default '19:00',
  review_enabled boolean not null default true,
  review_time time not null default '19:00',
  updated_at timestamptz not null default now()
);
```

- RLS: owner CRUD (như trên).

**Bảng `push_notifications_log`** (dedupe + audit)

```sql
create table public.push_notifications_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('streak','review')),
  local_date date not null,
  sent_at timestamptz not null default now(),
  unique (user_id, kind, local_date)
);
```

- RLS: service_role only (user không đọc/ghi log — hoặc select-own nếu muốn hiển thị lịch sử sau; mặc định service_role only, ghi rõ).

**Helper SQL `get_due_review_card_count(p_user_id uuid) returns integer`** — mirror logic `loadWrongAnswerCardIds` (dashboard N14: latest-wrong gộp 3 chế độ quiz/match/typing):

- Đếm flashcard thuộc user có trạng thái **sai gần nhất** (không có lần đúng sau đó) trong: `quiz_questions` (is_correct = false, không có câu quiz đúng sau), `mode_answer_events` (mode match/typing, is_correct = false, không có event đúng sau), `card_review_events` (nếu dùng cho review — kiểm tra N14 code để mirror chính xác)
- Trả 0 khi user null (không raise). SECURITY DEFINER? KHÔNG cần — chỉ gọi từ edge function (service_role) — nhưng để an toàn đặt security invoker + grant service_role; ghi rõ quyết định.

**pg_cron schedule** (trong migration, idempotent):

```sql
create extension if not exists pg_cron;
-- xoá job cũ nếu có rồi tạo mới (idempotent)
select cron.unschedule('capystudy-send-reminders') where exists (
  select 1 from cron.job where jobname = 'capystudy-send-reminders');
select cron.schedule('capystudy-send-reminders', '*/15 * * * *',
  $cron$ select net.http_post(
    url := '<FUNCTION_URL>',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <cron-secret>'
    ),
    body := '{}'
  ) $cron$);
```

- `<FUNCTION_URL>` + `<cron-secret>`: dùng placeholder + hướng dẫn thay khi deploy (KHÔNG hardcode secret vào migration — hoặc dùng `current_setting`/secret bảng nếu có pattern sẵn; ghi rõ). Lưu ý pg_cron chỉ có trên hosted Supabase + local CLI — verify.
- Cron chạy `*/15 phút`, edge function tự quyết ai đáng nhận theo giờ địa phương (xem 3.3).

### 3.2. VAPID

- Sinh: `npx web-push generate-vapid-keys` (hoặc tương đương) → cặp public/private.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` → `.env.example` (client cần ở W4).
- `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` (mailto:) → **Supabase secret** cho edge function (hướng dẫn: `supabase secrets set --env-file ...` — chuẩn bị script/lệnh, KHÔNG chạy production).
- Edge function đọc qua `Deno.env.get("VAPID_PRIVATE_KEY")`.

### 3.3. Edge Function `supabase/functions/send-reminders/index.ts`

- Import web-push: `import webpush from "npm:web-push@<ver>";` (Deno npm specifier).
- Auth guard: yêu cầu header `Authorization: Bearer <cron-secret>` khớp env `CRON_SECRET` (so sánh constant-time hoặc đơn giản — ghi rõ); `verify_jwt = false` trong config.toml vì gọi qua pg_net.
- Logic:
  1. Query `notification_preferences p` join `push_subscriptions s` where `p.push_enabled = true` (join 1:N — mỗi user có thể nhiều subscription/device)
  2. Với mỗi user: tính `local_now` theo `profiles.timezone` (fallback Asia/Ho_Chi_Minh); `local_date`; kiểm tra:
     - **streak**: `p.streak_enabled` AND `local_now::time >= p.streak_time` (cửa sổ 15 phút: `local_now::time between p.streak_time and p.streak_time + interval '15 minutes'`) AND **chưa học hôm nay** (không có `daily_learning_records` local_date hôm nay) AND chưa gửi hôm nay (log dedupe)
     - **review**: `p.review_enabled` AND cửa sổ giờ tương tự AND `get_due_review_card_count(user_id) > 0` AND chưa gửi hôm nay
  3. Gửi web push: payload `{ title, body, data: { url } }`:
     - streak: title "CapyStudy", body "Hôm nay chưa học — giữ streak nào!" (hoặc tương tự), data.url `/study/mode`
     - review: body "Còn N thẻ cần ôn — vào ôn ngay nhé!", data.url `/quiz/mode`
     - `vapidDetails: { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY }`
  4. Ghi `push_notifications_log` (upsert ignore duplicate — `on conflict do nothing`); nếu trùng (đã gửi) → bỏ qua
  5. Lỗi gửi 1 subscription (410 Gone — subscription hết hạn) → **xóa subscription đó**; lỗi khác → log + tiếp tục
  6. Trả JSON `{ sent: n, skipped: m }`
- `supabase/config.toml`: khai báo `[functions.send-reminders] verify_jwt = false` (KHÔNG khai cron trong config.toml — dùng pg_cron migration để có thể migrate được; ghi rõ).

### 3.4. pgTAP `supabase/tests/0XX_push_notifications.sql`

Cover:

1. Security boundary: 3 bảng RLS enabled + policy owner đúng; grants (authenticated CRUD own, service_role all; anon/authenticated KHÔNG đọc log nếu chọn service_role only)
2. `push_subscriptions`: insert/update/delete own OK; user khác không đụng được row của nhau (isolation)
3. `notification_preferences`: unique user_id; default đúng (push_enabled false, streak/review true, times 19:00)
4. `push_notifications_log`: unique (user_id, kind, local_date) — insert trùng bị chặn/ignore
5. `get_due_review_card_count`: fixture thẻ sai gần nhất → đếm đúng; thẻ sai rồi đúng → không đếm; user null → 0
6. pg_cron job tồn tại với schedule đúng (nếu test được — nếu khó, verify bằng query `cron.job`; nếu local không có pg_cron → ghi chú)

## 4. Verification gates (bắt buộc)

1. `npx supabase db reset` TRƯỚC `npm run db:test` (đúng convention)
2. `npm run db:test`: N files PASS (thêm file pgTAP mới), assertions tăng
3. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
4. Edge function: chạy local (`supabase functions serve`) + invoke thử với fixture (ghi kết quả; nếu không gửi được push thật do thiếu subscription hợp lệ — ghi rõ, dùng mock)
5. `git diff --check` sạch
6. E2E: không thuộc task này (W4)

## 5. Files dự kiến

- `supabase/migrations/20260817XXXXXX_push_notifications.sql` (mới)
- `supabase/tests/0XX_push_notifications.sql` (mới)
- `supabase/functions/send-reminders/index.ts` (mới)
- `supabase/config.toml` (khai báo function)
- `.env.example` (+NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_SUBJECT — ghi chú private key là supabase secret KHÔNG vào env file)
- KHÔNG đụng: W1/W2, auth, quiz/study logic, migration cũ

## 6. Evidence report template

```text
Repository: start 684361a → final <hash> (1 commit, N files), push status: NOT pushed
Trích code: migration (bảng + cron) + 1 đoạn edge function gửi push
Verification:
- npx supabase db reset: PASS/FAIL
- npm run db:test: N files / N assertions PASS
- npm run check: lint X/Y, typecheck, unit N passed, build OK
- Edge function local: <kết quả invoke thử>
- git diff --check: PASS
Review: Gemini + coordinator — APPROVE/REJECT kèm findings (file:line)
Safety: migrations YES (1 additive + pg_cron) · DB YES · deps NO (npm:web-push runtime only) · env YES (VAPID) · production NO (chưa deploy — hướng dẫn kèm)
Ambiguities: <pg_cron local availability; placeholder URL/secret thay khi deploy>
```

## 7. Lưu ý cho implementer

- Mirror pattern security của migration sharing gần đây (S1–S8): SECURITY DEFINER chỉ khi cần, empty search_path, revoke/grant rõ ràng.
- `net.http_post` cần extension `pg_net` — check local + hosted (hosted Supabase có sẵn; local có thể cần `create extension pg_net` — verify).
- KHÔNG deploy production trong task này: chỉ chuẩn bị migration + function + hướng dẫn lệnh deploy (user duyệt riêng).
- Cron `*/15 phút` + so khớp cửa sổ 15 phút với `streak_time`/`review_time` (time) — đảm bảo không bắn 2 lần trong 1 cửa sổ (log dedupe là chốt chặn cuối).
- Body notification tiếng Việt, ngắn gọn, có emoji nhẹ (theo tinh thần UI).
