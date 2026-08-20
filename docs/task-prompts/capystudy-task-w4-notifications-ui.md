# CapyStudy Task W4 — Notifications UI: cài đặt nhắc nhở trong /settings

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `684361a` — **phụ thuộc Task W3 (backend) đã xong** (bảng + VAPID public key + server action path)
- `Agent tier`: DeepSeek Flash (implementer) + Gemini (independent review — chạm server action + DB mới)
- `Commit message`: `feat: add push notification settings to profile`
- `Push`: KHÔNG push — gửi evidence report; chỉ push sau khi coordinator verify + user duyệt

## 1. Yêu cầu (từ user — đã chốt)

> Notifications: **nhắc streak** + **nhắc ôn tập**, **tách 2 tin**, giờ **tự chọn** (mặc định 19:00), Android + iOS cài PWA (iOS 16.4+ — chỉ nhận push khi CÀI app lên màn hình chính).

Task này = **UI + client subscribe/unsubscribe** trong trang Cá nhân → Cài đặt.

## 2. Phạm vi task

1. Server actions: upsert `notification_preferences` + subscribe/unsubscribe `push_subscriptions`
2. Client: section "Nhắc nhở" trong `/profile` tab settings:
   - Master toggle "Cho phép nhắc nhở" → xin quyền browser (user gesture) → subscribe push → lưu subscription
   - 2 toggle con: "Nhắc giữ streak" (time picker giờ/phút) + "Nhắc ôn tập" (time picker giờ/phút) — chỉ enable khi master ON
   - Trạng thái iOS: nếu không phải standalone PWA → hiện hướng dẫn "Cài app lên màn hình chính để nhận thông báo (iOS 16.4+)"
3. Unsubscribe khi tắt master: unregister/delete subscription + xóa row
4. Unit test (mock PushManager/Notification) + E2E

KHÔNG làm: edge function gửi (W3), nội dung notification (W3), offline (W2).

## 3. Thiết kế chi tiết

### 3.1. Server actions (`src/features/notifications/server/actions.ts` — feature mới)

- `saveNotificationPreferences(input: { pushEnabled: boolean; streakEnabled: boolean; streakTime: string; reviewEnabled: boolean; reviewTime: string })` — "use server": zod validate (time format HH:MM, regex `^([01]\d|2[0-3]):[0-5]\d$`), auth getClaims → upsert `notification_preferences` (admin client hoặc RLS owner insert — chọn pattern khớp dự án, ghi rõ) → `revalidatePath("/profile")` → `{ ok }`
- `savePushSubscription(input: { endpoint: string; p256dh: string; auth: string })` — validate + upsert `push_subscriptions` (on conflict (user_id, endpoint) do update) → `{ ok }`
- `deletePushSubscription(input: { endpoint: string })` — xóa row của user → `{ ok }`
- Lỗi → generic tiếng Việt, không lộ chi tiết.

### 3.2. Client component (`src/features/notifications/components/notification-settings.tsx` — "use client")

- Props: `prefs: NotificationPreferences | null` (từ server page), `vapidPublicKey: string` (từ env `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — chỉ public key, an toàn)
- Flow bật master:
  1. `navigator.serviceWorker` + `PushManager` không có → hiện "Trình duyệt không hỗ trợ" (disabled)
  2. `Notification.permission` → nếu "default": `Notification.requestPermission()` (gọi TRONG handler click — user gesture, bắt buộc)
  3. denied → hiện hướng dẫn bật lại qua cài đặt trình duyệt
  4. granted → `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) })` → lấy `subscription.toJSON()` → `savePushSubscription` → sau đó `saveNotificationPreferences({ pushEnabled: true, ... })`
- Flow tắt master: `deletePushSubscription` (tất cả endpoint của user) → `saveNotificationPreferences({ pushEnabled: false })` (giữ streak/review settings — chỉ tắt master)
- Toggle con + time picker: onChange → `saveNotificationPreferences` (debounce hoặc save trực tiếp — chọn, ghi rõ); hiển thị pending + error state (pattern mutation có sẵn trong dự án)
- iOS: `window.matchMedia("(display-mode: standalone)")` — nếu iOS (`navigator.userAgent` có iPhone/iPad) + không standalone → hiện khối hướng dẫn cài PWA (text + cách cài), vẫn cho bật nhưng note "chỉ nhận được sau khi cài"
- Helper `urlBase64ToUint8Array` — đặt trong `src/features/notifications/utils/vapid.ts` + unit test

### 3.3. Server page

- `src/app/(app)/profile/page.tsx` (tab settings): load `notification_preferences` + đếm `push_subscriptions` (server) → render `<NotificationSettings />` — section mới nằm trong tab settings (giữ styling section hiện có), dưới/trên khu vực phù hợp (đặt sau ProfileSettingsForm, trước SignOutButton — xem bố cục hiện tại).

### 3.4. Types

- Regenerate `src/lib/supabase/types.ts` nếu cần (pattern dự án: `npm run db:types` — xác nhận W3 migration đã apply local).

## 4. Verification gates (bắt buộc)

1. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
2. Unit:
   - `vapid.test.ts`: urlBase64ToUint8Array đúng (fixture base64url)
   - `notification-settings.test.tsx` (mock `navigator.serviceWorker`/`PushManager`/`Notification` + mock server actions): bật master → requestPermission + subscribe + savePushSubscription + savePrefs; từ chối permission → hướng dẫn; tắt → delete + savePrefs; không hỗ trợ → disabled
   - `notification-actions.test.ts`: validate schema (time sai → error; endpoint thiếu → error) + auth + upsert (mock admin/RPC)
3. E2E `tests/e2e/notifications-settings.spec.ts` (Playwright grant push permission qua context — `context.grantPermissions(["notifications"])` nếu hỗ trợ; nếu không, mock ở mức page hoặc chỉ assert UI toggle + không-crash):
   - Vào /profile tab settings → section hiện
   - Bật master (mock permission granted) → UI state ON
   - Chọn giờ streak/review → save + reload giữ nguyên
   - Tắt → UI OFF
   - (nếu grantPermissions hoạt động) assert pushManager.subscribe được gọi — qua page evaluate stub
4. Regression: `npm run test:e2e -- profile-settings primary-navigation`
5. `git diff --check` sạch

## 5. Files dự kiến

- `src/features/notifications/server/actions.ts` (mới)
- `src/features/notifications/components/notification-settings.tsx` (mới)
- `src/features/notifications/utils/vapid.ts` (mới)
- `src/app/(app)/profile/page.tsx` (sửa — load prefs + render section)
- `src/lib/supabase/types.ts` (regen nếu cần)
- Tests: `tests/unit/features/notifications/*` + `tests/e2e/notifications-settings.spec.ts`
- KHÔNG đụng: W3 edge function, W1/W2 SW, auth flow

## 6. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files), push status: NOT pushed
Trích code: server action saveNotificationPreferences (ngắn) + đoạn subscribe flow
Verification:
- npm run check: lint X/Y, typecheck, unit N passed, build OK
- Unit notifications: N/N PASS
- E2E notifications-settings: N/N PASS; regression profile-settings primary-navigation: N/N PASS
- git diff --check: PASS
Gemini review: APPROVE/REJECT kèm findings — BẮT BUỘC (chạm DB qua server action)
Safety: migrations NO (dùng bảng W3) · DB YES (ghi/đọc bảng mới) · deps NO · env NO (NEXT_PUBLIC_VAPID_PUBLIC_KEY từ W3) · AI NO · production NO
Ambiguities: <cách mock push trong E2E; debounce save; vị trí section>
```

## 7. Lưu ý cho implementer

- Bắt buộc `Notification.requestPermission()` gọi trong user gesture — không gọi khi mount.
- `applicationServerKey` phải là Uint8Array (base64url → bytes) — dùng helper đã test.
- Subscription object: `subscription.toJSON()` trả `{ endpoint, keys: { p256dh, auth } }` — lưu đúng 3 field.
- Không lưu/ghi log subscription key — dữ liệu nhạy cảm (chỉ DB, không console.log).
- Settings giữ nguyên khi tắt master (bật lại không phải nhập lại giờ).
- Đọc W3 để khớp tên cột/pattern server action (admin client vs RLS insert).
