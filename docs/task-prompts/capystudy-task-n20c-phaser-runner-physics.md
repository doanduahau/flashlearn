# Task N20c — Fix Runner physics: enable Arcade bodies (item không chạy + jump chết)

## Loại task

**Mức 3 — Hotfix sau deploy.** Lỗi runtime đã root-cause từ Phaser source. Fix 2 dòng, không đổi gì khác.

## Baseline

- Branch: `main`
- Baseline commit: `0f71f3c` (N20b đã push, HEAD = origin/main).
- Tạo commit mới trên `0f71f3c`, KHÔNG push (chờ verify).

## Bối cảnh

User báo trên production: **jump không hoạt động + không có item chạy**. Timer vẫn chạy (E2E vẫn pass vì chỉ check canvas + timer).

## Root cause (đã verify từ `node_modules/phaser`)

`src/features/runner/game/runner-scene.ts` `create()` chỉ gọi `this.physics.add.overlap(...)` mà **không tạo body cho game object**:

- `Factory.overlap` → `World.addOverlap` → tạo `Collider`, **không gọi `enableBody`** (`Factory.js:95-98`, `World.js:859-870`).
- `World.collideHandler` chỉ xử lý khi `object1.body || object1.isBody` và `object2.body || object2.isBody` (`World.js:1950-1953`). Không body → overlap không fire.
- `charSprite` được tạo bằng `this.add.image(...)` (không qua `physics.add.image`), `foodText` bằng `this.add.text(...)` → **cả hai không có `.body`**.
- Hệ quả: mọi `if (charBody)` / `if (foodBody)` trong scene đều sai (`body === undefined`) → không set velocity → item không chạy, không jump impulse, không HIT. Cast `as Phaser.Physics.Arcade.Body` + guard `if (charBody)` che nullability nên typecheck/unit không bắt được.

## Phạm vi — fix trong `src/features/runner/game/runner-scene.ts` `create()`

Thêm **2 dòng** để bật body dynamic cho cả 2 game object, ĐẶT TRƯỚC `this.physics.add.overlap(...)`:

```typescript
// Sau khi tạo charSprite + foodText (sau setDisplaySize / setOrigin, trước overlap):
this.physics.add.existing(this.charSprite);
this.physics.add.existing(this.foodText);
```

- `physics.add.existing` → `World.enableBody` (`Factory.js:113-120`) tạo dynamic body; kích thước body = display size tại thời điểm enable (char 100×120, food theo text bounds).
- Các đoạn `setSize/setOffset` (hitbox 60×72 + offset 20×24 cho char, 44×44 cho food) và `setVelocity` hiện có sẽ tự kích hoạt vì `.body` giờ tồn tại — **KHÔNG sửa lại** logic đó.
- Không đổi file khác.

## Ngoài phạm vi

- Không đổi `runner-state.ts`, `runner-session.tsx`, HUD/overlays, config, types, difficulty, server actions.
- Không thêm dependency. Không migration.
- Không "tối ưu thêm" — chỉ thêm 2 dòng `existing`.

## Acceptance criteria

1. `npm run check` xanh (lint 0 lỗi, typecheck PASS, vitest không fail, build PASS).
2. Static: `rg -n "physics.add.existing" src/features/runner/game` → 2 dòng, đặt trước `physics.add.overlap`; không thay đổi code khác (diff chỉ +2 dòng, hoặc +2 dòng + whitespace).
3. **Browser check (bắt buộc — user gặp lỗi thật trên production):** vào `/runner/session`, verify:
   - Item (emoji trái cây) **chạy từ phải qua trái** khi bắt đầu.
   - Jump hoạt động (tap/space/arrow) — nhân vật nhảy lên chạm item.
   - Ăn đúng → câu kế; ăn sai → mất mạng; bỏ lỡ → đáp án kế.
   - Hitbox: ăn được item khi chạm ~vùng giữa-thân nhân vật.
     Ghi rõ kết quả từng mục trong report (nếu không có môi trường browser, nói rõ để coordinator tự smoke test).

## Verification bắt buộc

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Constraints

- Không `any`/`@ts-ignore`. Không `--no-verify`. Stage đúng file.
- Không push — commit `fix: enable arcade physics bodies in runner scene` rồi gửi evidence.

## Report cuối task

- Summary.
- Files changed (diff đầy đủ).
- Verification từng lệnh + kết quả browser check.
- Remaining issues.
- Commit hash + message.
