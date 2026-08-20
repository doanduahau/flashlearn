# CapyStudy Task N6 — Màn kết thúc theo style Capy runner (Lật thẻ + Memory + Match)

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `2069f4a` (đã push, main đồng bộ origin/main)
- `Agent tier`: DeepSeek Flash + Gemini (UI — không review riêng; coordinator verify)
- `Commit message` (1 commit duy nhất): `feat: align learning completion screens with runner style`
- `Push`: KHÔNG push — gửi evidence report

## 1. Yêu cầu (từ user, đã chốt)

> "kết thúc ở các chế độ ở học và chơi sửa lại theo style của chế độ Capy runner"

**Đã chốt phạm vi:** Lật thẻ (study), Memory matching (học), Match (kiểm tra). **Quiz result (trắc nghiệm) GIỮ NGUYÊN** (đã đồng bộ từ Task 8e/8f). Runner đã có style riêng — không đụng.

## 2. Style chuẩn (tham khảo `src/features/runner/components/runner-end-overlay.tsx`)

- Mascot lớn ~144px (`size-36`) `object-contain`, `aria-hidden`
- Heading `text-xl font-bold sm:text-2xl` ("Hoàn thành!")
- Dòng thông tin `text-sm text-text-secondary`
- Hàng nút `mt-2 flex flex-wrap justify-center gap-2`: **Chơi lại** (variant soft) + **BackButton** (`← Thoát`)
- Nền overlay `bg-surface/95` — với các mode không phải canvas, dùng **màn thay thế** (không overlay tuyệt đối) nhưng GIỮ nguyên style (mascot to, heading, stats, nút hàng ngang)

## 3. Chi tiết từng mode

### 3.1. Lật thẻ — `src/features/study/components/study-session.tsx` (khối `isCompleted`)

Hiện tại: MascotImage congrats 80px + "Hoàn thành!" + "Đã xem N thẻ" + 2 nút (Chơi lại primary / Quay lại outline).

Đổi thành (giữ handler `handleReplay` + `goBack`):

```tsx
<div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
  <MascotImage
    level={mascotLevel}
    state="congrats"
    size={144}
    className="size-36 object-contain"
    aria-hidden
  />
  <h2 className="text-xl font-bold sm:text-2xl">Hoàn thành!</h2>
  <p className="text-sm text-text-secondary">Đã xem {total} thẻ</p>
  <div className="mt-2 flex flex-wrap justify-center gap-2">
    <Button type="button" variant="soft" onClick={handleReplay}>
      Chơi lại
    </Button>
    <BackButton fallbackHref={studyModeHrefFromSession(sessionHref)} />
  </div>
</div>
```

- `aria-hidden` trên MascotImage: kiểm tra MascotImage có truyền `aria-hidden` xuống không (nếu component không nhận prop — dùng wrapper div aria-hidden hoặc bỏ, giữ alt="" như runner dùng `<img>`); mục tiêu: decorative
- BackButton đã import? study-session dùng `useBackWithFallback` + Button — thêm BackButton import (pattern runner-end-overlay)

### 3.2. Memory — `src/features/memory/components/memory-session.tsx` (khối done)

Xem khối done hiện tại → đổi cùng pattern: mascot `congrats` 144, heading, dòng thông tin (giữ nội dung hiện có, vd "Hoàn thành X/X thẻ"), nút Chơi lại (soft) + BackButton (fallback hiện có — giữ nguyên).

### 3.3. Match — `src/features/match/components/match-session.tsx` (khối done)

Tương tự: mascot `congrats` 144, heading "Hoàn thành N/N", dòng thông tin (thêm "· N cặp ghép đúng" nếu có sẵn dữ liệu — KHÔNG thêm query/logic mới, chỉ dùng state có sẵn nếu tiện), nút Chơi lại (soft) + BackButton (fallback hiện có).

### 3.4. KHÔNG làm

- Quiz result page (`src/app/(app)/quiz/[sessionId]/result/page.tsx`) — giữ nguyên
- Runner end overlay — giữ nguyên
- Logic hoàn thành / retry / coverage / lưu kết quả (match_attempts) — giữ nguyên

## 4. Verification gates (bắt buộc)

1. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
2. Unit: cập nhật test chạm màn hoàn thành (study-session.test.tsx, memory-session.test.tsx, match-session.test.tsx) nếu assert layout cũ
3. E2E: `npm run test:e2e -- study-mode memory match quiz-result-collections` — pass (quiz-result KHÔNG đổi → vẫn pass)
4. `git diff --check` sạch

## 5. Files dự kiến

- `src/features/study/components/study-session.tsx`
- `src/features/memory/components/memory-session.tsx`
- `src/features/match/components/match-session.tsx`
- Tests liên quan (unit + E2E nếu assert layout cũ)
- KHÔNG đụng: quiz result, runner, migration, server actions, docs

## 6. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files, +X/−Y), push status: NOT pushed
Trích code: khối done của 1 mode (ngắn)
Verification: npm run check (lint/typecheck/unit/build), E2E <specs> N/N PASS, git diff --check
Safety: migrations/DB NO · deps/env/AI/production NO
Ambiguities: <nếu có>
```

## 7. Lưu ý

- Đồng nhất 3 mode: mascot 144 + heading + stats line + Chơi lại (soft) + BackButton
- Mascot decorative (alt=""/aria-hidden) — không phải nội dung
- Không đổi logic hoàn thành (retry save match vẫn hoạt động — match-session có nhánh `matchSaveError` "Thử lại lưu kết quả": giữ nó hiển thị trong màn hoàn thành mới)
