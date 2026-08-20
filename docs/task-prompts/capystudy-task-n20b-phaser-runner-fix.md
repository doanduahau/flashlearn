# Task N20b — Fix Phaser Runner bugs (A scale / B-C position / D speed / E hitbox / F load)

## Loại task

**Mức 3 — Sửa lỗi sau review độc lập (Sol — REQUIRE-CHANGES).** Fix có hướng dẫn cụ thể; xong commit → **Sol re-review nhanh** trước khi push.

## Baseline

- Branch: `main`
- Baseline commit: `7522e92` ("feat: integrate Phaser into runner gameplay" — N20, đã commit, **chưa push**, main ahead 1).
- Fix phải tạo **commit mới** trên `7522e92` (không amend, không sửa commit cũ).

## Bối cảnh

N20 đã verified gates xanh (lint 0/36w, typecheck PASS, vitest 1267 PASS + 7 skip, build PASS) nhưng Sol review xác nhận 5 lỗi runtime trong `src/features/runner/game/runner-scene.ts`. Các lỗi chỉ hiện khi chạy browser — unit/component test (mock canvas, geometry thuần) không bắt được. **1 điểm hiệu đính quan trọng:** Sol báo "body 32×32" là **sai** — `Phaser.Physics.Arcade.Body` constructor lấy `gameObject.displayWidth` (Body.js dòng 59-62) nên body = **100×120** (setDisplaySize đã chạy trước khi `physics.add.overlap` enable body). Hệ quả thực: hitbox = full sprite (lớn hơn hitbox cũ 60% 60×72 — lệch tuning, không phải 32×32). Hướng fix (setSize 60×72 + setOffset) vẫn đúng.

## Các lỗi đã xác nhận (fix theo mục)

### A — CRITICAL: Scale nổ khi swap texture mascot (`runner-scene.ts:76-78, 208-211, 259-263`)

- `setDisplaySize(100,120)` áp trên `__DEFAULT` (32×32) → `scaleX=3.125, scaleY=3.75`. `setTexture()` đổi frame nhưng **giữ nguyên scale** → mascot 1254×1254 render ~3918×4702px.
- `update()` gọi `setTexture(texKey)` mỗi frame mà không áp lại display size.
- **Fix:** sau MỖI `setTexture`, gọi lại `setDisplaySize(CHARACTER_WIDTH, CHARACTER_HEIGHT)`. Tối ưu: chỉ `setTexture` khi `texKey` thay đổi (track `lastTexKey`) để tránh setTexture mỗi frame.

### B/C — CRITICAL: Vị trí nhân vật sai (body.x/body.y set trực tiếp)

- `charBody.x = cx + CHARACTER_WIDTH/2` + `charBody.y = gy - CHARACTER_HEIGHT/2` — cộng/trừ như thể body position là center nhưng `body.x/y` là **top-left**. Body 100×120:
  - Y: `body.y = gy-60` → bottom = `gy+60` → nhân vật **chìm 60px dưới ground line** (Sol ghi "floats 28px" do nhầm body 32px — bỏ qua).
  - X: mutate body trực tiếp + delta-sync làm sprite lệch khỏi vị trí 30% (độ lệch phụ thuộc scale tại lúc enable body).
- **Fix (đúng chuẩn Phaser):** KHÔNG mutate `body.x/body.y`. Dùng vị trí game object làm nguồn sự thật:
  - `const centerX = geoCharacterX(w) + CHARACTER_WIDTH / 2;` (center 30% width)
  - `const centerY = gy - CHARACTER_HEIGHT / 2;` (center sao cho feet chạm ground line)
  - `this.charSprite.setX(centerX);` mỗi frame.
  - Clamp: `if (this.charSprite.y >= centerY) { this.charSprite.setY(centerY); charBody.setVelocityY(0); if (state.jumpState === "airborne" && !lastGrounded) dispatch LAND; lastGrounded = true; } else lastGrounded = false;`
  - Jump: `charBody.setVelocityY(-JUMP_VELOCITY_PX_S)` khi `playing && jumpState==="airborne" && lastGrounded` (giữ flag `lastGrounded=false` sau khi bắn impulse).
- Sau fix, verify bằng phép tính: feet của sprite (centerY + 60) phải == `gy`.

### D — Significant: `this.speed` không cập nhật khi resize (`runner-scene.ts:98`)

- Speed tính 1 lần ở `create()` với width ban đầu; khi resize/rotate (ResizeObserver → `game.scale.resize`) item đi ngang với thời gian sai.
- **Fix:** tính lại `this.speed = itemVelocityPxPerSec(Math.max(w, 1), this.timePerItemMs)` **trong `update()` trước khi dùng** (hoặc tại thời điểm spawn item mới).

### E — Significant: Hitbox sai so với cũ

- Body = full 100×120 (mặc định từ `displayWidth`). Hitbox cũ = 60% (60×72, offset 20% 20×24). Hằng số `CHARACTER_HITBOX_OFFSET/RATIO` đã có trong `runner-geometry.ts` nhưng **chưa dùng**.
- **Fix:** sau khi enable body (trong `create()`), gọi:
  - Character: `charBody.setSize(60, 72)` + `charBody.setOffset(20, 24)`.
  - Food: `foodBody.setSize(FOOD_SIZE, FOOD_SIZE)` (body food mặc định theo text bounds — set về 44×44 cho khớp hitbox cũ).
- Nếu `setSize/setOffset` có tương tác với `setPosition` sync (offset áp từ top-left sprite), verify overlap vẫn hoạt động khi chạy browser.

### F — Minor: Không xử lý load error texture (`runner-scene.ts:258-272`)

- Chỉ lắng nghe `filecomplete` của `keys[0]`; nếu ảnh fail, nhân vật kẹt `__DEFAULT` (ô vuông) vĩnh viễn.
- **Fix:** thêm handler lỗi (`loaderror`) ghi console.warn + fallback an toàn (giữ `__DEFAULT` nhưng không crash). Dọn logic `keys.length > 0` cho rõ (chỉ push key chưa tồn tại, xử lý trường hợp tất cả đã có).

## Ngoài phạm vi

- Không đổi `runner-state.ts`, `runner-session.tsx`, `config.ts`, types, server actions, HUD/overlays, difficulty config.
- Không sửa migration/DB. Không cài dependency mới.
- **Không** sửa `characterHitbox()`/`rectsOverlap()` trong `runner-geometry.ts` trừ khi task yêu cầu (hiện dead code nhưng có test — giữ nguyên để tránh chạm test; có thể ghi chú trong report).

## Acceptance criteria

1. `npm run check` xanh (lint 0 lỗi, typecheck PASS, vitest không fail, build PASS).
2. Static check cho thấy:
   - Không còn `setDisplaySize` chỉ áp trên `__DEFAULT` — mọi `setTexture` đều có `setDisplaySize` theo sau (hoặc texture được setDisplaySize lại đúng 100×120).
   - Không còn mutate `charBody.x/charBody.y` trực tiếp — chỉ `setX/setY` trên sprite + `setVelocityY` trên body.
   - `this.speed` được tính lại theo width hiện tại.
   - Body character có `setSize(60,72)` + `setOffset(20,24)`; body food có `setSize(44,44)`.
3. Bổ sung/điều chỉnh unit test nếu tách logic thuần mới (vd: function tính centerY/centerX) — không bắt buộc nếu fix thuần trong scene (chỉ note trong report).
4. Manual/browser check (bắt buộc ghi trong report — Sol sẽ không duyệt nếu thiếu): vào `/runner/session`, verify:
   - Nhân vật mascot hiển thị đúng 100×120, đứng **trên** ground line, vị trí ~30% chiều rộng.
   - Nhảy ăn item hoạt động; sai mất mạng/đúng sang câu; burst đúng/sai hiện.
   - Đổi viewport (desktop↔mobile / rotate) → item vẫn đi ngang đúng nhịp difficulty, nhân vật không lệch.
   - Vào/thoát trang nhiều lần (kể cả StrictMode dev) → không leak canvas, không crash.

## Verification bắt buộc

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

E2E `runner-gameplay` nếu môi trường sẵn sàng (ghi fail pre-existing nếu có — auth helper `auth-helpers.ts:20`).

## Constraints

- Không `any`/`@ts-ignore`/cast tùy tiện. Không `--no-verify`. Stage đúng file.
- Fix đúng những gì liệt kê trên; không refactor thêm ngoài phạm vi.
- Không push — tạo commit `fix: correct Phaser runner sprite scale, position and hitbox` rồi gửi evidence.

## Report cuối task

- Summary.
- Files changed (diff từng lỗi A→F).
- Verification từng lệnh + kết quả browser check.
- Remaining issues.
- Commit hash + message.
