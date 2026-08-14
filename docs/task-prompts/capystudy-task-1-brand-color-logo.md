# CapyStudy — Task 1: brand màu FDC07F + logo mascot + memory tile logo

> **Status:** verified — commit `3973e74` (đã push)
> **Baseline commit:** `cc01af8` (feat: retune runner jump and answer label UX) — trên origin/main (hoặc mới hơn nếu Task 5/khác đã merged — lấy commit mới nhất trên main)
> **Agent tier:** Codex + GPT-5.6 Terra — **không cần review riêng** (thuần UI/token, không chạm DB/security/RPC)
> **Decisions locked (user):**
>
> - **Màu thương hiệu:** đổi toàn bộ **primary family + nền/border** (phần "màu xanh nhạt" thương hiệu) sang tone **#FDC07F** (cam nhạt/apricot).
> - **GIỮ NGUYÊN màu chức năng:** `--success` (xanh lá #65be91 = đúng), `--danger` (đỏ), `--info`, `--warning`, `--achievement`, toàn bộ `--mastery-*` colors — đây là ngôn ngữ đúng/sai chuẩn UI, không đổi.
> - **Logo:** thay icon `Leaf` (lucide) bằng `public/mascot/logo.png` ở tất cả nơi logo thương hiệu xuất hiện.
> - **Memory matching:** khi lật thẻ, thay icon `ArrowUp` bằng `public/mascot/logo.png` — **to gần bằng kích thước ô nhưng luôn nằm gọn trong ô** (object-contain).
>   **Ngoài phạm vi:** module `src/features/mascot/` — KHÔNG đụng (task mascot phân bổ 7 trạng thái là task riêng, chưa giao); DB/migration — KHÔNG; hành vi game Runner (vật lý, timing) — KHÔNG; màu chức năng (success/danger/info/warning/mastery) — KHÔNG.

---

## 0. Before starting

Baseline = commit mới nhất trên `main`. Chạy `git status` / `git log -5` / `git pull --ff-only`.

Đọc trước:

- `src/app/globals.css` — toàn bộ design tokens (nơi duy nhất khai báo màu; mọi class dùng `text-primary`/`bg-primary-soft`/`border-border-soft`... đều tham chiếu token này).
- `src/features/memory/components/memory-board.tsx` — dòng ~256: `<ArrowUp>` khi tile được lật/ghép; dòng ~272: confetti hardcode `#7bcfa6`.
- `src/features/runner/art/runner-character.ts` — dòng ~31: fallback shape hardcode `#7bcfa6`.
- `src/features/runner/components/runner-canvas.tsx` — dòng ~98: `strokeStyle "#ddebe3"` (border); dòng ~125: burst `"#65be91"` (correct — **GIỮ**, đây là màu chức năng) và `"#ef8585"` (wrong — **GIỮ**).
- 6 chỗ dùng `Leaf` làm logo: `src/components/layout/app-chrome.tsx` (2 chỗ: sidebar + mobile header), `src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/sign-up/page.tsx`, `src/app/(marketing)/page.tsx`, `src/app/check-email/page.tsx`, `src/app/auth/error/page.tsx`.
- `public/mascot/logo.png` — logo mới (đã tồn tại trong repo, cùng thư mục với 35 ảnh mascot).

Nếu repo mâu thuẫn với rules dưới → **STOP và hỏi**. Không tự quyết.

## 1. Scope

Sửa 3 nhóm thuần UI:

### 1.1 Bảng màu thương hiệu — `src/app/globals.css`

Đổi các token sau sang tone cam #FDC07F (giữ nguyên tên token, chỉ đổi giá trị):

| Token                  | Giá trị cũ | Giá trị mới (đề xuất)                                     |
| ---------------------- | ---------- | --------------------------------------------------------- |
| `--primary`            | `#7bcfa6`  | `#FDC07F`                                                 |
| `--primary-hover`      | `#65be91`  | `#EBAE63` (tối hơn primary một chút cho hover)            |
| `--primary-soft`       | `#eaf8f0`  | `#FDF1DE` (nền cam rất nhạt)                              |
| `--primary-foreground` | `#245c46`  | `#4A320E` (nâu đậm — chữ trên nền cam phải đủ tương phản) |
| `--background`         | `#f8fbf7`  | `#FBF7F0` (nền ấm trung tính)                             |
| `--surface-subtle`     | `#f1f7f3`  | `#F7F0E6` (bề mặt ấm nhạt)                                |
| `--border-soft`        | `#ddebe3`  | `#EADDCB` (border ấm nhạt)                                |
| `--text-primary`       | `#20352c`  | `#2E2719` (nâu đậm trung tính — vẫn là màu chữ chính)     |

**Giữ nguyên:** `--text-secondary`, `--success`, `--warning`, `--danger`, `--info`, `--achievement`, toàn bộ `--mastery-*`, `--destructive*`, các token shadcn mapping (chúng tự tham chiếu các biến trên — kiểm tra không có token nào khác hardcode màu xanh còn sót).

⚠️ **Ràng buộc accessibility:** `--primary-foreground` + `--text-primary` phải đủ tương phản trên nền cam (kiểm tra nhanh: chữ nâu đậm trên FDC07F đạt WCAG AA). Nếu đề xuất trên chưa đạt, điều chỉnh giá trị theo hướng đậm hơn — ghi rõ giá trị cuối đã chọn trong report.

Sau khi đổi token, **grep toàn repo** để tìm màu xanh lá còn sót hardcode (không qua token):

- `src/features/memory/components/memory-board.tsx` (confetti `#7bcfa6`) → đổi sang `#FDC07F`.
- `src/features/runner/art/runner-character.ts` (fallback `#7bcfa6`) → đổi sang `#FDC07F`.
- `src/features/runner/components/runner-canvas.tsx` (`strokeStyle "#ddebe3"`) → đổi sang `#EADDCB`.
- **KHÔNG đổi:** `"#65be91"` (correct burst), `"#ef8585"` (wrong burst) trong runner-canvas — đây là màu chức năng đúng/sai.
- Kiểm tra thêm mọi chỗ khác (vd `#20352c`, `#f1f7f3`, `#65be91`) — chỉ đổi nếu nó là màu thương hiệu/nền/border, **giữ** nếu là chức năng. Ghi rõ từng quyết định trong report.

### 1.2 Logo thương hiệu — thay `Leaf` bằng `logo.png`

Ở 6 chỗ trên (app-chrome 2 chỗ + 4 trang auth/marketing), thay:

```tsx
import { Leaf } from "lucide-react";
// ...
<Leaf className="size-6 text-primary" aria-hidden="true" />;
```

bằng:

```tsx
<img src="/mascot/logo.png" alt="" aria-hidden="true" className="size-6 object-contain" />
```

- Giữ đúng vị trí, kích thước hiện tại của Leaf trong từng chỗ (`size-5` ở app-chrome, `size-6` ở các trang auth/marketing) — chỉ thay phần tử.
- Nếu logo.png có tỷ lệ không vuông, dùng `object-contain` (đã có) để không méo.
- Bỏ import `Leaf` nếu không còn dùng ở file đó (kiểm tra file còn dùng Leaf chỗ khác không — app-chrome chỉ dùng 1 lần cho logo, auth pages cũng vậy).
- Các trang này là Server Component — `<img>` thường (không cần `next/image` vì các file khác trong repo dùng `<img>` thường, vd MascotImage, runner-end-overlay — theo convention hiện có).

### 1.3 Memory matching — logo thay mũi tên

`src/features/memory/components/memory-board.tsx` dòng ~256:

```tsx
{
  revealed ? <ArrowUp aria-hidden="true" className="size-5 sm:size-6" /> : null;
}
```

→

```tsx
{
  revealed ? (
    <img src="/mascot/logo.png" alt="" aria-hidden="true" className="h-4/5 w-4/5 object-contain" />
  ) : null;
}
```

- **"To gần bằng ô nhưng luôn nằm trong ô":** dùng kích thước tương đối theo ô — `h-4/5 w-4/5` (80% ô) hoặc `h-3/4 w-3/4` (75%) — chọn mức nhìn to nhất mà không tràn/vỡ ô ở mọi kích thước grid (tile thay đổi theo viewport). `object-contain` giữ tỷ lệ logo. Kiểm tra ở cả mobile (ô nhỏ) và desktop.
- Không dùng kích thước px cố định (ô co giãn theo grid layout).
- Bỏ import `ArrowUp` nếu không còn dùng.
- Confetti trong cùng file đã đổi màu ở mục 1.1.

## 2. Verification

- `npx vitest run tests/unit/features/memory tests/unit/features/runner tests/unit/features/dashboard` — test HUD/overlay/component không assert màu cũ; nếu có test assert màu → cập nhật đúng giá trị mới (ghi rõ file nào).
- `grep -rn "#7bcfa6\|#65be91\|#eaf8f0\|#245c46\|#f1f7f3\|#ddebe3\|#20352c" src/` — kết quả chỉ còn: `#65be91` (success token trong globals.css + correct burst + mastery-strong-dot — **được phép giữ**), `#20352c` nếu còn là text hardcode (kiểm tra từng cái). Không còn `#7bcfa6`/`#eaf8f0`/`#245c46`/`#f1f7f3`/`#ddebe3` ở đâu cả.
- `grep -rn "Leaf" src/` — chỉ còn nếu file thật sự dùng Leaf cho mục đích khác (kiểm tra; nếu không còn chỗ nào thì sạch).
- `npm run check` — PASS (lint 0 error, unit toàn bộ pass, build pass).
- E2E nhanh liên quan UI: `npm run test:e2e -- foundation` (nếu có assert logo/landing) + `memory` + `runner-setup` — xác nhận không vỡ layout. Nếu suite có spec assert `Leaf`/icon cũ → cập nhật.

## 3. Diff review

- Không migration/DB/deps/env/AI.
- Không đụng `src/features/mascot/` (chỉ đọc để lấy đường dẫn logo).
- Không đổi hành vi game, không đổi văn bản.
- Màu chức năng (success/danger/wrong-burst) không bị đổi.
- Worktree sạch ngoài file task.

## 4. Commit

```bash
git add <task-related-files>
git commit -m "feat: apply capystudy brand color and logo"
```

Push lên `origin/main` (thuần UI, không migration — push sau khi gate pass).

## 5. Evidence report

Theo format chuẩn: Repository (start/final commit, push status, worktree), Bảng màu (token cũ → mới, kèm quyết định accessibility nếu điều chỉnh), Logo (6 chỗ thay đổi), Memory tile (kích thước chọn + lý do), Grep evidence (các màu còn lại sau khi xong), Tests (files/counts/kết quả), Files changed, Safety, Ambiguities (nếu có), Verdict (`EVIDENCE READY FOR REVIEW` hoặc `INCOMPLETE — BLOCKER REQUIRES USER DECISION`).
