# CapyStudy Task N3 — Runner: thức ăn bay trên cao + nhảy lên chạm là ăn được + nhanh hơn

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `2069f4a` (đã push, main đồng bộ origin/main)
- `Agent tier`: DeepSeek Flash + Gemini (gameplay — không review riêng; coordinator verify)
- `Commit message` (1 commit duy nhất): `feat: rework runner to catch food in the sky`
- `Push`: KHÔNG push — gửi evidence report

## 1. Yêu cầu (từ user, đã chốt)

> "Capy runner đang hoạt động khá tốt, thay đổi cơ chế 1 chút: hiện tại chướng ngại vật đang ở trên đường chạy và mascot phải nhảy qua -> sửa lại cho chướng ngại vật lên trên, nhảy lên chạm vào thì tính. giảm thời gian chướng ngại vật đi tới (tức là cảm giác chạy nhanh hơn), giảm thời gian mascot nhảy lên và rơi xuống."

**Chốt với user:** thức ăn/chướng ngại di chuyển ở PHÍA TRÊN; mascot nhảy LÊN chạm vào là **ĂN ĐƯỢC** (tính đúng); không chạm → bỏ lỡ. Tốc độ nhanh hơn + nhảy nhanh hơn.

## 2. Hiện trạng (đã rà)

- `src/features/runner/components/runner-canvas.tsx`: `JUMP_VELOCITY = 0.55`, `GRAVITY = 0.0008` (thời gian bay ≈ 2×0.55/0.0008 ≈ 1375ms, đỉnh ≈ 189px); food di chuyển ngang tại `foodY = groundY() - FOOD_SIZE` (sát mặt đất); character đứng trên ground, **nhảy lên để TRÁNH chạm food**; `HIT_ACTIVE_ITEM` (chạm) = chọn đáp án active, `PASS_ACTIVE_ITEM` (food bay qua) = chuyển đáp án active
- `src/features/runner/config.ts`: `RUNNER_DIFFICULTY_CONFIGS = { easy: {lives:3, timePerItemMs:4500}, medium: {lives:2, timePerItemMs:3200}, hard: {lives:1, timePerItemMs:2400} }` — comment ghi "frozen" (chỉ đổi timePerItemMs + lives)
- `src/features/runner/utils/runner-difficulty.ts`: `calculateRunnerSpeed(distancePx, timePerItemMs)` — tốc độ = khoảng cách/timePerItemMs
- Semantics giữ nguyên: chạm food = HIT (đúng nếu active answer đúng, sai → mất 1 mạng), food bay qua = PASS (chuyển active answer). **KHÔNG đổi runner-state.ts logic chấm điểm**

## 3. Thiết kế chi tiết

### 3.1. Vị trí thức ăn — bay trên cao

- Food di chuyển ngang ở **độ cao cố định phía trên** (không còn sát mặt đất). Đề xuất: `foodY = skyLevel` với `skyLevel = groundY() - FOOD_SIZE - skyHeight`, `skyHeight` ~ 55–65% chiều cao màn (tức food nằm khoảng giữa trên của màn; mascot phải nhảy lên mới chạm). **Chọn hằng số để mascot khi nhảy đạt đỉnh VỪA chạm food** (đỉnh nhảy ~ bằng foodY + FOOD_SIZE).
- Vẽ: food vẫn là hình tròn (đổi màu nếu cần phân biệt — giữ #f3a66a hoặc chọn màu nổi trên nền trời; tùy agent, không đổi palette chủ đạo)
- Có thể vẽ thêm nền "trời" nhẹ phía trên (không bắt buộc) — ưu tiên tối giản

### 3.2. Vật lý nhảy — nhanh hơn

Mục tiêu: **giảm thời gian nhảy lên + rơi xuống** so với 1375ms hiện tại, nhưng đỉnh nhảy phải đủ cao để chạm food trên cao.

- Điều chỉnh `GRAVITY` tăng (rơi nhanh hơn) + `JUMP_VELOCITY` cân bằng sao cho:
  - Thời gian bay ≈ **750–900ms** (giảm ~40% so với hiện tại)
  - Đỉnh nhảy `v²/(2g)` ≈ đủ chạm food ở `skyLevel` (tính theo cssHeight thực tế — chú ý đỉnh nhảy phải ≥ skyLevel)
- Agent phải tính toán + **ghi số cụ thể** trong evidence (vd GRAVITY = X, JUMP_VELOCITY = Y, thời gian bay = Z ms, đỉnh = W px với chiều cao màn tham chiếu) — đúng phong cách Task C cũ (đã có sẵn tính toán trong docs)
- Cơ chế jump giữ nguyên: `JUMP` event khi grounded → airborne; `LAND` khi chạm ground. Không đổi runner-state.ts

### 3.3. Tốc độ — chạy nhanh hơn

- Giảm `timePerItemMs` (cảm giác chạy nhanh hơn): đề xuất easy 4500→**3300**, medium 3200→**2500**, hard 2400→**2000** (agent có thể tinh chỉnh ±10% cho cân bằng gameplay, ghi rõ giá trị chốt)
- **Lưu ý:** file `config.ts` có comment "frozen" — comment này đã cũ (Task C trước đã retune GRAVITY trong canvas). Task này ĐƯỢC phép đổi `timePerItemMs` (đúng ý user) + cập nhật comment cho khớp thực tế (không giữ comment "frozen" gây hiểu lầm; ghi rõ đây là giá trị gameplay đã chỉnh)

### 3.4. Hitbox + nhịp game

- Hitbox character/food giữ nguyên cấu trúc (`rectsOverlap`, hệ số 0.2/0.6); chỉ thay đổi vị trí food (foodY trên cao)
- `PASS_ACTIVE_ITEM` khi `foodX < -FOOD_SIZE` (food bay qua hết màn) — giữ nguyên; với food trên cao, mascot không nhảy → food bay qua → PASS (chuyển đáp án) — đúng ngữ nghĩa mới
- Không đổi: HUD, bottom label, difficulty selector, end overlay, best time, retry/replay, coverage flow, server actions

### 3.5. Tests

- Cập nhật/viết unit test cho hằng số vật lý nếu có helper thuần (kiểm tra — có `runner-canvas` logic trong component, khó unit test trực tiếp; nếu có test utils liên quan tốc độ (`runner-difficulty.test.ts`) → cập nhật nếu assert giá trị cũ)
- E2E runner-setup + runner-gameplay — pass (E2E không đo timing chính xác — ghi chú nếu cần)
- `npm run check` exit 0

## 4. Verification gates (bắt buộc)

1. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
2. `npm run test:e2e -- runner-setup runner-gameplay` — pass
3. `git diff --check` sạch

## 5. Files dự kiến

- `src/features/runner/components/runner-canvas.tsx` (vị trí food + GRAVITY/JUMP_VELOCITY)
- `src/features/runner/config.ts` (timePerItemMs + comment)
- Tests liên quan nếu assert giá trị cũ
- KHÔNG đụng: runner-state.ts, server actions, migration, difficulty-selector, end overlay, HUD

## 6. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files, +X/−Y), push status: NOT pushed
Physics: GRAVITY=X, JUMP_VELOCITY=Y, thời gian bay=Zms, đỉnh nhảy=Wpx, skyLevel=..., timePerItemMs mới (easy/medium/hard)
Trích code: vị trí food + jump loop (ngắn)
Verification: npm run check (lint/typecheck/unit/build), E2E runner-setup runner-gameplay N/N PASS, git diff --check
Safety: migrations/DB NO · deps/env/AI/production NO
Ambiguities: <nếu có>
```

## 7. Lưu ý

- Gameplay phải **chơi được**: food trên cao + nhảy chạm ăn; đừng để food quá cao (không nhảy tới) hoặc quá thấp (ăn không công)
- Mascot khi airborne vẽ trên food? (thứ tự vẽ: nền → food → mascot → burst) — đảm bảo không nhìn khó hiểu khi chạm
- Không đổi semantics chấm điểm (HIT/PASS/đúng/sai/mạng) — chỉ đổi hình học + tốc độ + nhịp
