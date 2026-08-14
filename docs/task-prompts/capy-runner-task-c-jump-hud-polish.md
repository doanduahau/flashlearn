# Capy Runner — Task C: jump timing + HUD câu hỏi + ô đáp án cố định

> **Status:** verified (2026-08-14) — commit `cc01af8`, đã push origin/main.
> **Baseline commit:** `6a08df6` (fix: diversify runner distractors within session scope) — trên origin/main
> **Agent tier:** Codex + GPT-5.6 Terra — **không cần review riêng** (UI thuần, không chạm DB/security; theo chính sách model hiện hành)
> **Decisions locked (user):**
>
> - **Jump:** chỉ đổi `GRAVITY` 0.0011 → **0.0008** (thời gian bay ~1.4s, độ cao ~190px). Giữ `JUMP_VELOCITY = 0.55`. Mục đích: người chơi nhảy sớm hơn một chút vẫn qua được đồ ăn (hiện tại thời gian bay ≈ thời gian đồ ăn đi ngang vùng nhân vật ở độ Dễ → phải canh sát mới qua).
> - **Câu hỏi:** căn giữa màn hình (ngang), tăng cỡ chữ từ `text-base` (16px) lên **`text-lg` (18px) mobile / `sm:text-xl` (20px) desktop**.
> - **Ô đáp án (bottom label):** kích thước **cố định** — không giãn theo lượng chữ; chữ căn giữa; nếu đáp án dài hơn ô → **tự co cỡ chữ xuống** cho vừa, **không bao giờ cắt/mất nội dung**.
>   **Ngoài phạm vi:** engine Task 2 (`src/features/runner/utils/runner-state.ts`, `config.ts`, `runner-difficulty.ts`, types) — KHÔNG đụng; timing `timePerItemMs` 4.5/3.2/2.4 — KHÔNG đổi; DB/migration — KHÔNG đụng; đổi tên/route — KHÔNG.

---

## 0. Before starting

Baseline = `6a08df6` trên `main` (or strictly newer). Chạy `git status` / `git log -5` / `git pull --ff-only`.

Đọc trước:

- `src/features/runner/components/runner-canvas.tsx` — hằng số vật lý (hiện: `CHARACTER_WIDTH=100`, `CHARACTER_HEIGHT=120`, `CHARACTER_POSITION_RATIO=0.3`, `FOOD_SIZE=28`, `JUMP_VELOCITY=0.55`, `GRAVITY=0.0011`) và vòng lặp physics (gravity + jump, food di chuyển bằng `speed`, collision AABB).
- `src/features/runner/components/runner-hud.tsx` — câu hỏi hiện nằm trong HUD top, căn trái, `text-base sm:text-lg`.
- `src/features/runner/components/runner-bottom-label.tsx` — nhãn đáp án hiện căn giữa nhưng **chiều cao giãn theo độ dài chữ**.
- Test hiện có: `tests/unit/features/runner/runner-hud.test.tsx` (4 case: lives, progress, timer, question text), `tests/unit/features/runner/runner-session.test.tsx` (canvas stub + fake rAF), `tests/unit/features/runner/collision.test.ts` (thuần, không liên quan).

Nếu repo mâu thuẫn với rules dưới → **STOP và hỏi**. Không tự quyết.

## 1. Scope

Sửa 3 điểm UX thuần (không đụng engine Task 2, không đụng DB):

### 1.1 Jump physics — `src/features/runner/components/runner-canvas.tsx`

- Đổi `GRAVITY` từ `0.0011` → **`0.0008`**. **Giữ nguyên mọi hằng số khác** (`JUMP_VELOCITY`, kích thước nhân vật, `FOOD_SIZE`, hitbox 0.2/0.6, `MAX_DELTA_MS`, `BURST_MS`, `CHARACTER_STATE_MS`).
- Không đổi bất kỳ logic nào khác (gravity áp vào `charVy` theo delta như hiện tại).
- Không sửa engine Task 2 — `runner-state.ts` chỉ track `jumpState` logical (grounded/airborne), không đụng.
- Trong evidence report, ghi rõ thông số vật lý MỚI:
  - thời gian bay = 2 × JUMP_VELOCITY / GRAVITY ≈ **1375 ms**;
  - độ cao tối đa = JUMP_VELOCITY² / (2 × GRAVITY) ≈ **189 px**;
  - so sánh với thời gian đồ ăn đi ngang vùng nhân vật ở độ Dễ (4500 ms, màn 390px) để chứng minh "dư biên an toàn" (đây là mục tiêu chính của user).

### 1.2 Câu hỏi căn giữa + to chữ — `src/features/runner/components/runner-hud.tsx`

- Đoạn `<p>` hiển thị câu hỏi: thêm **`text-center`**, đổi cỡ từ `text-base ... sm:text-lg` thành **`text-lg ... sm:text-xl`** (18px mobile / 20px desktop).
- Giữ nguyên mọi thứ khác (hàng lives/timer/progress, aria-label, spacing).
- Kiểm tra câu hỏi dài: căn giữa + `leading-snug` giữ nguyên; không cần line-clamp (câu hỏi phải đọc được đầy đủ).

### 1.3 Ô đáp án cố định — `src/features/runner/components/runner-bottom-label.tsx`

Yêu cầu chức năng (bắt buộc):

1. **Kích thước cố định** — chiều cao ô không đổi khi label ngắn/dài (đủ rộng cho ~2 dòng chữ ở cỡ chuẩn). Không giãn theo lượng chữ như hiện tại.
2. **Căn giữa** cả ngang lẫn dọc.
3. **Chữ dài → tự co cỡ chữ xuống** cho vừa ô. **KHÔNG cắt nội dung** (không line-clamp, không ellipsis, không overflow hidden mất chữ) — người chơi cần đọc được đáp án sai để tránh.
4. Vẫn giữ `safe-area-inset-bottom` cho thiết bị có notch.
5. Touch-friendly, không đổi layout khác.

Gợi ý implementation (agent chọn cách phù hợp repo, miễn đạt 5 yêu cầu trên):

- **Helper thuần** (đặt trong `src/features/runner/utils/`, ví dụ `answer-label-size.ts`) nhận chuỗi label → trả cỡ chữ (ví dụ theo độ dài ký tự + ký tự rộng nhất: ≤ 20 ký tự → text-lg, ≤ 40 → text-base, ≤ 60 → text-sm, còn lại → text-xs) — **phải có unit test** cho bảng quy đổi (độ dài biên, ký tự rộng như "W"/"m", chuỗi rỗng).
- Hoặc cách khác tương đương (ví dụ đo thực tế qua ref + ResizeObserver) — nhưng ưu tiên helper thuần test được.

## 2. Ràng buộc

- **KHÔNG đụng engine Task 2**: `src/features/runner/utils/runner-state.ts`, `config.ts`, `runner-difficulty.ts`, `src/features/runner/types/runner-types.ts`.
- **KHÔNG đổi** `timePerItemMs` (4.5/3.2/2.4) và lives (3/2/1).
- **KHÔNG đổi** vị trí nhân vật (30%), kích thước (100×120), `FOOD_SIZE=28`, hitbox.
- **KHÔNG đụng DB/migration/RPC** — task UI thuần.
- **KHÔNG AI**.
- Không đổi text/aria-label hiện có (test HUD cũ vẫn phải pass).

## 3. Tests

- **Cập nhật** `tests/unit/features/runner/runner-hud.test.tsx` nếu cần (thêm assert căn giữa/cỡ chữ nếu hợp lý — không bắt buộc nếu chỉ là class CSS; giữ 4 case cũ pass).
- **Thêm unit test** cho helper co cỡ chữ đáp án (nếu tạo helper thuần).
- **Kiểm tra** `runner-session.test.tsx` (canvas stub) không vỡ do đổi hằng số — sửa nếu test assert giá trị GRAVITY cũ.
- Chạy:
  ```bash
  npx vitest run tests/unit/features/runner
  npm run check
  npm run test:e2e -- runner-setup runner-gameplay   # cần local Supabase
  ```

## 4. Diff review

- Chỉ 3 file component + helper mới + test; không đụng engine/DB/route/rename.
- `GRAVITY` đúng 0.0008; không có hằng số "ma thuật" rải rác mới ngoài config hiện có.
- Không `Date.now`/`Math.random`/`setInterval` mới trong code chính (rAF loop giữ nguyên).

## 5. Commit

```bash
git add src/features/runner/components/runner-canvas.tsx src/features/runner/components/runner-hud.tsx src/features/runner/components/runner-bottom-label.tsx src/features/runner/utils/ tests/unit/features/runner/
git commit -m "feat: retune runner jump and answer label UX"
```

Push lên origin/main (baseline đã trên origin + gate pass).

## 6. Evidence report

- Repository: starting/final commit, push status, worktree.
- Thông số vật lý mới (thời gian bay, độ cao, biên an toàn so với Dễ 4500ms @390px).
- Mô tả 3 thay đổi UI + helper co chữ (nếu có).
- Tests: files/discovered/passed/failed/skipped (unit + E2E).
- Files changed; Safety: migrations NO, DB NO, deps NO, env NO, AI NO, production NOT touched.
- Ambiguities; Verdict: `EVIDENCE READY FOR REVIEW` / `INCOMPLETE — BLOCKER REQUIRES USER DECISION`.
