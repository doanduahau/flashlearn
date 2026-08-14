# CapyStudy — Task 3: trang Học — 3 thẻ chọn chế độ + filter tự động

> **Status:** delivered (2026-08-14)
> **Baseline commit:** commit mới nhất trên main (sau Task 1, Task 2 nếu đã merged)
> **Agent tier:** Codex + GPT-5.6 Terra (chính); **Codex + GPT-5.6 Sol (review bắt buộc)** — chạm luồng tạo session Memory/Runner (RPC + coverage) + bỏ UI chọn filter
> **Decisions locked (user):**
>
> - **Bỏ thanh điều hướng "Học truyền thống / Vừa học vừa chơi"** trên `/study`.
> - Luồng mới: user **chọn nguồn** (SourceBrowser hiện tại) → nhấn **"Bắt đầu học"** → **điều hướng sang trang riêng `/study/mode`** chỉ hiển thị **3 thẻ chọn chế độ** (kích thước vừa 1 màn mobile, không có chi tiết nào khác trên trang):
>   1. `normal` + **Lật thẻ**
>   2. `thinking` + **Memory matching**
>   3. `run` + **Capy runner**
> - **Chọn chế độ được phép** chỉ khi tổng thẻ hợp lệ trong phạm vi đã chọn **≥ số thẻ tối thiểu của chế độ**; nếu không đủ → thẻ bị disabled + thông báo rõ "cần tối thiểu N thẻ".
> - **Bỏ ModeFilter (Câu sai/Chưa làm/Ngẫu nhiên) cho Memory và Runner** — không bắt user chọn chế độ; hệ thống tự ưu tiên: **câu sai → chưa làm → ngẫu nhiên**, lấy cho đủ số câu đã chọn.
> - Runner: sau khi chọn thẻ Capy runner → chọn **số câu** (12/18/24) + **độ khó** (Dễ/Vừa/Khó) → vào chơi.
> - Memory: sau khi chọn thẻ → chọn **số câu** (12/18/24) → vào chơi.
> - Lật thẻ: chọn thẻ → vào thẳng `/study/session` (như hiện tại).
> - "Câu sai" dùng **định nghĩa mới từ Task 1** (lần trả lời gần nhất là sai).
>   **Ngoài phạm vi:** /sets (Task 2), /quiz (Task 4), thoát/pause (Task 5), match/study/header giao diện (Task 6).

---

## 0. Trước khi bắt đầu

```bash
git status
git log -8 --oneline
git pull --ff-only
```

Đọc trước (bắt buộc):

- `src/app/(app)/study/page.tsx` — hiện có ModeTabs + StudySourceSelect + PlayModes (2 link Memory/Runner)
- `src/features/study/components/study-source-select.tsx` — nút "Bắt đầu học" hiện push thẳng `/study/session`
- `src/features/learning-modes/types.ts` — `learningFilters`, `applyLearningFilter`, `filterCardsByMode` (đang dùng filter chủ động)
- `src/features/learning-modes/utils/*` (nếu có) — filter/eligibility helpers
- `src/features/memory/components/memory-setup.tsx` + `src/features/memory/server/actions.ts` — luồng start memory (ModeFilter + count + startMemorySession)
- `src/features/runner/components/runner-setup.tsx` + `src/features/runner/server/actions.ts` — luồng start runner (ModeFilter + count + difficulty + startRunnerSession + availability)
- `src/features/runner/types/runner-types.ts` — `RUNNER_QUESTION_COUNTS = [12, 18, 24]`
- `src/features/memory/types/memory-types.ts` — `MEMORY_QUESTION_COUNTS = [12, 18, 24]`
- Các RPC/coverage liên quan: `create_memory_session`, `create_runner_session`, `load_runner_candidate_eligibility` (migration `20260813020000` + `20260814010000`)
- `src/features/practice-coverage/server/actions.ts` — `loadWrongAnswerCardIds` (định nghĩa "câu sai" từ Task 1), `loadUncoveredIds`

---

## 1. Luồng mới trang /study

### 1.1 Bỏ ModeTabs

- Xóa `ModeTabs` khỏi `/study`. Xóa component `PlayModes` (2 link Memory/Runner cũ).
- Trang /study chỉ còn: heading "Học" + `StudySourceSelect` (chọn nguồn) như hiện tại.

### 1.2 Sau khi nhấn "Bắt đầu học" → điều hướng `/study/mode`

Thay vì push thẳng `/study/session`, **điều hướng sang trang riêng `/study/mode`** (route mới) — trang này CHỈ hiển thị **3 thẻ chọn chế độ** (mobile-first, xếp dọc, mỗi thẻ ~1 màn mobile; desktop 3 cột hoặc xếp dọc gọn). Nguồn đã chọn truyền qua URL search params (giữ nguyên pattern source params của Match/Runner session — không dùng state local để mất khi reload):

| Thẻ             | Mascot     | Tối thiểu thẻ        | Sau khi chọn                                       |
| --------------- | ---------- | -------------------- | -------------------------------------------------- |
| Lật thẻ         | `normal`   | 1 (có ≥1 thẻ hợp lệ) | push `/study/session?<source params>` như hiện tại |
| Memory matching | `thinking` | 12                   | hiển thị chọn số câu (12/18/24) → start            |
| Capy runner     | `run`      | 12                   | hiển thị chọn số câu (12/18/24) + độ khó → start   |

- Mỗi thẻ hiển thị: mascot + tên + mô tả ngắn + **số thẻ hợp lệ hiện có** (vd "Có 18 thẻ").
- Nếu số thẻ hợp lệ < tối thiểu → thẻ `disabled` (mờ) + dòng chú thích: **"Cần tối thiểu N thẻ — phạm vi hiện có M thẻ"**.
- Nguồn đã chọn giữ trong URL (`/study/mode?sourceType=...&setIds=...`) — không mất khi reload, quay lại đổi chế độ.
- Có nút "← Quay lại chọn nguồn" trỏ về `/study` (kèm params nguồn để khôi phục lựa chọn; Task 5 sẽ thêm xác nhận thoát — ở task này chỉ cần nút quay lại đơn giản).

### 1.3 Lưu ý kỹ thuật — tái sử dụng tối đa

- **Không tạo lại logic start session.** Tái sử dụng server actions hiện có:
  - Memory: `startMemorySession` (trong `memory/server/actions.ts`) — truyền `all`/`setIds`/`collectionIds` + `questionCount`; bỏ tham số filter (luôn tự động, xem §2).
  - Runner: `startRunnerSession` (trong `runner/server/actions.ts`) — truyền source + `questionCount` + `difficulty`; bỏ filter.
- Component mới: `src/features/study/components/study-mode-select.tsx` (hoặc tương tự) — nhận `sourceParams` + tổng thẻ hợp lệ, render 3 thẻ + các bước config con (count/difficulty).
- `StudySourceSelect.start()` đổi: thay vì `router.push("/study/session?...")`, **`router.push("/study/mode?<source params>")`** — component mới `src/app/(app)/study/mode/page.tsx` đọc params, render 3 thẻ + các bước config con (count/difficulty), rồi mới push tới session tương ứng.

---

## 2. Filter tự động: câu sai → chưa làm → ngẫu nhiên

### 2.1 Nguyên tắc

Với Memory và Runner (và các chế độ Học), **bỏ UI chọn filter**. Khi start session, server action tự chọn:

1. Lấy pool hợp lệ trong phạm vi (theo eligibility hiện có).
2. Ưu tiên lấy **câu sai** (định nghĩa Task 1: lần trả lời gần nhất là sai) trước, cho đến khi đủ số câu.
3. Nếu chưa đủ → bổ sung bằng **chưa làm** (uncovered).
4. Nếu vẫn chưa đủ → bổ sung **ngẫu nhiên** từ phần còn lại.

### 2.2 Cách làm đề xuất

- Có thể tái sử dụng `applyLearningFilter`/`filterCardsByMode` nhưng gọi tuần tự: `wrong` → `unseen` → `random` trên cùng một pool (mỗi bước loại bỏ phần đã lấy).
- Tạo 1 helper dùng chung trong `src/features/learning-modes/` (vd `selectCardsByPriority(ids, wrongIds, uncoveredIds, count)`) — dùng được cho cả Memory, Runner (và Match/Memory ở Task 4 nếu cùng pattern). Pure + unit test bắt buộc.
- Server action Memory/Runner đổi: nhận source + count (+ difficulty cho runner), KHÔNG nhận filter; bên trong gọi helper trên.
- Giữ nguyên contract RPC phía DB (`create_memory_session`/`create_runner_session`) — chỉ đổi cách chuẩn bị `session_card_ids` ở server layer, hoặc nếu RPC hiện nhận filter → kiểm tra và điều chỉnh tham số truyền (không sửa migration).

### 2.3 Lưu ý

- Nếu đổi chữ ký server action (bỏ tham số filter) → cập nhật mọi caller: `memory-setup.tsx`, `runner-setup.tsx`, `study-mode-select.tsx` (mới), tests.
- `runner-setup.tsx` và `memory-setup.tsx` hiện vẫn là trang setup độc lập tại `/memory` và `/runner` — **giữ nguyên route này hoạt động** (bỏ ModeFilter, áp dụng filter tự động ở đó luôn cho nhất quán) — vì user có thể vào trực tiếp. Nếu phát hiện phức tạp → báo trong evidence.

---

## 3. Mobile-first

- 3 thẻ chọn chế độ: mobile xếp dọc, mỗi thẻ đủ cao để chạm (≥ 44px), desktop có thể 3 cột.
- Không horizontal overflow 390px.
- Thông báo "cần tối thiểu" hiển thị ngay trên thẻ (không cần bấm).

---

## 4. Tests

### 4.1 Unit (bắt buộc mới)

- `selectCardsByPriority` (hoặc helper tương đương):
  - đủ câu sai → chỉ lấy câu sai, không lấy unseen/random;
  - thiếu câu sai → bổ sung unseen theo thứ tự;
  - thiếu cả hai → bổ sung random;
  - không trùng id trong kết quả;
  - count = 0 → rỗng; count > pool → trả toàn bộ pool.

### 4.2 Component

- `study-mode-select`: 3 thẻ hiển thị; thẻ disabled khi thiếu thẻ + thông báo tối thiểu; chọn Memory → hiện chọn số câu; chọn Runner → hiện số câu + độ khó; Lật thẻ → push thẳng.
- `study-source-select`: sau "Bắt đầu học" không push thẳng mà chuyển sang màn chọn chế độ.

### 4.3 E2E

- `tests/e2e/learning-mode-setup.spec.ts` + `runner-setup.spec.ts` + spec memory (nếu có): cập nhật theo luồng mới.
- Assert: chọn nguồn đủ thẻ → 3 thẻ sáng; chọn nguồn ít thẻ → thẻ Memory/Runner disabled kèm thông báo; chọn Capy runner → chọn count + difficulty → vào session.
- Không overflow 390px trên /study.

---

## 5. Verification

```bash
npm run check
npm run db:test          # nếu không đổi DB vẫn chạy để xác nhận regression
npm run test:e2e -- learning-mode-setup runner-setup memory
git status
git diff --check
git diff --stat
git diff
```

Kiểm tra diff: không migration mới (nếu cần → STOP hỏi), không đụng quiz (Task 4), không xóa route /memory /runner.

## 6. Commit

```bash
git add <các file thuộc task>
git commit -m "feat: restructure study flow with mode selection and auto filter priority"
```

**Không push** — chờ review (Sol) + xác nhận của điều phối.

## 7. Evidence report

- Repository: starting/final commit, push status, worktree
- Luồng mới: sơ đồ từ chọn nguồn → 3 thẻ → config → session
- Filter tự động: cách implement + helper mới + các case
- Server action thay đổi: chữ ký trước/sau, caller đã cập nhật
- Tests: files/discovered/passed/failed/skipped
- Files changed
- Safety: migrations/DB/deps/env/AI/production — YES/NO
- Ambiguities
- Verdict: `EVIDENCE READY FOR REVIEW` hoặc `INCOMPLETE — BLOCKER REQUIRES USER DECISION`
