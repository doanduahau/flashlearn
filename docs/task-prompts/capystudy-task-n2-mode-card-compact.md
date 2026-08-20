# CapyStudy Task N2 — Card chọn chế độ gọn 120px (mobile) ở /study/mode + /quiz/mode

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `2069f4a` (đã push, main đồng bộ origin/main)
- `Agent tier`: DeepSeek Flash + Gemini (UI — không review riêng; coordinator verify)
- `Commit message` (1 commit duy nhất): `feat: compact mode selection cards on mobile`
- `Push`: KHÔNG push — gửi evidence report

## 1. Yêu cầu (từ user)

> "trong /study/mode và /quiz/mode các thẻ lựa chọn chế độ đang có chiều cao là 180px -> giảm xuống 120px (ở mobile), mascot ở hết phần bên trái (30%)(mascot 96x96), co nút bắt đầu sang bên phải nhường chỗ cho mascot"

Mục tiêu: trên mobile, mỗi card chọn chế độ:

- **Chiều cao ~120px** (không còn ~180px)
- **Mascot chiếm 30% bên trái** (kích thước 96×96)
- **Nút "Bắt đầu" nằm bên phải** (căn giữa theo chiều dọc), không nằm dưới mascot

## 2. Phạm vi task

1. `src/features/study/components/study-mode-select.tsx` — 3 card (Lật thẻ, Memory matching, Capy runner)
2. `src/features/quiz/components/quiz-mode-select.tsx` — 2 card (Trắc nghiệm, Match) — hiện tại + tương lai sẽ có thêm card Nhập đáp án (Task N8/N10 — KHÔNG làm ở task này)
3. **KHÔNG làm:** logic availability/expand (chọn số câu/độ khó), runner/memory/quiz sessions, BackButton, thay đổi nội dung mô tả

## 3. Thiết kế chi tiết

### 3.1. Layout card mới (mobile-first, áp dụng cho cả 2 file)

Cấu trúc card (thay cho `article` hiện tại — giữ nguyên class nền/border/shadow):

```tsx
<article className="flex items-center gap-2 rounded-2xl border border-border-soft bg-surface p-2 shadow-soft h-[120px]">
  {/* Mascot 30% bên trái */}
  <div className="flex h-full w-[30%] shrink-0 items-center justify-center">
    <MascotImage level={mascotLevel} state="..." size={96} className="size-24 object-contain" />
  </div>
  {/* Giữa: title + desc + count */}
  <div className="min-w-0 flex-1">
    <h2 className="text-base font-bold">...</h2>
    <p className="text-sm text-text-secondary">...</p>
    <p className="text-sm font-medium">{count} thẻ</p>
  </div>
  {/* Phải: nút Bắt đầu */}
  <div className="flex shrink-0 items-center">
    <button ...>Bắt đầu</button>
  </div>
</article>
```

Chi tiết:

- **Chiều cao 120px trên mobile** (`h-[120px]`); trên `sm:` trở lên có thể thả lỏng (vd `sm:h-auto sm:min-h-[120px]` hoặc giữ 120px — chọn hợp lý, không vỡ nội dung)
- Mascot: `w-[30%]` vùng chứa, mascot `size-24` (96×96) `object-contain` — nếu mascot rộng hơn 30% bị cắt → giảm `size` xuống vừa vùng (ưu tiên không vỡ layout, mascot to nhất có thể trong 30%)
- Nút "Bắt đầu": nằm bên phải, căn giữa dọc; giữ class `PRIMARY_ACTION`/`PRIMARY_BTN` (min-h-12 ...) nhưng thu gọn padding ngang nếu cần (`px-4` thay `px-6`) để vừa card
- Count "X thẻ" giữ ở vùng giữa (hoặc cạnh nút — chọn 1, nhất quán 2 file)
- **Trạng thái mở rộng (chọn số câu/độ khó):** khi user nhấn "Bắt đầu" ở Memory/Runner/Match/Quiz → hiện các lựa chọn (số câu, độ khó). Giữ cơ chế expand hiện có: `selectedMode === "memory"` / `quizExpanded` — nhưng phần mở rộng phải **không phá chiều cao 120px card gốc**. Đề xuất: khi expand, card có thể cao hơn (phần chọn số câu hiện xuống dưới, `h-auto` thay `h-[120px]`) — giữ nguyên logic + aria-label + `data-*` nếu có
- Không đổi `aria-label` trên nút (vd "Bắt đầu Memory") — E2E đang dùng

### 3.2. Lưu ý quiz-mode-select

- Card Match hiện dùng mascot `size-64` (64px) — đổi lên 96 như Trắc nghiệm cho đồng nhất 2 file (đúng yêu cầu "mascot 96x96")
- Card Trắc nghiệm đã `size-96` — giữ

### 3.3. Tests

- Unit: cập nhật test component nếu assert layout cũ (vd `study-mode-select.test.tsx`, `quiz-mode-select` nếu có)
- E2E: các spec chạm /study/mode + /quiz/mode (learning-mode-setup, study-mode, quiz-advancement...) — pass; KHÔNG assert chiều cao chính xác (dễ flake), chỉ assert nút + aria-label vẫn hoạt động

## 4. Verification gates (bắt buộc)

1. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
2. E2E liên quan (`npm run test:e2e -- learning-mode-setup study-mode quiz-advancement`) — pass
3. `git diff --check` sạch

## 5. Files dự kiến

- `src/features/study/components/study-mode-select.tsx`
- `src/features/quiz/components/quiz-mode-select.tsx`
- Tests liên quan (nếu assert layout cũ)
- KHÔNG đụng: migration, server actions, session components, docs

## 6. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files, +X/−Y), push status: NOT pushed
Trích code: cấu trúc card mới (ngắn)
Verification: npm run check (lint/typecheck/unit/build), E2E <specs> N/N PASS, git diff --check
Safety: migrations/DB NO · deps/env/AI/production NO
Ambiguities: <nếu có>
```

## 7. Lưu ý

- Mobile-first: card 120px là ưu tiên; desktop giữ đọc thoải mái (không bắt buộc 120px)
- Giữ nguyên toàn bộ hành vi (disabled khi thiếu thẻ + thông báo "Cần tối thiểu N thẻ", expand chọn số câu, độ khó runner, error runner)
- Không đổi copy mô tả đã chốt (Task 8a): "thẻ truyền thống", "Ghi nhớ vị trí và nội dung thẻ", "Chướng ngại vật hay là đáp án", "Chọn đáp án đúng", "ghép 2 thẻ phù hợp"
