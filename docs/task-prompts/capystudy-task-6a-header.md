# CapyStudy — Task 6a: header gọn (mobile + desktop) + dời Đăng xuất vào Cá nhân

> **Status:** delivered (2026-08-14) — dành cho Gemini (model nhiều token, không mạnh): task nhỏ, thuần UI, không cần review riêng
> **Baseline commit:** commit mới nhất trên `main` (không phụ thuộc Task 1 UX — có thể dùng `1543edf` hoặc mới hơn)
> **Agent tier:** Gemini — làm ĐÚNG phạm vi, không sáng tạo thêm
> **Decisions locked (user):**
>
> - **Header mobile (thanh trên):** chỉ còn **logo + CapyStudy + Streak** — BỎ mascot capybara, avatar, tên người dùng (`CurrentUser`), nút Đăng xuất (`SignOutButton`).
> - **Header desktop (sidebar):** BỎ mascot capybara cạnh logo → chỉ còn **logo + CapyStudy**. Sidebar footer (Streak + user + Đăng xuất) GIỮ NGUYÊN.
> - **Đăng xuất mobile:** KHÔNG được mất chức năng — thêm nút Đăng xuất vào **Cá nhân → Cài đặt** (`/profile?tab=settings`).

---

## 0. Trước khi bắt đầu

```bash
git status
git log -8 --oneline
git pull --ff-only
```

Đọc trước (đọc toàn bộ 2 file này trước khi sửa):

- `src/components/layout/app-chrome.tsx`
- `src/components/layout/app-shell.tsx`
- `src/app/(app)/profile/page.tsx` (để biết chỗ thêm nút Đăng xuất ở tab settings)
- `src/features/auth/components/sign-out-button.tsx` (component có sẵn — TÁI SỬ DỤNG, không tạo mới)

---

## 1. `app-chrome.tsx` — bỏ mascot capybara

Hiện tại có **2 chỗ** render `<MascotImage ... state="normal" ...>`:

1. **Sidebar desktop** (trong `<Link href="/dashboard">` cạnh logo) — XÓA.
2. **Header mobile** (trong `<Link href="/dashboard">` cạnh logo) — XÓA.

Sau khi xóa cả 2:

- Import `MascotImage` trong file này trở thành **unused → xóa luôn**.
- Prop `mascotLevel` của `AppChrome` không còn ai dùng → **xóa prop khỏi signature** (cả ở type `Readonly<{...}>`).
- Import `MascotLevel` type → xóa nếu unused.

**Kết quả:** desktop sidebar = `logo.png + CapyStudy`; mobile header trái = `logo.png + CapyStudy`. KHÔNG thay đổi gì khác trong file.

## 2. `app-shell.tsx` — header mobile chỉ còn Streak

- `mobileHeaderRight`: bỏ `<CurrentUser />` và `<SignOutButton />` → **chỉ còn** `<StreakIndicator ...>` (bọc Link tới `/profile?tab=statistics` như hiện tại).
- `sidebarFooter`: **GIỮ NGUYÊN** (Streak + CurrentUser + SignOutButton — desktop).
- Vì `AppChrome` không còn nhận `mascotLevel`, bỏ prop đó khỏi lời gọi `<AppChrome ...>`.
- Import `levelFromStreak` trong file này chỉ dùng cho `mascotLevel` → nếu hết dùng, **xóa import** (kiểm tra kỹ trước khi xóa).

## 3. Thêm nút Đăng xuất vào Cá nhân → Cài đặt

Trong `src/app/(app)/profile/page.tsx`, nhánh `tab === "settings"`:

- Hiện render `<ProfileSettingsForm ... />`.
- Thêm `<SignOutButton />` bên dưới form, bọc trong 1 `<section>` hoặc `<div className="mt-6 ...">` có border/bg giống các section khác của trang (tham khảo style section `rounded-3xl border border-border-soft bg-surface p-5`).
- Import `SignOutButton` từ `@/features/auth/components/sign-out-button`.

**KHÔNG** sửa `ProfileSettingsForm`, KHÔNG sửa các tab khác.

## 4. Kiểm tra header trên các trang khác

KHÔNG có header nào khác (quiz/study/match/memory/runner đều dùng chung `AppChrome`). Không tự ý thêm header mới ở đâu.

---

## 5. Tests — cập nhật các assertion bị ảnh hưởng

- `tests/unit/components/app-shell.test.tsx` — hiện mock `CurrentUser`/`SignOutButton`; cập nhật assertion cho header mobile (không còn current-user/sign-out ở mobile; Streak còn). Đọc file trước khi sửa, sửa tối thiểu để khớp hành vi mới.
- Tìm toàn repo các assertion E2E/unit nhắc tới **mascot capybara trong header** (vd: `primary-navigation.spec.ts`, `foundation.spec.ts` — tìm bằng `grep -rn "mascot" tests/`) và cập nhật cho khớp hành vi mới (mascot không còn trong header). Nếu test assert mascot ở nơi KHÁC ngoài header (dashboard, statistics...) — **giữ nguyên**, không đụng.
- Thêm assertion E2E nhỏ (nếu spec header hiện có): ở viewport mobile 390px, header hiển thị logo + CapyStudy + Streak và **không có** avatar/tên/đăng xuất; ở desktop, sidebar chỉ logo + CapyStudy.
- Đảm bảo **không overflow ngang** ở 390px sau khi sửa.

---

## 6. Verification

```bash
npx vitest run tests/unit/components/app-shell.test.tsx
npm run check
npm run test:e2e -- primary-navigation foundation   # hoặc spec liên quan header
```

## 7. Diff review trước khi kết thúc

```bash
git status
git diff --check
git diff --stat
git diff
```

Kiểm tra:

- Đúng phạm vi: chỉ 3 file src (`app-chrome.tsx`, `app-shell.tsx`, `profile/page.tsx`) + test liên quan.
- KHÔNG có: migration, DB, dependency, env, AI, thay đổi mascot feature khác, thay đổi trang khác.
- KHÔNG còn `MascotImage`/`mascotLevel` nào trong 2 file layout.
- Đăng xuất vẫn truy cập được trên mobile qua `/profile?tab=settings`.

## 8. Commit

```bash
git add <task-related-files>
git commit -m "feat: simplify app header and move sign-out to profile settings"
```

**KHÔNG push** — gửi evidence report để người quản lý (tôi) review.

## 9. Evidence report

Báo:

- **Repository:** starting commit, final commit, push status (KHÔNG push), worktree.
- **Thay đổi:** tóm tắt từng file.
- **Tests:** file test, số discovered/passed/failed/skipped; kết quả `npm run check`.
- **Safety:** migrations changed NO / DB NO / dependencies NO / env NO / AI NO / production NO.
- **Ambiguities:** nếu có điểm nào không rõ — ghi rõ, KHÔNG tự quyết.

---

## Ràng buộc tuyệt đối

1. CHỈ làm đúng 3 việc trong prompt này — không refactor, không đổi màu/token, không đụng component khác.
2. KHÔNG xóa chức năng đăng xuất trên mobile.
3. KHÔNG thêm mascot mới vào header (mascot vẫn còn ở dashboard/statistics/quiz result/empty states — giữ nguyên).
4. KHÔNG tạo component mới, KHÔNG cài dependency.
