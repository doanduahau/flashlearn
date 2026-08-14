# CapyStudy — Task 2: phân bổ mascot 7 trạng thái app-wide

> **Status:** verified — commit `b22d218` (đã push)
> **Baseline commit:** commit của Task 1 (brand color + logo) trên `main` — hoặc mới nhất nếu có task khác merged (lấy commit mới nhất trên main)
> **Agent tier:** Codex + GPT-5.6 Terra — **không cần review riêng** (thuần UI, không chạm DB/security; module mascot đã tồn tại và verified)
> **Decisions locked (user):**
>
> - Dùng **đủ 7 trạng thái mascot** (`normal`, `happy`, `sad`, `congrats`, `run`, `thinking`, `point-right`) — mascot là thương hiệu nền tảng, xuất hiện rộng khắp UI đã đăng nhập.
> - **Quiz result:** điểm ≥ 60% → `happy`; < 60% → `sad`.
> - **Match/Memory:** chỉ thêm mascot ở **màn hoàn thành** (`congrats`); KHÔNG thêm feedback trong lúc chơi (game đã có hiệu ứng riêng).
> - Mascot level: ưu tiên dùng level tính từ streak hiện tại khi có sẵn dữ liệu (`levelFromStreak`); các nơi không có streak (error/not-found) dùng `level={1}`.
> - KHÔNG nhét mascot vào nội dung flashcard/quiz đáp án (tránh nhiễu học tập).
>   **Ngoài phạm vi:** Task 1 (màu/logo/memory tile) — task riêng, giao trước; module `src/features/mascot/` — KHÔNG sửa logic (chỉ import `<MascotImage>`); DB/migration/RPC — KHÔNG; hành vi Runner game — KHÔNG.

---

## 0. Before starting

Baseline = commit Task 1 trên `main` (or strictly newer). Chạy `git status` / `git log -5` / `git pull --ff-only`.

Đọc trước:

- `src/features/mascot/components/mascot-image.tsx` — component dùng chung: `<MascotImage level state size className loading />`, alt="" + aria-hidden (decorative — thông tin luôn có text kèm).
- `src/features/mascot/utils/mascot-level.ts` — `levelFromStreak(streak)` (0–29 → 1, 30–59 → 2, 60–119 → 3, 120–239 → 4, 240+ → 5).
- `src/features/mascot/server/load-mascot-level.ts` — loader server (dùng khi cần level từ DB; tái sử dụng pattern hiện có).
- Các chỗ mascot ĐÃ có (giữ nguyên, không phá): `dashboard-motivation-bar.tsx` (happy/point-right), `streak-milestone-banner.tsx` (congrats), `statistics-panel.tsx` (normal heading + thinking empty), `sets-list.tsx` (thinking empty), `collections-list.tsx` (thinking empty), `quiz/page.tsx` QuizHistory empty (thinking), Runner (`run`/`happy`/`sad`/`congrats`/`sad` end).
- `src/components/layout/app-shell.tsx` + `app-chrome.tsx` — shell (Task 1 đã đổi logo thành `<img>`; Task 2 thêm mascot cạnh logo).
- `src/app/(app)/quiz/[sessionId]/result/page.tsx` — result page (đã có `streakSummary` + `percentage`).
- `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/auth/error/page.tsx` — error states.
- `src/features/imports/components/*.tsx` — import flow (các state: chưa có gì / đang xử lý / thành công).
- `src/features/study/components/study-source-select.tsx` — study setup (empty state dòng ~146).
- `src/features/match/components/match-session.tsx`, `src/features/memory/components/memory-session.tsx` — màn hoàn thành (done state).

Nếu repo mâu thuẫn với rules dưới → **STOP và hỏi**. Không tự quyết.

## 1. Scope

Thêm `<MascotImage>` vào các vị trí theo bảng phân bổ bên dưới. **Chỉ thêm phần tử UI — không sửa logic trang, không đổi text/hành vi hiện có.**

### 1.1 App shell — mascot cạnh logo (XUẤT HIỆN Ở MỌI TRANG đã đăng nhập)

`src/components/layout/app-chrome.tsx`: thêm mascot nhỏ cạnh logo CapyStudy (cạnh `<img>` logo Task 1) ở **cả 2 chỗ** (sidebar desktop + header mobile):

- Trạng thái: `normal`.
- Level: truyền từ server. `AppShell` (server component) nhận `streak` prop từ `(app)/layout.tsx` (`loadStreakSummary`) — **không thêm query mới**, tính `levelFromStreak(streak)` trong AppShell rồi truyền `mascotLevel` xuống `AppChrome` (thêm prop). Nếu layout không truyền streak được ở nơi cần, dùng `loadMascotLevel(supabase)` pattern của dashboard — nhưng ưu tiên tái dùng streak đã có.
- Kích thước nhỏ, không lấn logo: `size-7`/`size-8` (`className="size-7 object-contain"`), đứng cạnh logo hoặc thay thế vị trí icon hiện có — giữ layout gọn (kiểm tra mobile không vỡ header).
- `loading="eager"` (logo area là nơi hiển thị ngay).

### 1.2 Quiz result — happy/sad theo điểm

`src/app/(app)/quiz/[sessionId]/result/page.tsx`: thêm mascot ở vùng đầu kết quả (cạnh "Kết quả kiểm tra" hoặc cạnh dòng `X/Y đúng (Z%)`):

- `percentage >= 60` → `happy`; ngược lại → `sad`.
- Level: `levelFromStreak(streakSummary?.currentStreak ?? 0)` (đã có streakSummary trong page).
- Kích thước `size-16`–`size-20`, không đè lên nội dung.

### 1.3 Error states — sad

- `src/app/error.tsx` (global error): thêm mascot `sad` level 1 (size ~24) phía trên tiêu đề "Có lỗi xảy ra".
- `src/app/not-found.tsx`: thêm mascot `sad` level 1 cạnh "404" hoặc phía trên (size ~24).
- `src/app/auth/error/page.tsx`: thêm mascot `sad` level 1 (nếu trang có chỗ phù hợp — kiểm tra layout; Task 1 đã đổi logo ở trang này).

### 1.4 Import — thinking (đang xử lý) + happy (thành công)

Điều tra `src/features/imports/components/` (document-import, unified-draft-editor, google-sheets-import, paste-import) và thêm:

- **Empty state** (màn import chưa có gì): mascot `thinking` level 1 nhỏ (nếu chưa có empty state rõ ràng — kiểm tra; nếu import luôn hiện form thì bỏ qua).
- **Đang xử lý** (parsing/uploading, có state pending): mascot `thinking` (hoặc `run` nếu có chỗ hiển thị "đang xử lý" nổi bật) — chọn nơi có UI pending rõ ràng, không làm chậm flow.
- **Thành công** (sau khi import xong, state success/confirmation): mascot `happy` nhỏ.

⚠️ Chỉ thêm khi có state UI tương ứng tồn tại — **không tạo state mới, không thêm logic xử lý**. Nếu flow import không có màn thành công riêng (tự chuyển trang), chỉ thêm ở empty/pending và ghi rõ trong report.

### 1.5 Study setup — point-right trỏ nút Bắt đầu

`src/features/study/components/study-source-select.tsx`:

- Empty state (dòng ~146 "Chưa có thẻ flashcard để học."): đổi/chèn mascot `thinking` level 1 (nếu chưa có).
- Nếu có nút "Bắt đầu"/CTA rõ ràng và chỗ trống phù hợp: mascot `point-right` nhỏ trỏ về phía CTA. Nếu layout chật, chỉ thêm ở empty state.

### 1.6 Match/Memory — màn hoàn thành congrats

- `src/features/match/components/match-session.tsx` (done state "Hoàn thành X/X"): thêm mascot `congrats` cạnh tiêu đề (size ~16).
- `src/features/memory/components/memory-session.tsx` (done state "Hoàn thành X/X"): thêm mascot `congrats` cạnh tiêu đề (size ~16).
- Level: `levelFromStreak` nếu streak có sẵn ở component đó; nếu không, dùng `level={1}` (kiểm tra — match/memory session không load streak → dùng level 1, hoặc truyền qua prop nếu session page có; ưu tiên đơn giản).

### 1.7 (Kiểm tra) Những nơi còn thiếu empty state

Quét các trang đã đăng nhập còn lại (`/sets`, `/collections`, `/history`, `/statistics`, `/import`, `/study`, `/quiz`, smart-review/new-cards nếu có UI riêng) — nếu còn empty state "chưa có gì" chưa có mascot `thinking` → thêm (level 1 hoặc level từ streak nếu có sẵn). Không thêm mascot vào bảng/lưới/danh sách có dữ liệu.

## 2. Ràng buộc chung

- `<MascotImage>` luôn `alt=""` + `aria-hidden` (component đã tự set — không override).
- Thông tin quan trọng luôn có text kèm — mascot chỉ trang trí.
- Không thay đổi văn bản/hành vi/href hiện có của bất kỳ trang nào.
- Không thêm query DB mới — tái dùng dữ liệu đã có (streak/level) hoặc dùng level 1.
- Kích thước: nhỏ ở shell/error (24–32px), vừa ở empty state (48px), lớn ở result/hoàn thành (64–80px) — theo convention các chỗ mascot hiện có.
- Không đổi module `src/features/mascot/` (trừ khi phát hiện bug thật — lúc đó STOP hỏi).

## 3. Verification

- `npx vitest run tests/unit/features/mascot tests/unit/features/dashboard tests/unit/features/match tests/unit/features/memory` + mọi test component liên quan trang đã sửa (import/study/quiz nếu có).
- `npm run check` — PASS (lint 0 error, unit toàn bộ pass, build pass).
- E2E liên quan: `npm run test:e2e -- foundation dashboard study runner-setup` (nếu suite có) — xác nhận không vỡ layout shell/header mobile.
- Kiểm tra thủ công qua test/E2E: shell mobile header không vỡ (mascot + logo + streak + user cùng hàng), quiz result hiển thị đúng happy/sad theo điểm.

## 4. Diff review

- Không migration/DB/deps/env/AI.
- Không sửa logic module mascot, không sửa text/hành vi trang.
- Không thêm query DB mới.
- Không nhét mascot vào nội dung học (flashcard/đáp án).
- Worktree sạch ngoài file task.

## 5. Commit

```bash
git add <task-related-files>
git commit -m "feat: spread capystudy mascot across app ui"
```

Push lên `origin/main` (thuần UI — push sau khi gate pass).

## 6. Evidence report

Theo format chuẩn: Repository, Bảng phân bổ (7 trạng thái × nơi xuất hiện — kèm file:line), Level dùng ở từng nơi, Các nơi đã có mascot giữ nguyên, Tests (files/counts/kết quả), Files changed, Safety, Ambiguities (nếu có), Verdict (`EVIDENCE READY FOR REVIEW` hoặc `INCOMPLETE — BLOCKER REQUIRES USER DECISION`).
