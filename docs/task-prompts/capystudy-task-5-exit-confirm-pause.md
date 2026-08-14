# CapyStudy — Task 5: nút thoát + xác nhận thoát + pause khi tab ẩn (Quiz/Match/Memory)

> **Status:** delivered (2026-08-14)
> **Baseline commit:** commit mới nhất trên main (sau Task 3/4 nếu đã merged)
> **Agent tier:** Codex + GPT-5.6 Terra — **không cần review riêng** (thuần client UI/state; KHÔNG chạm DB/security — không persist state rời trang, chỉ pause tab ẩn)
> **Decisions locked (user):**
>
> - **Mọi trang trong các chế độ** (Study lật thẻ, Quiz, Match, Memory, Runner) đều có **nút thoát ở góc trên bên trái** (`←`).
> - Khi nhấn thoát → **thông báo xác nhận** (dialog) trước khi rời: "Bạn có chắc muốn thoát? Tiến trình hiện tại sẽ bị mất." (hoặc tương tự, theo style dialog của dự án) — nút Xác nhận / Hủy.
> - **Khi chuyển tab / app về nền → pause; quay lại → resume** (giống Runner đã làm): áp dụng cho **Quiz, Match, Memory** (Study lật thẻ và Runner kiểm tra — Runner đã có; Study lật thẻ là xem thẻ, không có timer → không cần pause, nhưng nút thoát vẫn cần).
> - Không persist trạng thái khi rời hẳn trang (chỉ pause tab ẩn) — đã chốt ở phần "giữ state" (phương án tab ẩn/hiện).
>   **Ngoài phạm vi:** các task redesign khác (Task 1–4, 6) — KHÔNG sửa luồng/setup, chỉ thêm thoát + pause.

---

## 0. Trước khi bắt đầu

```bash
git status
git log -8 --oneline
git pull --ff-only
```

Đọc trước:

- `src/features/runner/components/runner-session.tsx` — **pattern pause/resume đã có** (visibilitychange → PAUSE/RESUME, overlay "Tạm dừng") — THAM KHẢO CHÍNH
- `src/features/quiz/components/quiz-session.tsx` — luồng quiz hiện tại (có timer? có thoát?)
- `src/features/match/components/match-session.tsx` + `src/features/match/components/match-board.tsx` — hiện không có pause/thoát
- `src/features/memory/components/memory-session.tsx` — hiện không có pause/thoát
- `src/features/study/components/study-session.tsx` — đã có nút thoát (LogOut, không xác nhận) + nút "← Chọn phạm vi học"
- `src/components/ui/dialog.tsx` hoặc AlertDialog — pattern dialog của dự án (dùng shadcn/ui)
- `src/features/quiz/utils/*` — state quiz (có thời gian trả lời/answered_at — pause có ảnh hưởng gì không)

---

## 1. Nút thoát + xác nhận thoát

### 1.1 Vị trí

Góc trên bên trái của màn hình session, nút `←` (icon ChevronLeft/ArrowLeft — theo style dự án), có aria-label. Ở **tất cả** các session:

- `/study/session` — đã có "← Chọn phạm vi học" (Link) + nút LogOut góc phải. **Chuẩn hóa**: giữ link quay lại + thêm xác nhận khi thoát.
- `/quiz/[sessionId]` — thêm nút thoát (nếu chưa có).
- `/match/session?...` — thêm.
- `/memory/session?...` — thêm.
- `/runner/session` — Runner hiện không có nút thoát trong game (chỉ "Quay lại" ở end overlay + "Tạm dừng" khi tab ẩn) → thêm nút `←` góc trên trái trong lúc chơi (khi paused hoặc bất kỳ lúc nào) với xác nhận.

### 1.2 Xác nhận thoát

- Nhấn `←` → mở **dialog xác nhận** (shadcn AlertDialog/Dialog theo dự án): tiêu đề "Thoát phiên?" + mô tả "Tiến trình hiện tại sẽ bị mất." + 2 nút: **"Hủy"** (đóng dialog, ở lại) / **"Thoát"** (rời session, về trang setup tương ứng: study→/study, quiz→/quiz, match→/match, memory→/memory, runner→/runner).
- Style: tối giản, mobile-friendly (dialog full-width trên mobile hoặc sheet theo dự án).
- Không dùng `window.confirm` (native) — dùng component dialog của dự án (consistency + a11y).

### 1.3 Lưu ý

- Đừng phá luồng hoàn thành: khi session đã completed/game-over (end overlay hiển thị), nút thoát góc trái có thể ẩn hoặc giữ — chọn cách ít rối nhất (ẩn khi đã ở end state; end overlay đã có nút Quay lại).

---

## 2. Pause khi tab ẩn — Quiz / Match / Memory

Tham khảo chính xác pattern Runner (`runner-session.tsx`):

- `visibilitychange` → `document.hidden` → PAUSE; quay lại visible → RESUME.
- Overlay "Tạm dừng" (mờ, không cho tương tác) + nút "Tiếp tục".
- Timer/chuyển động dừng khi paused; không cộng thời gian paused.

### 2.1 Quiz

- Quiz có bộ đếm thời gian không? Kiểm tra `quiz-session.tsx` — nếu có elapsed/remaining time → dừng khi paused (lưu giá trị, resume tiếp tục).
- Nếu quiz không có timer chủ động (chỉ tính answered_at mỗi câu) → pause = chặn tương tác + overlay; không cần thời gian.
- KHÔNG gửi thêm sự kiện DB khi pause (không cần persist — chỉ UI).

### 2.2 Match

- `match-session.tsx`: pause → overlay + chặn chọn thẻ. Resume → tiếp tục.
- Match có timer không? (kiểm tra — nếu có timer count-up → dừng khi pause, như Runner).

### 2.3 Memory

- `memory-session.tsx`: pause → overlay + chặn lật thẻ + dừng timer (nếu có). Resume → tiếp tục.

### 2.4 Component dùng chung

- Nếu 3 mode có logic pause giống nhau → tạo 1 component/hook dùng chung (vd `src/features/learning-modes/components/pause-overlay.tsx` hoặc hook `useVisibilityPause`) — tránh copy 3 nơi. Runner đã có overlay riêng — có thể tái sử dụng style.
- Accessibility: overlay pause phải có aria (role="dialog" aria-modal hoặc aria-live), focus không rơi vào gameplay khi paused, Esc đóng.

---

## 3. Không làm

- KHÔNG persist trạng thái session khi rời hẳn trang (không localStorage, không DB, không URL state mới).
- KHÔNG đổi luồng setup (Task 3/4).
- KHÔNG đổi engine Runner/Quiz/Match/Memory logic (chỉ UI wrapper + overlay + xác nhận).

---

## 4. Tests

### 4.1 Unit/component

- Component test pause overlay: hiển thị khi paused, chặn tương tác, resume hoạt động.
- Xác nhận thoát: dialog mở khi bấm ←, Hủy đóng và ở lại, Thoát điều hướng đúng.
- Quiz/Match/Memory session: simulate `visibilitychange` → paused state; resume → playing.

### 4.2 E2E

- `tests/e2e/study-mode.spec.ts`, `quiz-advancement.spec.ts`, spec match/memory (nếu có), `runner-gameplay.spec.ts`: thêm case thoát có xác nhận.
- Assert: bấm ← → dialog hiện → Hủy → vẫn ở session; Thoát → về trang setup.
- Nếu có thể: simulate document.hidden → overlay pause xuất hiện (Playwright `page.evaluate` đổi visibility? nếu khó → giới hạn ở component test + ghi rõ).

---

## 5. Verification

```bash
npm run check
npm run test:e2e -- study-mode quiz-advancement runner-gameplay  # + match/memory nếu có spec
git status
git diff --check
git diff --stat
git diff
```

Kiểm tra diff: không migration, không đổi engine logic, không đổi setup flow.

## 6. Commit

```bash
git add <các file thuộc task>
git commit -m "feat: add exit confirmation and visibility pause to learning sessions"
```

**Không push** — chờ xác nhận của điều phối (không cần Sol review nếu không chạm DB; nếu phát hiện cần DB → dừng hỏi).

## 7. Evidence report

- Repository: starting/final commit, push status, worktree
- Nút thoát: từng session, dialog xác nhận
- Pause: từng mode, component/hook dùng chung
- Tests: files/discovered/passed/failed/skipped
- Files changed
- Safety: migrations/DB/deps/env/AI/production — YES/NO
- Ambiguities
- Verdict: `EVIDENCE READY FOR REVIEW` hoặc `INCOMPLETE — BLOCKER REQUIRES USER DECISION`
