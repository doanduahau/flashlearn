# CapyStudy Task W2 — Offline: xem dữ liệu đã tải (read-only) + banner offline

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `684361a` — **phụ thuộc Task W1 (PWA core) đã xong** (Serwist + SW + manifest + trang /offline)
- `Agent tier`: DeepSeek Flash (implementer) + Gemini (independent review)
- `Commit message`: `feat: serve cached data pages offline with offline banner`
- `Push`: KHÔNG push — gửi evidence report; chỉ push sau khi coordinator verify + user duyệt

## 1. Yêu cầu (từ user)

> "Mất mạng vẫn mở được app (giao diện + asset tĩnh)... thêm cache IndexedDB: dashboard, danh sách bộ, thẻ đã từng mở vẫn xem được (read-only) khi mất mạng, có banner 'dữ liệu cũ'." (đã chốt: **Shell + xem dữ liệu đã tải**)

## 2. Phạm vi task

1. **Navigation caching** (trong SW Serwist) cho 4 trang đọc chính: `/dashboard`, `/sets`, `/sets/library`, `/sets/[setId]` — **NetworkFirst**: có mạng → fetch mới + cập nhật cache; mất mạng → phục vụ bản HTML đã cache lần cuối
2. **Banner offline** client-side: component `OfflineBanner` hiện khi `navigator.onLine === false` (lắng nghe `online`/`offline` events), text: _"Bạn đang offline — dữ liệu có thể chưa mới nhất"_
3. Navigation không cache được (trang khác) khi offline → fallback về `/offline` (trang W1)
4. E2E dùng `context.setOffline(true)` verify toàn bộ luồng

KHÔNG làm: offline ghi dữ liệu (quiz/study offline → phase sau), đồng bộ khi có mạng lại, notifications (W3/W4).

## 3. Thiết kế chi tiết

### 3.1. Navigation caching (Serwist runtime caching)

- Trong `src/app/sw.ts` (W1): thêm runtime cache cho navigation requests:
  - Handler **NetworkFirst**, cacheName `capystudy-pages-v1`
  - Match: các navigation tới 4 route trên (regex hoặc `({ request }) => request.mode === "navigate" && <route match>`)
  - `networkTimeoutSeconds: 5` (chờ mạng 5s rồi fallback cache — tránh treo lâu khi mạng chập chờn)
  - Nếu request offline và không có cache cho route đó → fallback `/offline` (navigation fallback)
- Lưu ý Serwist/Workbox API: dùng `NetworkFirst` từ serwist runtime (không phải workbox) — đọc tài liệu serwist `@serwist/...` đúng bản đã cài, ghi rõ.
- **Giới hạn đã biết (ghi rõ trong code comment + evidence)**: cache HTML keyed theo URL — nếu 2 tài khoản dùng chung 1 thiết bị, mở offline có thể thấy dữ liệu cũ của tài khoản trước. Chấp nhận cho MVP (PWA cá nhân). KHÔNG cố xử lý multi-account trong task này.

### 3.2. OfflineBanner component

- `src/components/shared/offline-banner.tsx` — `"use client"`:
  - State `isOffline` khởi tạo `typeof navigator !== "undefined" ? !navigator.onLine : false`
  - useEffect: lắng nghe `window.addEventListener("online"/"offline")`
  - Render khi offline: banner nhỏ sticky top, nền `--warning` soft (hoặc `bg-warning/10` + border), text-secondary, icon WifiOff (lucide), role="status" aria-live="polite"
  - Text: `Bạn đang offline — dữ liệu có thể chưa mới nhất.`
- Gắn vào 4 trang: dashboard, sets, sets/library, sets/[setId] — **server component trang render `<OfflineBanner />`** (component con client nhỏ — đúng pattern server-first).

### 3.3. Trang fallback

- `/offline` (đã làm ở W1): nếu offline + route không có cache → SW serve `/offline` (navigation fallback). W2 chỉ verify hoạt động, không sửa.

## 4. Verification gates (bắt buộc)

1. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
2. Unit: `offline-banner.test.tsx` (render khi offline, ẩn khi online, chuyển state khi event fire — jsdom mock `navigator.onLine` + dispatchEvent)
3. E2E `tests/e2e/pwa-offline.spec.ts`:
   - Login + import 1 bộ → vào `/dashboard` + `/sets` + `/sets/[setId]` (có mạng, để cache đầy)
   - `page.context().setOffline(true)` → reload `/dashboard` → **vẫn render** nội dung cũ + banner offline hiện
   - Reload `/sets/[setId]` → vẫn render bộ đã xem + banner
   - Vào 1 route CHƯA từng cache (vd `/collections`) khi offline → fallback `/offline` hiển thị
   - `setOffline(false)` → banner biến mất
4. Regression: `npm run test:e2e -- foundation primary-navigation dashboard`
5. `git diff --check` sạch

## 5. Files dự kiến

- `src/app/sw.ts` (sửa — thêm runtime cache navigation)
- `src/components/shared/offline-banner.tsx` (mới)
- `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/sets/page.tsx`, `src/app/(app)/sets/library/page.tsx`, `src/app/(app)/sets/[setId]/page.tsx` (gắn banner)
- `tests/unit/components/shared/offline-banner.test.tsx` (mới)
- `tests/e2e/pwa-offline.spec.ts` (mới)
- KHÔNG đụng: auth, Supabase schema, quiz/study/match/memory/runner/typing logic

## 6. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files), push status: NOT pushed
Trích code: runtime cache config (ngắn) + OfflineBanner
Verification:
- npm run check: lint X/Y, typecheck, unit N passed
- E2E pwa-offline: N/N PASS (kể cả setOffline luồng)
- Regression: foundation primary-navigation dashboard: N/N PASS
- git diff --check: PASS
Gemini review: APPROVE/REJECT kèm findings
Safety: migrations/DB NO · deps NO · env NO · AI NO · production NO
Ambiguities: <networkTimeoutSeconds; cách match route trong SW; cache key theo URL — giới hạn multi-account>
```

## 7. Lưu ý cho implementer

- Đọc W1 trước — task này mở rộng SW đã có.
- Cache HTML navigation: đảm bảo KHÔNG cache POST/mutation (chỉ `request.mode === "navigate"` và GET).
- Không cache các route động nhạy cảm khác ngoài 4 route được chỉ định (tránh lộ dữ liệu user khác qua cache chung — ghi rõ giới hạn).
- Playwright `context.setOffline(true)` hoạt động với SW — nếu flaky, kiểm tra SW đã activate trước khi set offline (waitForServiceWorker hoặc chờ `navigator.serviceWorker.ready`).
