# CapyStudy Task N5 — Flashcard Wheel (giao diện lật thẻ vòng cuộn dọc)

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `2069f4a` (đã push, main đồng bộ origin/main)
- `Agent tier`: DeepSeek Flash + Gemini (UI/UX — không review riêng; coordinator verify)
- `Commit message` (1 commit duy nhất): `feat: redesign study session as a flashcard wheel`
- `Push`: KHÔNG push — gửi evidence report

## 1. Yêu cầu (từ user, đã chốt)

> Ý tưởng giao diện Flashcard Wheel (áp dụng mobile + desktop):
>
> - Trang học flashcard hiển thị các thẻ theo **vòng cuộn dọc** giống giao diện chọn giờ trên điện thoại
> - Thẻ hiện tại nằm **giữa, lớn và rõ nhất**; thẻ trước/sau nằm phía trên và dưới, **nhỏ và mờ hơn**
> - **Vuốt lên** → thẻ tiếp theo; **vuốt xuống** → thẻ trước
> - **Chạm vào thẻ** → lật giữa câu hỏi và đáp án
> - Khi thả tay, thẻ **snap vào vị trí trung tâm**
> - Animation nhẹ, mượt, mobile-first, hiện đại, tối giản, tập trung vào nội dung
> - **Không cho phép horizontal overflow**; thao tác thuận tiện bằng một tay
> - Cảm giác lướt qua dòng thẻ liên tục, thay vì bấm nút "trước/tiếp theo"

## 2. Phạm vi task

1. `src/features/study/components/study-session.tsx` — **thay UI phiên học** bằng Flashcard Wheel (giữ nguyên data/props/server page)
2. Cập nhật unit test `study-session.test.tsx` + E2E `study-mode.spec.ts` theo UI mới
3. **KHÔNG làm:** đổi `src/app/(app)/study/session/page.tsx` (server), card data, shuffle, collection control, keyboard cơ bản (giữ Enter/Space lật), streak ghi nhận (Task N12), màn hoàn thành style (Task N6 — giữ màn hoàn thành hiện tại, chỉ đổi phần wheel)

## 3. Thiết kế chi tiết

### 3.1. Cấu trúc Wheel (mobile-first)

- **Container cuộn dọc:** `<div className="h-[calc(100dvh-...)] overflow-y-auto snap-y snap-mandatory [scrollbar-width:none]">` (ẩn scrollbar) — mỗi thẻ là 1 "snap item" chiếm ~70–80% chiều cao container, `snap-align: center`
- **Native scroll + momentum:** dùng CSS scroll-snap (không tự viết gesture) — iOS/Android có sẵn inertia + snap; desktop scroll chuột hoạt động tự nhiên; hỗ trợ `prefers-reduced-motion` (snap vẫn hoạt động, bỏ animation scale)
- **Active index:** tính từ scroll position (scroll event hoặc `IntersectionObserver` với rootMargin ±50%) — thẻ gần tâm container nhất là active; cập nhật `currentIndex` state (giữ state `currentIndex`/`isFlipped` hiện có để không phá logic hoàn thành + progress)
- **Hiệu ứng thẻ:** active → `scale-100 opacity-100`; thẻ khác → `scale-90 opacity-40` (transition 200–250ms); thẻ trên/dưới hiện mép để tạo cảm giác liên tục
- **Lật:** tap/chạm vào **thẻ đang active** → `isFlipped` (flip 3D giữ nguyên CSS hiện có `[perspective:1200px]` + `[transform:rotateY(180deg)]`); thẻ không active → scroll tới nó (snap) thay vì lật
- **Khi lật thẻ active rồi vuốt** → về mặt trước khi chuyển thẻ (set `isFlipped(false)` khi currentIndex đổi — giữ hành vi hiện tại)
- **Progress:** thanh tiến độ + "N / total" giữ nguyên (đặt trên cùng hoặc dưới — chọn gọn, không che thẻ)
- **Nút Hoàn thành:** khi ở thẻ cuối (`isLast`) hiện nút "Hoàn thành" (đặt dưới container hoặc trong thẻ cuối — chọn vị trí không vỡ snap; ưu tiên dưới container, cố định, `pb-safe`)
- **Không còn nút Trước/Sau** (bỏ ChevronLeft/ChevronRight); **bỏ luôn swipe ngang** hiện tại (chỉ còn cuộn dọc tự nhiên)
- **Desktop:** cùng wheel (đã chốt) — container cao ~70vh, thẻ rộng tối đa `max-w-2xl`, căn giữa; scroll chuột + click lật
- **Không horizontal overflow:** thẻ `w-full max-w-2xl mx-auto`, text `break-words whitespace-pre-wrap`; container chỉ cuộn dọc

### 3.2. Giữ nguyên (không đổi)

- Props: `cards, collections, membershipsByCard, truncated, seed, sessionHref, mascotLevel`
- `CardCollectionsControl` (thêm vào bộ đặc biệt) — đặt trên thẻ active
- `toggleShuffle` (Trộn thứ tự), khối "Bộ gốc" + `truncated` message, `SessionExitButton`
- Keyboard: Space/Enter lật; **ArrowUp/ArrowDown** → thẻ trước/sau (thay ArrowLeft/Right cho hợp wheel — giữ cả 4 nếu muốn)
- `isCompleted` flow + màn hoàn thành hiện tại (Task N6 sẽ đổi style — KHÔNG làm ở đây)

### 3.3. Tests

- Unit `study-session.test.tsx`: cập nhật theo UI mới — giữ test hành vi còn đúng (flip, hoàn thành, replay, shuffle, collection), bỏ/sửa test assert nút Trước/Sau (không còn), thêm test snap/scroll nếu khả thi (jsdom hạn chế scroll — ưu tiên test state logic: currentIndex thay đổi đúng, flip đúng)
- E2E `study-mode.spec.ts`: cập nhật — bỏ assert nút "Thẻ trước/tiếp theo", assert wheel (thẻ đầu hiển thị + lật + hoàn thành); giữ assert màn hoàn thành + replay + Quay lại
- `npm run check` exit 0

## 4. Verification gates (bắt buộc)

1. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
2. `npm run test:e2e -- study-mode` — pass
3. `git diff --check` sạch

## 5. Files dự kiến

- `src/features/study/components/study-session.tsx`
- `tests/unit/features/study/study-session.test.tsx`
- `tests/e2e/study-mode.spec.ts`
- KHÔNG đụng: server page, migration, data fetching, docs

## 6. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files, +X/−Y), push status: NOT pushed
Trích code: container wheel + active index tính (ngắn)
Verification: npm run check (lint/typecheck/unit/build), E2E study-mode N/N PASS, git diff --check
Safety: migrations/DB NO · deps/env/AI/production NO
Ambiguities: <nếu có>
```

## 7. Lưu ý

- Mobile-first: thao tác 1 tay, thumb vuốt dọc thoải mái; không horizontal overflow
- Scroll-snap native là ưu tiên (không viết gesture custom trừ khi scroll-snap không đáp ứng snap — ghi rõ lý do nếu phải custom)
- Giữ `data-testid="study-card"` nếu test/E2E đang dùng (hoặc cập nhật test)
- Đừng phá: flip 3D hiện tại, màn hoàn thành, collection control, shuffle, exit
