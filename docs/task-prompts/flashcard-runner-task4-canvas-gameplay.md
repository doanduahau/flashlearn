# Flashcard Runner V1 — Task 4: Canvas runtime + gameplay session

> **Status:** verified (2026-08-14) — agent xong `82f839e`, đối chiếu repo đạt; **đã push** `3cb2aaa` + `82f839e` lên origin/main
> **Baseline commit:** `3137b33` (`feat: add runner setup and session wiring`)
> **Agent tier:** OpenCode + DeepSeek V4 Pro (chính); **Codex + GPT-5.6 Terra (review bắt buộc)** — rAF/lifecycle/cleanup, StrictMode, resize
> **Decisions locked (user):**
>
> - Màn chờ "**Chạm để bắt đầu**" (overlay hiện độ khó + mạng; đồng hồ chỉ chạy khi bắt đầu)
> - Kết thúc trận: **overlay đơn giản** ("Hết mạng!" / "Hoàn thành! · thời gian") + nút "Quay lại" → `/runner`. KHÔNG lưu kỷ lục / coverage / result đầy đủ (Task 5)
> - **Mascot có sẵn (đã chốt):** 5 level (theo **current streak** 0/30/60/120/240) × 7 trạng thái tại `public/mascot/level-{1..5}/{normal,happy,sad,congrats,run,thinking,point-right}.png`. Runner: chơi = `run`, ăn đúng = `happy`, ăn sai = `sad`, kết thúc = `congrats` (hoàn thành, mất ≤ 1 mạng) / `sad` (mất nhiều mạng hoặc hết mạng). Xem `mascot-plan.md` (đã lock)
> - Ẩn toàn bộ chrome app (sidebar desktop + header mobile + bottom nav) trên `/runner/session` — full-screen gameplay; auth guard giữ nguyên
> - Tự dừng khi chuyển tab (visibilitychange) + overlay "Tạm dừng" nhỏ; KHÔNG có nút pause thủ công; KHÔNG có nút thoát giữa trận (end overlay + browser back đủ)
> - Bàn phím desktop: Space / ArrowUp = nhảy (tùy chọn tối thiểu)
>   **Ngoài phạm vi:** result + best-time + coverage completion (Task 5); AI; DB; deps mới; sửa engine Task 2; mascot hệ thống app-wide (dashboard/thống kê/empty states — task riêng sau).

---

## 0. Before starting

Baseline `3137b33` (or strictly newer) on `main`. Run `git status` / `git log -5` / `git pull --ff-only`.

Read before choosing file names:

- Task 2 engine (ĐÃ verified — **KHÔNG được sửa**): `src/features/runner/utils/runner-state.ts`, `utils/runner-difficulty.ts`, `config.ts`, `types/runner-types.ts`. Nếu task này phát hiện cần đổi engine → **STOP và hỏi**.
- Task 3: `src/app/(app)/runner/session/page.tsx` (server page — chỉ đổi component render), `src/features/runner/components/runner-session-placeholder.tsx` (sẽ XÓA).
- `docs/LEARNING_MODES.md` — "Flashcard Runner" + "Frozen Runner rules" (canvas/rAF, không game engine, React owns HUD/lives/timer/progress/question, Canvas owns animation/physics/collision/effects).
- App shell: `src/components/layout/app-shell.tsx`, `app-navigation.tsx`, `(app)/layout.tsx` (auth guard).
- Precedent component test: `tests/unit/features/memory/memory-board.test.tsx`; vitest config; playwright config.
- `public/mascot/level-{1..5}/` (ảnh mascot đã có sẵn, tên đã đổi ASCII) + `src/features/statistics/utils/streak.ts` (tái sử dụng tính current streak → level).

Nếu repo mâu thuẫn với rules dưới → **STOP và hỏi**. Không tự quyết.

## 1. Scope

Thay `RunnerSessionPlaceholder` bằng màn chơi thật trên `/runner/session`:

1. **Canvas runtime**: nhân vật chạy liên tục, đồ ăn trôi, nhảy, va chạm, hiệu ứng đúng/sai, nền đơn giản — `requestAnimationFrame`, KHÔNG game engine.
2. **Session UI**: HUD (mạng, đồng hồ đếm ngược lên, "Câu X / N", câu hỏi), nhãn đáp án dưới, overlay bắt đầu / tạm dừng / kết thúc.
3. **Nối engine Task 2**: mọi hành vi gameplay đi qua `applyRunnerEvent`; Canvas chỉ dispatch semantic events và render.
4. **Ẩn chrome app** trên `/runner/session` (full-screen, mobile-first, không overflow, safe-area).
5. **Tự dừng khi chuyển tab** (visibilitychange) — pure transition PAUSE/RESUME của engine.

KHÔNG làm: persistence/result (Task 5), AI, mascot/assets, DB, deps mới, sửa engine, thêm nút pause thủ công.

## 2. Kiến trúc

```text
/app/(app)/runner/session/page.tsx (server, giữ nguyên logic)
  → <RunnerSession questions difficulty /> (client)
      ├─ engine state trong useRef (nguồn sự thật) — applyRunnerEvent
      ├─ display snapshot trong React state (chỉ re-render khi HUD đổi:
      │   status, lives, questionIndex, activeAnswerIndex/itemSeq,
      │   elapsedMs (theo giây), feedback token, jumpState)
      ├─ <RunnerHud /> (thuần, props) — hearts · timer · Câu X/N · front
      ├─ <RunnerCanvas /> (canvas + rAF + physics + draw)
      ├─ <RunnerBottomLabel /> (thuần) — text = choices[activeAnswerIndex]
      ├─ <RunnerStartOverlay /> / <RunnerPausedOverlay /> / <RunnerEndOverlay /> (thuần, props)
      └─ listeners: pointerdown/keydown/visibilitychange/ResizeObserver
```

- **Engine state ref**: mỗi frame rAF: clamp delta → dispatch TICK → physics (character y/vy, food x) → collision → dispatch HIT/PASS (kèm `itemSeq` hiện tại). Canvas đọc ref trực tiếp; chỉ khi snapshot hiển thị đổi mới `setState`.
- **Presentational components thuần (props-driven)** để unit-test trực tiếp HUD/overlays (không cần canvas).
- **Art seam**: `src/features/runner/art/runner-character.ts` — `drawRunnerCharacter(ctx, opts)` vẽ **mascot** (`mascotAssetPath(level, state)` → Image preload cache; fallback shape đơn giản khi ảnh chưa load; đổi state theo feedback: `run` mặc định, `happy`/`sad` trong ~600ms sau hit rồi về `run`).

## 3. Hành vi chi tiết

### Khởi tạo & bắt đầu

- Engine `createRunnerState(questions, difficulty)` (1 lần, ref). Status ban đầu `ready`.
- Overlay "Chạm để bắt đầu" (hiện độ khó + số mạng). Bấm → `START`. Đồng hồ chỉ chạy từ `START`. Food đầu tiên spawn từ cạnh phải khi `playing`.

### Điều khiển

- `pointerdown` trong vùng chơi → `JUMP`. Desktop: Space / ArrowUp keydown → `JUMP`. Single jump only (engine chặn khi airborne).
- Không có nút thoát giữa trận; end overlay + browser back đủ.

### Canvas / vật lý (phía adapter, KHÔNG vào engine)

- Nhân vật: x cố định bên trái; y, vy, gravity do adapter quản lý. JUMP → vy âm; khi chạm đất → dispatch `LAND`.
- Đồ ăn: spawn cạnh phải, `speed = calculateRunnerSpeed(playableWidth, timePerItemMs)` px/ms; khi `x < -foodWidth` → `PASS_ACTIVE_ITEM(state.itemSeq)`.
- Mỗi khi `state.itemSeq` đổi (item mới) → respawn food tại cạnh phải.
- Va chạm: AABB giữa hitbox nhân vật (nhỏ hơn hình vẽ, "tha thứ") và food → `HIT_ACTIVE_ITEM(state.itemSeq)`.
- Resize/orientation: ResizeObserver → resize canvas theo DPR; tốc độ tính lại theo width mới (áp dụng từ food kế tiếp).
- DPR: `canvas.width = cssW * dpr; ctx.setTransform(dpr,0,0,dpr,0,0)`.

### Hiệu ứng

- Feedback token đổi (`feedback.kind + itemSeq + questionIndex`) → burst xanh/đỏ ~250–300ms tại vị trí food + nhân vật đổi state `happy`/`sad` ~600ms rồi về `run` (phi chặn, do adapter quản lý, không phải engine). Tôn trọng `prefers-reduced-motion` (giảm/ẩn hiệu ứng).

### HUD & label

- Hearts = lives (icon Heart từ lucide-react, đã dùng trong repo). Timer đếm lên `mm:ss` (cập nhật khi đổi giây). "Câu X / N". Câu hỏi front ở trên cùng (wrap, cỡ chữ đọc được, không đè canvas).
- Label dưới = `choices[activeAnswerIndex]` — **khớp chính xác** food đang hiển thị (frozen rule).

### Pause

- `visibilitychange` → hidden: `PAUSE` + overlay "Tạm dừng — quay lại để tiếp tục" (text, không nút); visible: `RESUME` (chỉ khi đang paused). Không tăng elapsed khi paused.

### Kết thúc (overlay đơn giản, KHÔNG persistence)

- `game-over` → overlay "Hết mạng!" + ảnh mascot `sad` + nút "Quay lại" → `/runner`.
- `completed` → overlay "Hoàn thành!" + "Thời gian mm:ss" + ảnh mascot `congrats` nếu `wrongCount = initialLives - lives ≤ 1`, ngược lại `sad` + nút "Quay lại" → `/runner`.
- Chưa gọi `complete_learning_coverage_session`, chưa gọi `submit_runner_best_time` (Task 5).

### Chrome ẩn

- Trên `/runner/session`: không sidebar (desktop), không header mobile, không bottom nav; full-bleed, `min-h-dvh`, safe-area; auth guard của `(app)/layout.tsx` GIỮ NGUYÊN (không chuyển route group).
- Cách làm đề xuất (chọn cách sạch nhất trong ràng buộc này): tách chrome vào client component mới `src/components/layout/app-chrome.tsx` ("use client", `usePathname`) — khi `pathname.startsWith("/runner/session")` → render `<div className="min-h-dvh">{children}</div>` (không chrome, không padding); ngược lại render chrome hiện tại. `AppShell` (server) giữ nguyên, truyền các slot server (CurrentUser, StreakIndicator, SignOutButton…) làm props (React nodes) cho `AppChrome`. KHÔNG đổi hành vi các trang khác.

## 4. Pure helpers (unit-test)

- `src/features/runner/utils/format-runner-time.ts` — `formatRunnerTime(elapsedMs: number): string` → "mm:ss" (pad 2 số; minutes có thể > 59). Chặn negative/NaN → "00:00".
- `src/features/runner/utils/collision.ts` — `rectsOverlap(a, b)` AABB thuần.
- Không `Date.now()` / browser globals trong pure utils.

## 5. Tests

### Unit (Vitest)

- `format-runner-time.test.ts` — 0 → "00:00"; 60_000 → "01:00"; 61_500 → "01:01"; invalid → "00:00".
- `collision.test.ts` — overlap các hướng; chạm cạnh; không chạm.
- `runner-hud.test.tsx` / `runner-end-overlay.test.tsx` (RTL, thuần props) — hearts đúng lives; "Câu X / N"; timer format; overlay game-over/completed đúng text + nút.
- `runner-session.test.tsx` (RTL) — mock `HTMLCanvasElement.prototype.getContext` (stub 2d) + fake rAF (ticker điều khiển được qua `vi.stubGlobal`); assert: start overlay render → click → `playing` (hearts theo difficulty, "Câu 1 / N"); pointerdown → JUMP không crash; `visibilitychange` hidden → paused (timer ngừng với fake timers); cleanup unmount không lỗi.

### E2E (Playwright, cần local Supabase)

- New `tests/e2e/runner-gameplay.spec.ts` (viewport 390×844):
  - `/runner/session` render canvas + HUD "Câu 1 / N" + hearts theo difficulty.
  - Click "Chạm để bắt đầu" → timer bắt đầu đếm (chờ ~1.2s, assert text đổi).
  - Bottom nav + header ẩn trên session page (assert nav không visible).
  - Không horizontal overflow tại 390px.
  - Quay lại `/runner` vẫn hoạt động (browser back / end overlay nếu với tới được).
- Update `tests/e2e/runner-setup.spec.ts`: thay assertion placeholder cũ (difficulty chip…) bằng assertion của màn game (giữ "Câu 1 / 12" nếu HUD giữ copy đó; bỏ assertion phụ thuộc placeholder).

## 6. Reuse / ràng buộc

- Reuse: `cn`, design tokens/classes hiện có, `Heart` (lucide-react), `getRunnerDifficultyConfig` + `runnerDifficultyLabel` (Task 3), engine Task 2, `statistics/utils/streak.ts` (đọc trước; **tái sử dụng, không duplicate** logic streak).
- Module mascot mới: `src/features/mascot/` (types + `levelFromStreak` + `mascotAssetPath` + server loader `loadMascotLevel` — pure utils có unit test).
- KHÔNG: deps mới, AI, DB, sửa `runner-state.ts`/`config.ts`/`runner-difficulty.ts`/`types/runner-types.ts` (engine), sửa `mode-filter`/`source-browser` v.v.
- `RunnerSessionPlaceholder` bị xóa.

## 7. Files dự kiến

```text
src/features/runner/components/runner-session.tsx        (client, orchestration)
src/features/runner/components/runner-canvas.tsx         (canvas + rAF + physics + draw)
src/features/runner/components/runner-hud.tsx            (thuần)
src/features/runner/components/runner-bottom-label.tsx   (thuần)
src/features/runner/components/runner-start-overlay.tsx  (thuần)
src/features/runner/components/runner-paused-overlay.tsx (thuần)
src/features/runner/components/runner-end-overlay.tsx    (thuần)
src/features/runner/art/runner-character.ts              (vẽ mascot: preload + drawImage + state run/happy/sad)
src/features/runner/utils/format-runner-time.ts
src/features/runner/utils/collision.ts
src/features/mascot/types/mascot-types.ts                 (MascotLevel 1–5, MascotState, thresholds [0,30,60,120,240])
src/features/mascot/utils/mascot-level.ts                 (levelFromStreak — pure, test)
src/features/mascot/utils/mascot-asset.ts                 (mascotAssetPath(level, state) → "/mascot/level-N/state.png" — pure, test)
src/features/mascot/server/load-mascot-level.ts           (server: đọc records → streak (reuse statistics) → level)
src/components/layout/app-chrome.tsx                     (client, ẩn chrome theo pathname)
src/components/layout/app-shell.tsx                      (refactor tối thiểu)
src/app/(app)/runner/session/page.tsx                    (render <RunnerSession questions difficulty mascotLevel />)
XÓA src/features/runner/components/runner-session-placeholder.tsx
tests/unit/features/runner/{format-runner-time,collision,runner-hud,runner-end-overlay,runner-session}.test.ts(x)
tests/unit/features/mascot/{mascot-level,mascot-asset}.test.ts
tests/e2e/runner-gameplay.spec.ts (mới) · tests/e2e/runner-setup.spec.ts (cập nhật)
```

## 8. Verification

```bash
npx vitest run tests/unit/features/runner
npm run check
npx playwright test runner-setup runner-gameplay   # cần local Supabase (scripts/test-e2e-local.mjs)
```

## 9. Diff review

- Không DB / AI / deps / assets; không sửa engine Task 2; placeholder đã xóa; app-shell refactor tối thiểu (các trang khác không đổi hành vi); không `Date.now()` trong pure utils; rAF/listener/observer cleanup đầy đủ (StrictMode-safe); không reshuffle choices; không lộ lỗi kỹ thuật.

## 10. Commit

```bash
git add src/features/runner src/features/mascot src/components/layout tests/unit/features/runner tests/unit/features/mascot tests/e2e/runner-gameplay.spec.ts tests/e2e/runner-setup.spec.ts public/mascot
git commit -m "feat: add runner gameplay canvas session"
```

Push chỉ khi: baseline trên origin/main, mọi gate pass, không thay đổi bất ngờ shared system (app-shell là shared — diff phải tối thiểu). Nếu nghi ngờ: không push.

## 11. Evidence report

- Repository: starting/final commit, push status, worktree.
- Gameplay: mô tả luồng start → chơi → pause → kết thúc; cách engine được nối (event dispatch, itemSeq).
- Tests: files/discovered/passed/failed/skipped (unit + E2E).
- Files changed (từng file + mục đích; ghi rõ app-shell diff).
- Safety: migrations NO; DB NO; deps NO; env NO; AI NO; assets NO; production NO.
- Ambiguities; Verdict: `EVIDENCE READY FOR REVIEW` / `INCOMPLETE — BLOCKER REQUIRES USER DECISION`.
