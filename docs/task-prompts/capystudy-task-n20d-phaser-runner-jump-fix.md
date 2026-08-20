# Task N20d — Fix Runner jump: stale-state auto-bounce (nhấn nhảy lúc được lúc không)

## Loại task

**Mức 3 — Hotfix sau deploy.** Bug runtime đã root-cause từ code. Fix 1-3 dòng trong scene, không đổi gì khác.

## Baseline

- Branch: `main`
- Baseline commit: `bfef56c` (N20c đã push — HEAD = origin/main).
- Tạo commit mới trên `bfef56c`, KHÔNG push (chờ verify).

## Bối cảnh

Sau N20c (bật Arcade bodies), user báo: **nhấn để nhảy lúc được lúc không**. Jump có chạy nhưng hay bị "nuốt" tap.

## Root cause (đã verify từ code)

`src/features/runner/game/runner-scene.ts` `update()`:

- Dòng 127: `const state = this.data_.stateRef.current;` — **snapshot đọc 1 lần** đầu frame.
- Dòng 192-195 (khối clamp khi hạ cánh): khi `charSprite.y >= centerY`:
  - `dispatch({ type: "LAND" })` — `dispatch` trong `runner-session.tsx:108-117` là **đồng bộ**: `stateRef.current` lập tức trở thành `jumpState: "grounded"`.
  - `this.lastGrounded = true`.
- Dòng 205-211 (khối jump impulse): điều kiện `state.jumpState === "airborne" && this.lastGrounded` dùng **snapshot cũ** — trên đúng frame hạ cánh, snapshot vẫn còn `"airborne"` trong khi `lastGrounded` vừa được set `true` → **setVelocityY(-750) tự động, không cần người dùng nhấn**.

Hệ quả:

1. Sau mỗi lần nhảy thật, nhân vật **tự nảy thêm 1 nhịp** (~0.83s bay).
2. Trong nhịp nảy đó `jumpState` là `"grounded"` (LAND đã chạy) → nếu user nhấn: `JUMP` được reducer chấp nhận (grounded→airborne) nhưng `lastGrounded` = false → impulse bị skip → **tap bị nuốt, không có phản hồi nhảy**. Đúng triệu chứng "lúc được lúc không".

## Root cause #2 (verify từ E2E debug hook — ĐÃ XÁC NHẬN TRÊN THỰC TẾ)

Ngoài auto-bounce, còn một nguyên nhân thứ hai khiến tap bị nuốt ở đầu phiên:

- `create()`: `this.charSprite = this.add.image(0, 0, "__DEFAULT");` — sprite sinh ra tại **góc trên trái canvas (0,0)**.
- Khối clamp trong `update()` CHỈ đẩy nhân vật lên khi `y >= centerY` (đang thấp hơn mặt đất). Không có cơ chế kéo nhân vật XUỐNG mặt đất lúc khởi đầu.
- Vì vậy mỗi phiên, nhân vật **rơi tự do ~0.8s** từ đỉnh màn hình xuống mặt đất (sinh tại y=0, rơi 558px với gravity 1800px/s² → ~0.79s).
- Trong suốt khoảng rơi này `lastGrounded = false` → impulse không bao giờ bắn dù `jumpState` thành `"airborne"`. Mọi JUMP dispatch bị nuốt (jumpState về "grounded" khi chạm đất). Người dùng nhấn trong ~0.8s đầu không có phản hồi — đóng góp trực tiếp vào "lúc được lúc không".

Evidence từ debug hook (sprite `x:117, y:318.5, bodyVelY:1080, grounded:false, jumpState:"grounded"` — nhân vật đang rơi giữa phiên; sau khi dispatch JUMP, `jumpState:"airborne"` nhưng `grounded` vẫn `false` → impulse skip → nhân vật chạm đất, JUMP bị mất).

## Phạm vi — fix TRONG `src/features/runner/game/runner-scene.ts`

### Fix A — spawn nhân vật tại mặt đất (sửa `create()`)

Khi tạo sprite, đặt vị trí ngay tại mặt đất thay vì (0,0):

```typescript
// Trong create(), sau khi có w/h:
const centerX = geoCharacterX(w) + CHARACTER_WIDTH / 2;
const centerY = geoGroundY(h) - CHARACTER_HEIGHT / 2;
this.charSprite = this.add.image(centerX, centerY, "__DEFAULT");
```

- `geoCharacterX`/`geoGroundY` đã import sẵn ở đầu file.
- `lastGrounded` đã default `true` → ngay frame đầu, impulse bắn được nếu user nhấn.
- KHÔNG đổi khối clamp — nó vẫn giữ nhân vật ở mặt đất khi hạ cánh.

### Fix B — impulse đọc state LIVE (sửa khối jump impulse trong `update()`)

Chỉ thay điều kiện impulse (khối jump impulse, ~dòng 205) để đọc **state LIVE** thay vì snapshot:

```typescript
// Trước đây:
// if (state.status === "playing" && state.jumpState === "airborne" && this.lastGrounded) {
// Thành:
const liveState = this.data_.stateRef.current;
if (liveState.status === "playing" && liveState.jumpState === "airborne" && this.lastGrounded) {
  const body = this.charSprite.body as Phaser.Physics.Arcade.Body;
  if (body) {
    body.setVelocityY(-JUMP_VELOCITY_PX_S);
  }
  this.lastGrounded = false;
}
```

- Vì `LAND` đã cập nhật `stateRef.current` đồng bộ trước đó trong cùng frame, impulse giờ đọc `"grounded"` → **không nảy tự động**. Tap thật vẫn đặt `"airborne"` đồng bộ nên jump vẫn bắn đúng.
- KHÔNG sửa khối clamp/LAND, KHÔNG sửa logic khác. Không refactor.

### LƯU Ý QUAN TRỌNG — dọn TEMP DEBUG

Trong working tree, `src/features/runner/game/runner-scene.ts` hiện có **khối TEMP DEBUG** ở cuối `update()` (đọc `globalThis.__runnerDbg`) do coordinator chèn để điều tra. **PHẢI XÓA khối này** trước khi commit — nó chỉ phục vụ chẩn đoán, không được vào production. Commit cuối cùng chỉ gồm Fix A + Fix B.

## Ngoài phạm vi

- Không đổi `runner-state.ts`, `runner-session.tsx`, HUD/overlays, types, difficulty, server actions.
- Không thêm dependency. Không migration.
- Không "tối ưu thêm".

## Acceptance criteria

1. `npm run check` xanh (lint 0 lỗi, typecheck PASS, vitest không fail, build PASS).
2. Static: diff chỉ gồm Fix A (vị trí spawn trong `create()`) + Fix B (khối impulse đọc `stateRef.current` live); **không còn khối TEMP DEBUG**; không thay đổi code khác.
3. **Browser check (bắt buộc):** vào `/runner/session`:
   - Ngay sau "Chạm để bắt đầu", nhân vật **đứng sẵn ở mặt đất** (KHÔNG rơi từ trên trời).
   - Nhảy 1 lần → nhân vật bay lên rồi **hạ cánh và đứng yên** (KHÔNG tự nảy tiếp).
   - Nhấn liên tục: mỗi lần nhân vật đang ở mặt đất thì nhảy ngay; không còn tap bị nuốt (không có cửa sổ 0.83s nuốt tap sau mỗi jump, không có cửa sổ ~0.8s rơi ban đầu).
   - Chạm item vẫn hoạt động như N20c.
     Ghi rõ kết quả từng mục.

## Verification bắt buộc

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Constraints

- Không `any`/`@ts-ignore`. Không `--no-verify`. Stage đúng file.
- Không push — commit `fix: use live state for runner jump impulse` rồi gửi evidence.

## Report cuối task

- Summary.
- Files changed (diff đầy đủ).
- Verification từng lệnh + kết quả browser check.
- Remaining issues.
- Commit hash + message.
