# CapyStudy — Task 7: Mascot level theo streak ở mọi nơi (trừ trang lỗi)

> **Loại:** UI thương hiệu — nhẹ, cơ học.
> **Tier:** Gemini (nhiều token, không mạnh) — không review riêng, E2E bắt buộc.
> **Baseline commit:** commit mới nhất trên main (SAU Task 3, Task 4, Task 5 đã merged — vì task này đụng các file mà Task 3/4/5 cũng sửa: `study-source-select`, `source-browser`, `quiz/page`, `match-session`, `memory-session`).

---

## 0. Trước khi bắt đầu

```bash
git status
git log -5 --oneline
git pull --ff-only
```

Xác nhận main là mới nhất. Nếu repository hiện tại khác với mô tả trong file này (cấu trúc đã thay đổi bởi Task 3/4/5), **rà lại bằng grep** theo mục 2 và áp dụng theo cấu trúc THỰC TẾ — không bám danh sách cũ.

---

## 1. Bối cảnh

CapyStudy có **5 level mascot** tương ứng cột mốc streak: `0 / 30 / 60 / 120 / 240`.

Hiện tại một số nơi đã dùng level theo streak:

- Dashboard thanh động lực (`dashboard-motivation-bar.tsx`) — `loadMascotLevel` từ server ✓
- Banner cột mốc streak (`streak-milestone-banner.tsx`) — `levelFromStreak` ✓
- Thống kê (`statistics-panel.tsx`) — `levelFromStreak(current_streak)` ✓
- Kết quả Quiz (`quiz/[sessionId]/result/page.tsx`) — `levelFromStreak` ✓
- Capy Runner session — `loadMascotLevel` từ server ✓

NHƯNG còn ~15 nơi khác đang hardcode `level={1}` — dù user đạt streak 240 vẫn hiện capy level 1.

**Yêu cầu user (đã chốt):** đạt cột mốc streak → MỌI mascot trên toàn web đổi level theo streak, **giữ nguyên trạng thái** (happy vẫn happy, thinking vẫn thinking, congrats vẫn congrats...).

**NGOẠI LỆ đã chốt:** giữ nguyên `level={1}` ở **3 trang lỗi** vì không có streak context:

- `src/app/auth/error/page.tsx`
- `src/app/error.tsx`
- `src/app/not-found.tsx`

---

## 2. Danh sách vị trí cần sửa (rà lại bằng grep trước khi làm)

Tìm toàn bộ mascot còn hardcode:

```bash
grep -rn "level={1}" src/ --include="*.tsx" | grep -v test
```

Các vị trí biết trước (có thể lệch do Task 3/4/5):

| File                                                               | Trạng thái                | Ghi chú                                                                                                   |
| ------------------------------------------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/features/flashcard-sets/components/set-launcher-card.tsx`     | point-right / normal      | render từ `/sets` (server)                                                                                |
| `src/features/flashcard-sets/components/sets-list.tsx`             | thinking (empty)          | render từ `/sets/library`                                                                                 |
| `src/features/special-collections/components/collections-list.tsx` | thinking (empty)          | render từ `/sets/library?tab=special`                                                                     |
| `src/features/flashcard-sets/components/set-reorder-list.tsx`      | thinking (empty)          | render từ `/sets/library?reorder=1`                                                                       |
| `src/app/(app)/sets/[setId]/page.tsx`                              | thinking (empty)          | server page                                                                                               |
| `src/app/(app)/collections/[collectionId]/page.tsx`                | thinking (empty)          | server page                                                                                               |
| `src/app/(app)/quiz/page.tsx`                                      | thinking (empty)          | **LƯU Ý:** Task 4 dời lịch sử quiz sang Thống kê — sau Task 4 chỗ này có thể đã đổi; áp theo cấu trúc mới |
| `src/features/source-selection/components/source-browser.tsx`      | thinking (empty)          | render từ match-setup, memory-setup, quiz-setup, runner-setup, study-source-select                        |
| `src/features/study/components/study-source-select.tsx`            | thinking (empty)          | render từ `/study` — sau Task 3 có thể đổi cấu trúc                                                       |
| `src/features/imports/components/paste-import.tsx`                 | thinking (pending, 24px)  | client, render từ `/sets/create`                                                                          |
| `src/features/imports/components/google-sheets-import.tsx`         | thinking (pending, 32px)  | client, render từ `/sets/create`                                                                          |
| `src/features/imports/components/document-import.tsx`              | thinking (đang đọc, 32px) | client, render từ `file-import`                                                                           |
| `src/features/imports/components/import-wizard.tsx`                | thinking (2 chỗ)          | client, render từ `file-import`                                                                           |
| `src/features/imports/components/file-import.tsx`                  | thinking                  | client, render từ `/sets/create`                                                                          |
| `src/features/imports/components/create-summary.tsx`               | thinking                  | client, render từ các source import                                                                       |
| `src/features/match/components/match-session.tsx`                  | congrats                  | client, render từ `/match/session` (server)                                                               |
| `src/features/memory/components/memory-session.tsx`                | congrats                  | client, render từ `/memory/session` (server)                                                              |

---

## 3. Cách làm — 2 nhóm

### Nhóm A — Server-rendered (empty states, launcher)

- Server page load level một lần rồi truyền prop xuống:

```ts
import { loadMascotLevel } from "@/features/mascot/server/load-mascot-level";
// trong page (đã có supabase client):
const mascotLevel = await loadMascotLevel(supabase);
```

- Truyền `mascotLevel` xuống component chứa `MascotImage`, rồi dùng `level={mascotLevel}`.
- Mỗi component bị sửa phải cập nhật **toàn bộ caller** render nó (dùng grep xác minh), ví dụ `source-browser` có 4–5 caller (match-setup, memory-setup, quiz-setup, runner-setup, study-source-select) → mỗi trang đó phải load và truyền level.

### Nhóm B — Client components (import pending, match/memory session)

- **Match/Memory session:** trang `/match/session/page.tsx` và `/memory/session/page.tsx` là server page → load `mascotLevel` rồi truyền prop xuống `MatchSession` / `MemorySession`, dùng cho mascot congrats.
- **Import trên `/sets/create`:** trang `/sets/create/page.tsx` là server page → load `mascotLevel` và truyền prop xuống chuỗi client: `PasteImport` / `GoogleSheetsImport` / `FileImport` / `ManualSetForm` → `CreateSummary` (và `ImportWizard` / `DocumentImport` qua `FileImport`). Thread đúng prop qua từng component; giữ nguyên toàn bộ logic hiện có.

**KHÔNG** tạo hook fetch streak mới ở client, **KHÔNG** thêm server action mới — dùng prop từ server page (đúng nguyên tắc server-first của dự án).

---

## 4. KHÔNG được làm

- Không sửa `level={1}` ở 3 trang lỗi: `auth/error`, `error.tsx`, `not-found.tsx`.
- Không đổi trạng thái mascot ở bất kỳ đâu — chỉ đổi `level`.
- Không đổi kích thước, layout, alt text, aria của mascot.
- Không đụng logic streak/statistics/database.
- Không đụng `dashboard-motivation-bar`, `streak-milestone-banner`, `statistics-panel`, quiz result, runner session — chúng đã đúng.
- Không migration, không dependency, không env, không AI.
- Không sửa test E2E để "chạy cho qua" — chỉ cập nhật nếu test assert hành vi cũ (ví dụ assert `level={1}` cụ thể).

---

## 5. Verification

```bash
npm run check
```

E2E (bắt buộc — chạy các spec chạm trang bị sửa):

```bash
npm run test:e2e -- foundation primary-navigation mobile-first-ui runner-setup
npm run test:e2e -- match memory study-mode quiz-result-collections
```

Nếu spec nào fail vì assert mascot level cũ → cập nhật assert cho đúng hành vi mới, KHÔNG xóa test.

Xác nhận cuối:

```bash
grep -rn "level={1}" src/ --include="*.tsx" | grep -v test
```

Kết quả phải **chỉ còn 3 file lỗi** (`auth/error`, `error.tsx`, `not-found.tsx`) + không sót vị trí nào khác.

---

## 6. Commit

Chỉ stage đúng file của task (KHÔNG `git add .`):

```bash
git add <các file thuộc task>
git commit -m "feat: use streak-based mascot level across app UI"
```

KHÔNG push — gửi evidence report.

---

## 7. Evidence report

Báo:

- Repository: start/final commit, push status.
- Bảng vị trí đã sửa: file → trạng thái → level lấy từ đâu (prop từ page nào).
- Xác nhận `grep "level={1}"` chỉ còn 3 trang lỗi.
- Test: số file/test pass, kết quả `npm run check`, E2E.
- Safety: migrations/DB/deps/env/AI/production = NO.
- Ambiguities nếu có (dừng hỏi nếu repository khác mô tả nhiều).
