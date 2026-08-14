# CapyStudy — Task 4: trang Kiểm tra — 2 thẻ chọn chế độ + lịch sử vào Thống kê

> **Status:** delivered (2026-08-14)
> **Baseline commit:** commit mới nhất trên main (sau Task 3 nếu đã merged)
> **Agent tier:** Codex + GPT-5.6 Terra (chính); **Codex + GPT-5.6 Sol (review bắt buộc)** — chạm luồng quiz/match session creation (RPC + coverage) + chuyển lịch sử
> **Decisions locked (user):**
>
> - **Bỏ thanh điều hướng "Trắc nghiệm / Match"** trên `/quiz`.
> - **Bỏ tab "Tạo bài / Lịch sử"** trên `/quiz`.
> - **Lịch sử bài kiểm tra chuyển vào Cá nhân → Thống kê** (`/profile?tab=statistics`).
> - **Bỏ chế độ (ModeFilter)** — không bắt user chọn; hệ thống tự ưu tiên **câu sai → chưa làm → ngẫu nhiên** (định nghĩa "câu sai" từ Task 1) cho đủ số câu.
> - **Bỏ chọn số câu ở bước đầu** của setup.
> - Luồng mới: chọn **một hoặc nhiều nguồn** → nhấn **"Bắt đầu kiểm tra"** → **điều hướng sang trang riêng `/quiz/mode`** chỉ hiển thị **2 thẻ chọn chế độ** (kích thước vừa 1 màn mobile, không có chi tiết nào khác trên trang):
>   1. `normal` + **Trắc nghiệm**
>   2. `thinking` + **Match**
>   - Chỉ được chọn chế độ khi tổng thẻ hợp lệ **≥ thẻ tối thiểu của chế độ** (Trắc nghiệm ≥ 10, Match ≥ 12) — kèm thông báo thẻ tối thiểu.
> - Sau khi chọn chế độ → **chọn số câu** → vào làm.
>   **Ngoài phạm vi:** /sets (Task 2), /study (Task 3), thoát/pause (Task 5), match/study/header giao diện (Task 6).

---

## 0. Trước khi bắt đầu

```bash
git status
git log -8 --oneline
git pull --ff-only
```

Đọc trước (bắt buộc):

- `src/app/(app)/quiz/page.tsx` — ModeTabs + SectionTabs (Tạo bài/Lịch sử) + QuizSetup + QuizHistory
- `src/features/quiz/components/quiz-setup.tsx` — ModeFilter + QuestionCountSelector + startQuiz
- `src/features/quiz/server/actions.ts` — `getQuizEligibility`, `startQuiz`, `loadUncoveredIds`, `loadWrongAnswerCardIds` (Task 1)
- `src/features/quiz/schemas/quiz-schema.ts` — `QUIZ_MIN_QUESTIONS` (10), `QUIZ_MAX_QUESTIONS`
- `src/app/(app)/match/page.tsx` + `src/features/match/components/match-setup.tsx` + `src/features/match/server/actions.ts` — luồng match hiện tại (MATCH_QUESTION_COUNTS = [12, 18, 24])
- `src/features/match/types/match-types.ts` — `MATCH_PAIR_COUNT = 6`
- `src/app/(app)/profile/page.tsx` (tab statistics) + `src/features/statistics/` — nơi thêm lịch sử quiz
- `src/features/practice-coverage/server/actions.ts` — filter helpers dùng chung
- RPC liên quan: `create_quiz_session` (hoặc tương đương), `create_match_session` (migration quiz + match)

---

## 1. Luồng mới trang /quiz

### 1.1 Bỏ thanh điều hướng + tabs

- Xóa `ModeTabs` (Trắc nghiệm/Match) và `SectionTabs` (Tạo bài/Lịch sử) khỏi `/quiz`.
- Trang /quiz chỉ còn: heading "Kiểm tra" + **bước 1: chọn nguồn** (SourceBrowser + nút "Bắt đầu kiểm tra" — kế thừa `QuizSetup` nhưng **bỏ ModeFilter và QuestionCountSelector ở bước này**).
- Component `QuizHistory` chuyển đi (xem §3).

### 1.2 Sau khi nhấn "Bắt đầu kiểm tra" → điều hướng `/quiz/mode`

**Điều hướng sang trang riêng `/quiz/mode`** (route mới) — trang này CHỈ hiển thị **2 thẻ chọn chế độ** (mobile-first, xếp dọc, mỗi thẻ ~1 màn mobile; desktop 2 cột). Nguồn đã chọn truyền qua URL search params (không dùng state local để mất khi reload):

| Thẻ         | Mascot     | Tối thiểu thẻ                   | Sau khi chọn                                                                                                         |
| ----------- | ---------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Trắc nghiệm | `normal`   | 10 (`QUIZ_MIN_QUESTIONS`)       | hiển thị chọn số câu (10–50, quick 10/20/30/50 + nhập tùy chỉnh — theo `QuestionCountSelector` hiện có) → start quiz |
| Match       | `thinking` | 12 (`MATCH_QUESTION_COUNTS[0]`) | hiển thị chọn số câu (12/18/24) → start match                                                                        |

- Mỗi thẻ hiển thị số thẻ hợp lệ hiện có.
- Nếu < tối thiểu → thẻ disabled + "Cần tối thiểu N thẻ — phạm vi hiện có M thẻ".
- Nguồn đã chọn giữ trong URL (`/quiz/mode?sourceType=...&setIds=...`) — không mất khi reload.
- Nút "← Quay lại chọn nguồn" trỏ về `/quiz` (kèm params nguồn để khôi phục lựa chọn).

### 1.3 Tái sử dụng tối đa

- Trắc nghiệm: tái sử dụng `startQuiz` (giữ nguyên contract — truyền source + mode `learningFilterToQuizMode` hiện tại + questionCount). Bỏ UI ModeFilter nhưng server vẫn nhận mode — truyền mode tự động theo ưu tiên sai→chưa làm→ngẫu nhiên (giống Task 3 §2, dùng chung helper `selectCardsByPriority` nếu đã có; quiz hiện có mode `wrong_answers`/`unseen`/`balanced` — chọn đúng mapping).
- Match: tái sử dụng `startMatchSession` (hoặc action tương đương) — truyền source + questionCount; bỏ filter.
- Component mới: `src/features/quiz/components/quiz-mode-select.tsx` (hoặc tương tự) — render 2 thẻ + config con (count); page mới `src/app/(app)/quiz/mode/page.tsx` đọc source params từ URL, render component này, rồi mới start quiz/match.
- `match-setup.tsx` / `memory-setup.tsx` / `runner-setup.tsx` (trang setup riêng `/match`, `/memory`, `/runner`): giữ nguyên hoạt động nhưng **bỏ ModeFilter** và áp dụng filter tự động cho nhất quán (giống Task 3 §2.3).

---

## 2. Filter tự động (giống Task 3)

Dùng chung helper `selectCardsByPriority(wrong → unseen → random)` từ Task 3 — quiz và match dùng nó thay cho ModeFilter. Nếu helper chưa tồn tại (Task 3 chưa merge), tạo trong `src/features/learning-modes/` với unit test bắt buộc (không duplicate với Task 3 — nếu Task 3 đã có, IMPORT và dùng lại).

---

## 3. Lịch sử bài kiểm tra → Cá nhân → Thống kê

### 3.1 Nơi hiển thị

- `/profile?tab=statistics` (trang `src/app/(app)/profile/page.tsx` tab statistics — hiện đang hiển thị streak/stats; xem cấu trúc hiện tại).
- Thêm **section "Lịch sử bài kiểm tra"**: liệt kê các quiz đã hoàn thành (như `QuizHistory` hiện tại: score, mode, completed_at, link tới `/quiz/[sessionId]/result`), giới hạn ~20–50, xếp `completed_at desc`.
- Empty state: mascot `thinking` + "Bạn chưa hoàn thành bài kiểm tra nào." (giữ pattern đã có).

### 3.2 Xóa khỏi /quiz

- Xóa `QuizHistory` + tab Lịch sử khỏi `/quiz`. Đảm bảo không còn link nào trỏ tới `/quiz?tab=history` (grep toàn repo — nếu còn, chuyển sang profile).
- `src/app/(app)/history/page.tsx` (nếu tồn tại — trước đây chỉ là redirect tới `/quiz?tab=history`): chuyển redirect sang `/profile?tab=statistics` (hoặc xóa route nếu không còn dùng — kiểm tra nav; nếu xóa, cập nhật nav/app-navigation).

---

## 4. Mobile-first

- 2 thẻ chọn chế độ: mobile dọc, desktop 2 cột.
- Chọn số câu: dùng `QuestionCountSelector` hiện có (đã mobile-friendly).
- Không horizontal overflow 390px.

---

## 5. Tests

### 5.1 Unit/component

- `quiz-mode-select`: 2 thẻ; disabled khi thiếu thẻ + thông báo; Trắc nghiệm → chọn số câu; Match → chọn số câu 12/18/24.
- QuizHistory (mới tại profile): render danh sách/empty.
- Cập nhật test cũ assert tabs cũ.

### 5.2 E2E

- `tests/e2e/quiz-advancement.spec.ts`, `quiz-result-collections.spec.ts`, `match-*.spec.ts` (nếu có): cập nhật theo luồng mới.
- Assert: chọn nguồn → Bắt đầu kiểm tra → 2 thẻ; đủ thẻ → chọn Trắc nghiệm → chọn 10 câu → vào làm; lịch sử không còn trên /quiz; lịch sử hiển thị trên /profile?tab=statistics.
- Không overflow 390px.

---

## 6. Verification

```bash
npm run check
npm run db:test
npm run test:e2e -- quiz-advancement quiz-result-collections match learning-mode-setup
git status
git diff --check
git diff --stat
git diff
```

Kiểm tra diff: không migration mới (nếu cần → STOP hỏi), không đụng study flow (Task 3), không xóa route /match.

## 7. Commit

```bash
git add <các file thuộc task>
git commit -m "feat: restructure quiz flow with mode selection and move history to statistics"
```

**Không push** — chờ review (Sol) + xác nhận của điều phối.

## 8. Evidence report

- Repository: starting/final commit, push status, worktree
- Luồng mới: từ chọn nguồn → 2 thẻ → count → session
- Lịch sử: nơi mới, route cũ xử lý thế nào
- Files changed
- Safety: migrations/DB/deps/env/AI/production — YES/NO
- Ambiguities
- Verdict: `EVIDENCE READY FOR REVIEW` hoặc `INCOMPLETE — BLOCKER REQUIRES USER DECISION`
