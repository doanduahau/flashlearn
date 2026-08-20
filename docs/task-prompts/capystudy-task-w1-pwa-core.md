# CapyStudy Task W1 — PWA core: cài đặt được (manifest + service worker + icon)

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `684361a` (đã push, main đồng bộ origin/main)
- `Agent tier`: DeepSeek Flash (implementer) + Gemini (independent review — bắt buộc vì thêm dependency mới)
- `Commit message`: `feat: make CapyStudy installable as a PWA`
- `Push`: KHÔNG push — gửi evidence report; chỉ push sau khi coordinator verify + user duyệt

## 1. Yêu cầu (từ user)

> "phase tiếp theo: Mobile PWA → offline/notifications"

Đã chốt với user:

- Dùng **@serwist/next** (thư viện kế thừa next-pwa, duy trì tích cực)
- Tên app PWA hiển thị: **CapyStudy**
- Nền tảng: **Android + iOS** (cài lên màn hình chính; iOS 16.4+ cho push — push ở Task W3/W4)
- Task này CHỈ làm phần **installable** (P1): manifest + icons + SW registration + offline shell cơ bản. KHÔNG làm data cache (W2), KHÔNG làm notifications (W3/W4).

## 2. Phạm vi task

1. Cài dependency: `@serwist/next`, `@serwist/core`, `@serwist/sw` (bản mới nhất tương thích Next 16 — **verify thực tế trước khi chốt bản**, xem mục 7)
2. Cấu hình Serwist (next.config.ts + worker file) → build sinh ra `public/sw.js` + precache asset tĩnh (JS/CSS/font/icon/mascot png)
3. `src/app/manifest.ts` (metadata route của Next 16): tên "CapyStudy", màu theo design token, icon 192/512 + maskable
4. Icon: sinh từ `public/mascot/logo.png` → `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180×180)
5. iOS meta: `apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`
6. Đăng ký service worker client-side (component nhỏ hoặc trong layout)
7. Trang offline fallback đơn giản (shell) — đủ cho W2 phát triển tiếp
8. E2E: manifest đúng, SW registered, đạt tiêu chí installable (Playwright)

KHÔNG làm: navigation/data caching (W2), push (W3/W4), thay đổi auth/RSC logic.

## 3. Thiết kế chi tiết

### 3.1. Cài đặt + verify Serwist × Next 16

- Next.js 16.3.0, App Router, Turbopack là default bundler.
- **Đã xác minh qua tài liệu**: Serwist 9 hỗ trợ Turbopack ở mức _experimental_ (github serwist/serwist#54) — triển khai xong phải chạy `npm run build` và xác nhận file `public/sw.js` (hoặc path Serwist cấu hình) được sinh ra + `npx next start` serve được.
- Nếu Turbopack build lỗi do Serwist: thử build với `--webpack` (ghi rõ trong evidence). Nếu cả 2 lỗi → **fallback được phép**: viết SW tay `public/sw.js` (precache danh sách asset hash từ build) + đăng ký thủ công — NHƯNG phải báo coordinator trước khi đổi hướng.
- Cấu hình tham khảo (Serwist 9):
  - `next.config.ts`: wrap với `withSerwist({ swSrc: "src/app/sw.ts", swDest: "public/sw.js", ... })`
  - `src/app/sw.ts`: `import { defaultCache } from "@serwist/next/worker"; import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"; ...` (precache mặc định `self.__SW_MANIFEST`; globIgnores cho `**/api/**` nếu cần)
  - Register: component `"use client"` dùng `import { registerSW } from "virtual:pwa-register"`? — KHÔNG, với Serwist dùng `serwist/next` register hoặc tự `navigator.serviceWorker.register("/sw.js")` — chọn cách Serwist khuyến nghị, ghi rõ.
- Không cần bật ở dev (Serwist mặc định disable dev — giữ vậy).

### 3.2. manifest.ts

```ts
// src/app/manifest.ts
import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CapyStudy",
    short_name: "CapyStudy",
    description: "Tạo bộ flashcard từ tài liệu của riêng bạn. Vừa học vừa chơi cùng CapyStudy.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fbf7",
    theme_color: "#7bcfa6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
```

- Màu lấy từ design token (AGENTS.md §11.2): background `#f8fbf7`, primary `#7bcfa6` — không hardcode khác.

### 3.3. Icon

- `public/mascot/logo.png` hiện có (1254×1254) — dùng làm nguồn.
- Sinh 4 file vào `public/icons/` bằng script node (dùng `@napi-rs/canvas` — ĐÃ có trong dependencies, không cài thêm): resize + `icon-maskable-512` có padding an toàn (~80% nội dung ở giữa, nền `#f8fbf7` hoặc màu phù hợp).
- Script đặt trong `scripts/generate-pwa-icons.mjs`, thêm npm script `icons` (hoặc chạy 1 lần rồi commit file PNG — chọn cách nào ghi rõ; nếu commit PNG thì script vẫn lưu để tái sinh).

### 3.4. iOS meta (layout.tsx metadata)

- `appleWebApp: { capable: true, statusBarStyle: "default", title: "CapyStudy" }` (Next Metadata API)
- `icons: { apple: "/icons/apple-touch-icon.png" }`

### 3.5. Offline shell fallback (tối thiểu)

- Trang `/offline` đơn giản (server component, không cần auth): mascot thinking level 1 size 64 + text "Bạn đang offline" + nút về trang chủ. Dùng BackButton pattern nếu phù hợp.
- Serwist: navigation fallback trỏ tới `/offline` (nếu Serwist config hỗ trợ) — nếu phức tạp, chỉ precache `/offline` như 1 entry và ghi rõ cách hoạt động. Không bắt buộc chặn mọi navigation ở task này (W2 làm data caching).

## 4. Verification gates (bắt buộc)

1. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK — **xác nhận build sinh ra sw.js**
2. E2E mới `tests/e2e/pwa-installable.spec.ts`:
   - `/manifest.webmanifest` trả 200 + JSON đúng name/start_url/icons
   - `navigator.serviceWorker` registered (evaluate trong page sau khi load, chờ activation)
   - File `sw.js` serve được (request tới `/sw.js` trả 200)
   - `public/icons/icon-512.png` + `icon-maskable-512.png` tồn tại (request 200, content-type image/png)
   - (nếu Playwright hỗ trợ) kiểm tra manifest `display: standalone`
3. `git diff --check` sạch
4. Test cũ KHÔNG regression: `npm run test:e2e -- foundation primary-navigation`

## 5. Files dự kiến

- `package.json` (+@serwist/next, @serwist/core, @serwist/sw — giải thích lý do cài trong evidence)
- `next.config.ts` (wrap withSerwist)
- `src/app/sw.ts` (mới — worker source)
- `src/app/manifest.ts` (mới)
- `src/app/(marketing)/layout.tsx` hoặc root `src/app/layout.tsx` (metadata apple + register SW component)
- `src/app/offline/page.tsx` (mới)
- `src/components/shared/register-sw.tsx` (mới — "use client", đăng ký SW)
- `public/icons/*.png` (mới — 4 file)
- `scripts/generate-pwa-icons.mjs` (mới)
- `tests/e2e/pwa-installable.spec.ts` (mới)
- KHÔNG đụng: auth, quiz/study/match/memory/runner/typing logic, Supabase schema, migration

## 6. Evidence report template

```text
Repository: start 684361a → final <hash> (1 commit, N files), push status: NOT pushed
Dependencies: +@serwist/next@<ver>, +@serwist/core, +@serwist/sw — lý do: <...>
Verification:
- npm run build: OK, sw.js sinh tại <path> (xác nhận file tồn tại)
- npm run check: lint X errors / Y warnings, typecheck, unit N passed
- E2E pwa-installable: N/N PASS; regression foundation primary-navigation: N/N PASS
- git diff --check: PASS
Gemini review: APPROVE/REJECT kèm findings — BẮT BUỘC (task thêm dependency)
Safety: migrations/DB NO · deps YES (+3 serwist) · env NO · AI NO · production NO
Ambiguities: <Turbopack build có cần --webpack không; cách register SW; fallback SW tay nếu dùng>
```

## 7. Lưu ý cho implementer

- Đọc `AGENTS.md` §5 (công nghệ chuẩn) + §23 (quy tắc agent). Dự án không khóa cứng version — cài bản Serwist mới nhất tương thích Next 16, ghi version thực tế trong evidence.
- KHÔNG commit `.env.local`; không đổi package manager.
- Serwist + Turbopack là experimental — test build sớm (mục 3.1), nếu lỗi báo coordinator trước khi đổi hướng.
- Mascot asset đã có sẵn (`public/mascot/level-1/thinking.png` 1254×1254) — dùng cho trang offline qua MascotImage component (level={1} state="thinking" size 64 — theo quy ước Task 8d).
- Nếu `virtual:pwa-register` không dùng được với Serwist, tự `navigator.serviceWorker.register("/sw.js")` trong useEffect (guard: chỉ register khi production + `"serviceWorker" in navigator`), ghi rõ quyết định.
