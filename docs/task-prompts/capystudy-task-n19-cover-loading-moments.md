# Task N19 — Che mọi lúc "đang load" bằng logo + 3 chấm (không còn chữ lộ ra)

## Loại task

**Giao diện / Trung bình–lớn** — UI thuần, không chạm DB/security. Không cần review riêng. Nhiều file (~25) nhưng thay đổi cơ học theo mẫu.

## Baseline

- Branch: `main`
- Baseline commit: `65cad7b` (đã push, main đồng bộ origin/main).
- Chỉ làm đúng phạm vi task này, không tạo commit từ baseline khác.

## Bối cảnh

N18 đã tạo trang loading full-page `BrandSplash` (logo to + 3 chấm đậm nhạt, keyframes `splash-dot`/`splash-in` trong `globals.css`). Nhưng vẫn còn nhiều nơi **hiển thị chữ** "Đang tải thẻ…", "Đang tính thẻ…", "Đang tạo…", "Đang lưu…", "Đang mở…", "Đang xử lý…" khi load. Yêu cầu: **che mọi lúc đang load** bằng thiết kế logo + 3 chấm — không còn chữ load lộ ra trên màn hình (chữ chỉ giữ làm sr-only/aria-label).

## Thiết kế — 2 component mới (reuse CSS N18)

### 1. `src/components/shared/brand-loading.tsx` — mini splash cho vùng nội dung

- Server-safe (không "use client"), prop: `title?: string`.
- Bố cục: căn giữa theo 2 trục (`flex flex-col items-center justify-center`, padding nhỏ), `role="status"`, `aria-label={title || "Đang tải"}`, có `<span className="sr-only">{title || "Đang tải"}</span>`.
- Logo `/mascot/logo.png` **nhỏ** (khoảng 40–48px, `size-10`/`size-12`) trong khối `rounded-2xl bg-primary-soft p-3`, lớp `splash-in` (hiệu ứng có sẵn N18).
- Bên dưới: **3 chấm** `bg-primary` dùng lớp `.splash-dot` có sẵn, kích thước nhỏ (`size-2`), delay 0/150ms/300ms qua `[animation-delay:...]`, `aria-hidden="true"`.
- Dùng token cam hiện có, không hardcode hex.

### 2. `src/components/shared/loading-dots.tsx` — 3 chấm inline cho nút + dòng trạng thái

- Prop: `label?: string` (mặc định "Đang tải").
- Render: `<span role="status" className="inline-flex items-center gap-1.5"><span className="sr-only">{label}</span><span aria-hidden="true">…3 chấm…</span></span>`.
- 3 chấm `bg-primary` dùng lớp `.splash-dot` có sẵn, kích thước nhỏ (`size-1.5`), delay 0/150ms/300ms.
- Không thêm keyframes mới — tái sử dụng `.splash-dot` (đã tôn trọng `prefers-reduced-motion`).

## Phạm vi thay đổi

### A. Session "Đang tải thẻ…" → `<BrandLoading>` (3 chỗ)

| File                                                | Dòng     | Thay                                                                           |
| --------------------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| `src/features/typing/components/typing-session.tsx` | ~225–230 | `<p role="status">Đang tải thẻ…</p>` → `<BrandLoading title="Đang tải thẻ" />` |
| `src/features/match/components/match-session.tsx`   | ~233     | tương tự                                                                       |
| `src/features/memory/components/memory-session.tsx` | ~134–139 | tương tự                                                                       |

### B. Đếm thẻ "Đang tính…/Đang tính số thẻ…/Đang tính thẻ…" → `<LoadingDots>` (7 chỗ)

| File                                                                 | Dòng       | Thay                                                                                                                         |
| -------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/features/learning-modes/components/question-count-selector.tsx` | ~29–31     | `{counting ? "Đang tính…" : ...}` → `{counting ? <LoadingDots label="Đang tính" /> : ...}`                                   |
| `src/features/study/components/study-mode-select.tsx`                | ~176, ~250 | `? "Đang tính…"` → `? <LoadingDots label="Đang tính" />`                                                                     |
| `src/features/study/components/study-mode-select.tsx`                | ~181, ~255 | `<p>Đang tính số thẻ…</p>` → giữ thẻ `p` (giữ căn giữa/text-xs) nhưng nội dung là `<LoadingDots label="Đang tính số thẻ" />` |
| `src/features/memory/components/memory-setup.tsx`                    | ~206–209   | summary `? "Đang tính thẻ…"` → `? <LoadingDots label="Đang tính thẻ" />`                                                     |
| `src/features/match/components/match-setup.tsx`                      | ~208       | tương tự                                                                                                                     |
| `src/features/runner/components/runner-setup.tsx`                    | ~225       | tương tự                                                                                                                     |

**Chú ý:** `src/features/learning-modes/components/sticky-start-bar.tsx` — prop `summary` đang là `string`, cần đổi thành `ReactNode` (nhận `<LoadingDots>`). Nút `{pending ? pendingLabel : startLabel}` (dòng ~32) → `{pending ? <LoadingDots label={pendingLabel} /> : startLabel}`. Đây là component dùng chung cho 5 setup (quiz/study/memory/match/runner) — thay 1 chỗ được cả 5. Các nơi vẫn truyền `pendingLabel="Đang mở…"/"Đang tải…"` → sẽ thành sr-only (chuỗi giữ nguyên, không hiện chữ).

### C. Nút/inline pending → `<LoadingDots>` (thay text bằng chấm, giữ sr-only)

| File                                                                       | Dòng       | Text cũ → label sr-only                                         |
| -------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| `src/features/flashcard-sets/components/manual-set-form.tsx`               | ~295       | "Đang tạo…" → label "Đang tạo"                                  |
| `src/features/flashcard-sets/components/edit-card-form.tsx`                | ~108       | "Đang lưu…" → "Đang lưu"                                        |
| `src/features/profile/components/profile-settings-form.tsx`                | ~157       | "Đang lưu…" → "Đang lưu"                                        |
| `src/features/flashcard-sets/components/rename-set-form.tsx`               | ~67        | "Đang lưu…" → "Đang lưu"                                        |
| `src/features/flashcard-sets/components/set-reorder-list.tsx`              | ~81        | "Đang lưu thứ tự…" → "Đang lưu thứ tự"                          |
| `src/features/sharing/components/share-dialog.tsx`                         | ~116, ~139 | "Đang tạo…"→"Đang tạo"; "Đang xử lý…"→"Đang xử lý"              |
| `src/features/sharing/components/clone-set-button.tsx`                     | ~69        | "Đang lưu…" → "Đang lưu"                                        |
| `src/features/spaced-repetition/components/start-new-cards-button.tsx`     | ~40        | "Đang tải..." → "Đang tải"                                      |
| `src/features/quiz/components/quiz-mode-select.tsx`                        | ~176       | "Đang tạo…" → "Đang tạo"                                        |
| `src/features/auth/components/current-user.tsx`                            | ~70        | `<span>Đang tải...</span>` → `<LoadingDots label="Đang tải" />` |
| `src/features/special-collections/components/create-collection-form.tsx`   | ~53        | "Đang tạo…" → "Đang tạo"                                        |
| `src/features/special-collections/components/card-collections-control.tsx` | ~179       | "Đang lưu…" → "Đang lưu"                                        |
| `src/features/special-collections/components/rename-collection-form.tsx`   | ~67        | "Đang lưu…" → "Đang lưu"                                        |
| `src/features/runner/components/runner-end-overlay.tsx`                    | ~65        | "Đang lưu kỷ lục…" → "Đang lưu kỷ lục"                          |
| `src/features/imports/components/create-summary.tsx`                       | ~175       | "Đang tạo..." → "Đang tạo"                                      |
| `src/features/imports/components/document-import.tsx`                      | ~241       | "Đang tạo..." → "Đang tạo"                                      |

Quy tắc chung cho C: `{isPending ? "Đang X…" : "Label"} → {isPending ? <LoadingDots label="Đang X" /> : "Label"}`. Nếu nút có `disabled={isPending}` giữ nguyên. Không cần thêm `aria-busy` (LoadingDots đã có role="status" + sr-only). Chỉ thêm `aria-busy={isPending}` vào nút nếu nút hiện chưa có và việc thêm không phá test.

### D. Skeleton trong trang → `<BrandLoading>` (4 chỗ)

| File                                                          | Hàm/Dòng                       | Thay                                                                                                 |
| ------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `src/app/(app)/quiz/page.tsx`                                 | `QuizLoading` (~51–59)         | body skeleton → `<BrandLoading title="Đang tải nội dung kiểm tra" />` (có thể bỏ section wrapper cũ) |
| `src/app/(app)/profile/page.tsx`                              | `ProfileTabLoading` (~139–146) | → `<BrandLoading title="Đang tải nội dung cá nhân" />`                                               |
| `src/app/(app)/sets/library/page.tsx`                         | `LibraryTabLoading` (~213–225) | → `<BrandLoading title="Đang tải nội dung bộ flashcard" />`                                          |
| `src/features/source-selection/components/source-browser.tsx` | `SourceSkeleton` (~195–203)    | → `<BrandLoading title="Đang tải nguồn" />`                                                          |

## Ngoài phạm vi (KHÔNG làm)

- Không đổi `BrandSplash`, 19 `loading.tsx`, keyframes CSS có sẵn.
- Không đổi text nút khi KHÔNG pending (label thường giữ nguyên).
- Không đổi màu/token; không hardcode hex.
- Không cài dependency mới.
- Không đổi DB.

## Acceptance criteria

1. Không còn **chữ load nhìn thấy được** trên màn hình: "Đang tải thẻ…", "Đang tính…/Đang tính số thẻ…/Đang tính thẻ…", "Đang tạo…", "Đang lưu…", "Đang mở…", "Đang xử lý…" — chỉ còn ở dạng sr-only/aria-label hoặc prop `pendingLabel` (không render ra chữ). Grep xác nhận các chuỗi này chỉ xuất hiện trong `LoadingDots label` / `pendingLabel` / `BrandLoading/BrandSplash title` / sr-only.
2. Vùng session + skeleton trong trang hiển thị **logo nhỏ + 3 chấm đậm nhạt** (BrandLoading).
3. Nút đang pending hiển thị **3 chấm nhỏ** thay chữ; screen reader vẫn đọc được label (role="status" + sr-only).
4. `prefers-reduced-motion`: chấm đứng yên, vẫn rõ.
5. `npm run check` xanh.

## Verification bắt buộc

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

E2E (Docker đã chạy): chạy các suite chạm — `foundation`, `learning-mode-setup`, `study-mode`, `match`, `memory`, `typing-mode`, `runner-setup`, `quiz` liên quan, `share-dialog`, `manual-set-creation`. Báo rõ từng suite pass/fail/ngoài phạm vi. Nếu suite fail do cơ chế auth (như quiz-advancement đã biết fail pre-existing), ghi rõ "pre-existing".

## Constraints (nhắc lại từ AGENTS.md)

- Không dùng `any`, `@ts-ignore`, cast tùy tiện.
- Không sửa file ngoài phạm vi.
- Không dùng `--no-verify` khi commit.
- Component dùng chung phải có API nhỏ, rõ ràng.

## Report cuối task

- Summary.
- Files changed (kèm dòng chính).
- Verification: kết quả từng lệnh (lint/typecheck/test/build) + E2E từng suite.
- Remaining issues.
- Commit hash + message.
