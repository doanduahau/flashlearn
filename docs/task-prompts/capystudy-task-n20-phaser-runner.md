# Task N20 — Tích hợp Phaser (Official) vào màn Runner

## Loại task

**Mức 3 — Phức tạp / Quan trọng.** Thay engine gameplay hiện có (canvas 2D tự viết) bằng **Phaser (engine chính thức)**, chỉ trong vùng gameplay. Không chạm DB/security nhưng rủi ro regress gameplay lõi → cần **review độc lập (Sol)** sau khi Terra làm xong.

## Baseline

- Branch: `main`
- Baseline commit: `4527c7a` ("fix: replace remaining visible loading texts with loading dots" — N19b, đã push, main đồng bộ origin/main).
- Chỉ làm đúng phạm vi task này.

## Bối cảnh

Màn Runner (`/runner/session`) hiện dùng engine canvas 2D tự viết trong `src/features/runner/components/runner-canvas.tsx` (rAF + `CanvasRenderingContext2D`, gravity/jump/collision tính tay, sprite mascot blit, emoji food). Người dùng yêu cầu chuyển vùng gameplay sang **Phaser chính thức** (Arcade Physics) nhưng **giữ nguyên mọi thứ khác**: state machine, UI (timer/lives/câu hỏi/progress), lives theo difficulty, timer đếm lên, server actions, API props.

## Quyết định đã chốt (lock)

1. **Phaser chỉ phụ trách vùng gameplay**: nhân vật, vật thể đáp án (food), movement, jump/gravity, collision, animation (run/happy/sad), effects (burst đúng/sai). Mọi thứ khác giữ nguyên framework hiện tại.
2. **Vật thể đáp án giữ nguyên visual**: item bay chỉ là emoji trái cây 🍌🍊🍎 (theo `itemSeq % 3`) như hiện tại; **chữ đáp án active KHÔNG hiển thị trên item** — vẫn ở `RunnerBottomLabel` (React), không đổi.
3. **Dùng Phaser Arcade Physics**. Gameplay không phụ thuộc FPS (chuyển động theo vận tốc px/s, delta thời gian thực).
4. **Không cập nhật React state mỗi frame**: scene chỉ đọc `stateRef.current`; mọi thay đổi state đi qua `dispatch` (giữ nguyên cơ chế `displayEqual` throttling của `runner-session.tsx`). Scene **không được** gọi `setState`/`setDisplay` trực tiếp.
5. **Cleanup Phaser đúng cách**: destroy game khi unmount, an toàn StrictMode double-mount, responsive/resize (RESIZE + ResizeObserver), tôn trọng `prefers-reduced-motion`.
6. **Giữ nguyên hành vi gameplay hiện tại**: jump chỉ nhảy khi grounded (JUMP trong reducer chỉ chuyển `grounded→airborne`); LAND khi chạm đất. Bỏ qua hiệu ứng "bounce tự động khi ấn Jump giữa không" của canvas cũ (đây là hệ quả phụ, không phải ý định) — ghi rõ trong report nếu quan sát được khác biệt nhỏ.
7. Chỉ thêm dependency: `phaser` (latest stable 3.x, ghi chính xác version). Không dùng template/plugin bên thứ ba; tham khảo Phaser official docs/examples.

## Phạm vi

### 1. Dependency

- Cài `phaser` (latest stable 3.x) vào `dependencies`. Client-only — chỉ import trong component `"use client"`.

### 2. Game module mới (thư mục `src/features/runner/game/`)

- `runner-scene.ts` — lớp `RunnerScene extends Phaser.Scene`:
  - Đọc `stateRef.current` mỗi frame; dispatch các event qua prop `dispatch`.
  - **TICK**: gửi `{ type: "TICK", deltaMs }` với delta **thời gian thực** (performance.now, clamp `MAX_DELTA_MS = 50` như hiện tại) — reducer tự cộng `elapsedMs`; React re-render vẫn bị throttle bởi `displayEqual` (giữ nguyên như hôm nay).
  - **Spawn item**: khi `status === "playing"` và `state.itemSeq !== spawnedSeq` → đặt item về mép phải (`x = cssWidth + FOOD_SIZE/2`), vận tốc `-speed` (px/s). `speed = calculateRunnerSpeed(cssWidth, timePerItemMs) * 1000`. Emoji theo `FRUIT_EMOJIS[itemSeq % 3]` (render bằng `Phaser.Text`, đẹp trên hi-dpi).
  - **Collision**: body nhân vật = 60% sprite (offset 20%, giống hitbox cũ), body item = full `FOOD_SIZE`. Overlap → `dispatch({ type: "HIT_ACTIVE_ITEM", itemSeq: state.itemSeq })`; item qua khỏi character (right < character left) → `dispatch({ type: "PASS_ACTIVE_ITEM", itemSeq: state.itemSeq })`. Chỉ fire 1 lần cho mỗi `itemSeq` (guard bằng `spawnedSeq`).
  - **Jump**: body có gravity (≈1800 px/s²) + `setVelocityY(-JUMP_VELOCITY)` (≈750 px/s, cảm giác tương đương `GRAVITY 0.0018`/`JUMP_VELOCITY 0.75` px/ms). Chỉ impulse khi `jumpState === "airborne"` và đang đứng trên đất; `dispatch({ type: "LAND" })` khi body chạm đất (`blocked.down`) và `jumpState === "airborne"`. Chống impulse trùng (flag mỗi lần airborne).
  - **Character texture**: load `/mascot/level-{mascotLevel}/run.png|happy.png|sad.png` (dùng `mascotAssetPath`), `setTexture` theo trạng thái: run mặc định; happy/sad 600ms sau mỗi feedback (giữ `CHARACTER_STATE_MS`), đúng như canvas cũ.
  - **Feedback burst**: khi `state.feedback` thay đổi (khác `lastFeedback`) → vẽ vòng tròn màu `#65be91` (correct) / `#ef8585` (wrong) tại vị trí item, `BURST_MS = 300`, alpha 0.5; bỏ qua khi `prefers-reduced-motion`.
  - **Nền**: giữ đúng visual hiện tại — chỉ có đường ground (`#eaddcb`, lineWidth 2) ở `groundY = cssHeight - BOTTOM_MARGIN`, không thêm hiệu ứng/sky.
  - **Freeze khi không playing**: khi `status` là `ready`/`paused`/`game-over`/`completed` → vận tốc item = 0, nhân vật đứng yên, không dispatch TICK; scene vẫn render frame cuối (giống canvas cũ).
- `create-runner-game.ts` — factory `createRunnerGame(container, opts)`:
  - `Phaser.Game` config: `type: Phaser.AUTO`, `parent: container`, `scale: { mode: Phaser.Scale.RESIZE, ... }`, physics Arcade, resolution theo `window.devicePixelRatio` (canvas không bị mờ trên hi-dpi).
  - Truyền `stateRef`, `dispatch`, `difficulty`, `mascotLevel` vào scene (qua constructor scene instance).
- `runner-geometry.ts` — các hàm thuần (để unit test): `characterX(width)`, `groundY(height)`, `itemTopY(height)`, `itemVelocityPxPerSec(width, timePerItemMs)` (wrapper của `calculateRunnerSpeed * 1000`), hitbox constants. **Không** lặp magic number.

### 3. `src/features/runner/components/runner-canvas.tsx` — viết lại

- **GIỮ NGUYÊN** signature component: `{ stateRef, dispatch, difficulty, mascotLevel }` (vì `runner-session.tsx` truyền đúng 4 props này và `tests/unit/features/runner/runner-session.test.tsx` mock module `@/features/runner/components/runner-canvas`).
- `useEffect`: tạo game qua `createRunnerGame(containerRef.current, ...)`; ResizeObserver trên container → gọi layout lại (world bounds, ground, character x, item y); cleanup = `game.destroy(true)` + disconnect observer. Guard `typeof window === "undefined"`.
- Giữ `<div ref={containerRef} className="absolute inset-0" />` (Phaser tự tạo `<canvas>` bên trong) để E2E `page.locator("canvas")` vẫn hoạt động.

### 4. Dọn dead code (chỉ code bị Phaser thay thế)

- Xóa `src/features/runner/art/runner-character.ts` (drawRunnerCharacter/preloadRunnerCharacter không còn dùng) + `src/features/runner/utils/collision.ts` + `tests/unit/features/runner/collision.test.ts`.
- GIỮ NGUYÊN: `runner-state.ts` + test (reducer không đổi), `runner-difficulty.ts` + test (`calculateRunnerSpeed` tái sử dụng), `config.ts`, types, server actions, HUD/overlays/bottom-label, `runner-session.tsx`.

### 5. Tests

- Unit test mới cho `runner-geometry.ts` (hàm thuần).
- Đảm bảo `runner-session.test.tsx` (mock canvas) + `runner-state.test.ts` + `runner-difficulty.test.ts` vẫn xanh — **không sửa** nếu không cần.
- E2E `runner-gameplay.spec.ts`: không cần sửa (vẫn check `canvas` visible + timer). Chạy lại và ghi kết quả.

## Ngoài phạm vi

- KHÔNG đổi `runner-state.ts`, `runner-session.tsx`, `config.ts`, types, `runner-difficulty.ts` (trừ khi bắt buộc, phải nêu lý do).
- KHÔNG đổi HUD, overlays, bottom label, exit dialog, server actions, RPC, database, design tokens.
- KHÔNG sửa `auth-helpers.ts` (lỗi pre-existing, chỉ ghi nhận).
- KHÔNG cài thêm dependency ngoài `phaser`.
- KHÔNG thêm tính năng mới (không có item text, không có âm thanh, không có background mới).

## Acceptance criteria

1. `npm run check` xanh: lint 0 lỗi, typecheck PASS, vitest PASS (không ít hơn baseline 1254 PASS), build PASS.
2. Grep không còn `drawRunnerCharacter`/`rectsOverlap`/`preloadRunnerCharacter`/`runner-character`/`utils/collision` (trừ commit history).
3. `RunnerCanvas` giữ nguyên props contract; module path `@/features/runner/components/runner-canvas` giữ nguyên.
4. Scene không chứa bất kỳ `setState`/`useState`/React import nào (chỉ `Phaser` + types); mọi state change qua `dispatch`.
5. E2E `runner-gameplay` vẫn đi qua được ở bước auth (fail pre-existing `auth-helpers.ts:20` nếu có phải ghi rõ, không phải lỗi mới).
6. Manual check (báo trong report): game khởi động/hủy sạch khi vào/thoát trang (không leak canvas), nhảy ăn item hoạt động, sai mất mạng/đúng sang câu, responsive khi đổi viewport, không nhấp nháy lúc load texture.

## Verification bắt buộc

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

E2E (nếu Docker/môi trường sẵn sàng): `npm run test:e2e` — ít nhất `runner-gameplay`. Ghi rõ fail nào là pre-existing (auth helper).

## Constraints

- Không dùng `any`/`@ts-ignore`/cast tùy tiện. Không dùng non-null `!` trừ khi thật sự cần.
- Không dùng `--no-verify` khi commit. Không dùng `git add .` mù quáng — stage đúng file của task.
- Không đổi design direction, không đổi màu/token.
- Phaser import chỉ trong client boundary; không để Phaser bundle vào server.
- Nếu cần tune số vật lý (gravity/jump) để cảm giác nhảy tới được food, giải thích giá trị mới trong report.

## Report cuối task

- Summary.
- Files changed (thêm/sửa/xóa).
- Dependency đã cài (tên + version chính xác của phaser).
- Verification từng lệnh + kết quả E2E (ghi rõ pre-existing).
- Remaining issues (vd: cảm giác vật lý cần tinh chỉnh, bundle size tăng).
- Commit hash + message.
