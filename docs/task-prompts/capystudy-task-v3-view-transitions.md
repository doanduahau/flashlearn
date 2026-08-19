# CapyStudy Task V3 — View Transitions cho điều hướng

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `27b6f60` (đã push; KHÔNG phụ thuộc V1/V2 — làm sau cùng để tránh đụng file layout)
- `Agent tier`: Gemini (implementer) — không chạm DB
- `Commit message`: `feat: animate route navigation with view transitions`
- `Push`: KHÔNG push — gửi evidence report; chỉ push sau khi coordinator verify + user duyệt

## 1. Yêu cầu (từ user)

> "Tối ưu trải nghiệm mượt mà khi chuyển qua lại các trang."

## 2. Xác nhận kỹ thuật (đã verify — KHÔNG cần cấu hình next.config)

- **Next.js 16.3.0 + React 19**: View Transitions hoạt động trong App Router **không cần cấu hình**. React cung cấp component `<ViewTransition>` (import từ `react`), navigation của App Router là Transitions nên animation tự kích hoạt.
- Nguồn: https://nextjs.org/docs/app/guides/view-transitions (cập nhật 08/2026)
- Trình duyệt thiếu hỗ trợ (Safari cũ, Firefox cũ) → app hoạt động bình thường, chỉ không có animation (degrade an toàn)
- ⚠️ AGENTS.md §11.6: phải tôn trọng `prefers-reduced-motion` — tắt animation khi user bật reduced motion

## 3. Phạm vi task

1. **Directional navigation** (chính): slide nhẹ khi chuyển trang (forward/back) áp dụng cho nội dung chính của app (`(app)` layout) — dùng CSS `::view-transition-old/new(root)` với class, hoặc `<ViewTransition name=...>` nếu phù hợp
2. **Shared element morph** (tùy chọn, nếu đơn giản): morph mascot/logo header khi chuyển trang (header là layout — đã bền vững, có thể không cần); morph thẻ bộ flashcard từ `/sets/library` → `/sets/[setId]` (thẻ danh sách → header chi tiết bộ) — **chỉ làm nếu giữ được đúng 2 phía (danh sách + chi tiết) với cùng `name`**
3. **Crossfade loading → content** (nhẹ): skeleton (V2) → nội dung thật crossfade khi dữ liệu về (dùng `<ViewTransition>` quanh Suspense fallback + content theo guide)
4. Giữ nguyên: accessibility (focus, aria), reduced-motion, E2E không đổi selector

KHÔNG làm: animation phức tạp từng trang, parallax, chuyển động liên tục; KHÔNG đụng logic server/DB

## 4. Thiết kế chi tiết

### 4.1. Directional slide (forward/back)

- Cách tiếp cận tối giản: CSS `::view-transition-group(root)` / `::view-transition-old(root)` / `::view-transition-new(root)` trong `globals.css`:
  - forward: new slide-in từ phải, old slide-out trái
  - back: đảo ngược
  - Duration 200–250ms (AGENTS §11.6: 150–250ms phổ biến)
- ⚠️ Directional (phân biệt forward/back) cần `transition-type` hoặc `view-transition-class` — React hỗ trợ (docs: "transition types and view-transition-class, Chromium 125+, recent Safari/Firefox"). Nếu phức tạp → fallback crossfade đơn giản (không phân biệt hướng), vẫn đạt mục tiêu "mượt"
- `prefers-reduced-motion`: `@media (prefers-reduced-motion: reduce) { ::view-transition-old(root), ::view-transition-new(root) { animation: none; } }`

### 4.2. Shared element morph (tùy chọn)

- `/sets/library` card danh sách bộ: `<ViewTransition name={`set-${id}`}>` quanh card
- `/sets/[setId]` header chi tiết bộ: `<ViewTransition name={`set-${id}`}>` quanh tiêu đề
- `default="none"` + `share="morph"` nếu dùng morph (theo guide — đọc kỹ trước khi áp dụng)
- Nếu không ổn định (E2E flaky / layout nhảy) → BỎ morph, giữ directional/crossfade

### 4.3. Crossfade loading → content

- Nếu V2 đã có skeleton: wrap fallback + content trong `<ViewTransition>` theo pattern guide ("Animate loading states with Suspense reveals")
- Nếu gây phức tạp → bỏ qua, chỉ giữ 4.1

## 5. Verification gates (bắt buộc)

1. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
2. E2E: `npm run test:e2e -- foundation primary-navigation mobile-first-ui study-mode quiz-advancement` — KHÔNG được đổi selector/assert cũ; nếu animation làm click chậm, dùng `page.waitForTimeout` hoặc đợi transition kết thúc trong test helper (KHÔNG sửa assert sai)
3. Manual (báo evidence): điều hướng giữa dashboard ↔ sets ↔ study/quiz trên Chrome thấy slide/crossfade; bật `prefers-reduced-motion` (DevTools) → không animation; Safari không animation nhưng mọi thứ hoạt động
4. `git diff --check` sạch

## 6. Files dự kiến

- `src/app/globals.css` (view-transition CSS + reduced-motion guard)
- `src/app/(app)/layout.tsx` hoặc `src/components/layout/app-chrome.tsx` (bọc nội dung — tùy pattern)
- `src/app/(app)/sets/library/page.tsx` + `src/app/(app)/sets/[setId]/page.tsx` (morph — tùy chọn)
- Suspense boundary nơi cần crossfade (nếu làm 4.3)
- KHÔNG đụng: DB, server actions, quiz/study/match/memory/runner logic

## 7. Lưu ý cho implementer

- Đọc trước guide: https://nextjs.org/docs/app/guides/view-transitions — 4 pattern, làm đúng theo đó
- View transitions dùng chung 1 root — nếu 2 animation cùng chạy (morph + directional) kiểm tra không xung đột; đơn giản nhất: chỉ 1 loại
- E2E Playwright: transition chạy ~250ms — nếu test click nhanh bị miss, thêm `await page.waitForTimeout(300)` hoặc `expect.poll` — GHI RÕ trong evidence
- KHÔNG dùng library ngoài (framer-motion) — ViewTransition của React là đủ
- KHÔNG cấu hình next.config — feature hoạt động sẵn

## 8. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files), push status: NOT pushed
Trích code: CSS view-transition (ngắn) + nơi bọc ViewTransition
Verification:
- npm run check: lint X/Y, typecheck, unit N passed, build OK
- E2E regression: foundation primary-navigation mobile-first-ui study-mode quiz-advancement: N/N PASS
- Manual: Chrome slide ✓, reduced-motion ✓, Safari degrade ✓
- git diff --check: PASS
Safety: migrations/DB NO · deps NO · env NO · AI NO · production NO
Ambiguities: <directional vs crossfade; morph giữ hay bỏ; thời gian transition>
```
