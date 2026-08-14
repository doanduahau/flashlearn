# CapyStudy — Task 6: giao diện — Match 12 ô cố định, study lật thẻ, header gọn

> **Status:** ⚠️ **SUPERSEDED — đã tách thành 3 task nhỏ cho Gemini:** `capystudy-task-6a-header.md` (header gọn + dời Đăng xuất vào Cá nhân), `capystudy-task-6b-study-buttons.md` (nút Trước/Sau study), `capystudy-task-6c-match-board.md` (Match 12 ô cố định). Không giao file này nữa; dùng 3 file 6a/6b/6c.
> **Baseline commit:** commit mới nhất trên main (sau Task 3/4/5 nếu đã merged)
> **Agent tier:** Codex + GPT-5.6 Terra — **không cần review riêng** (thuần UI/token/CSS, không chạm DB/security/logic game)
> **Decisions locked (user):**
>
> - **Match (Kiểm tra → Match):** bố cục **6 hàng × 2 cột = 12 ô kích thước bằng nhau và CỐ ĐỊNH**, chiếm gần hết chiều cao màn hình (full màn). Ô **không co giãn theo nội dung chữ**; chữ dài → **tự giảm cỡ chữ** cho vừa ô.
> - **Study lật thẻ:** nút "trước"/"sau" hiện **đè lên và che nội dung thẻ** → sửa: chuyển nút xuống DƯỚI thẻ (hàng nút riêng), không chồng lên nội dung.
> - **Header mobile:** chỉ còn **logo + CapyStudy + Streak** — BỎ mascot capybara, avatar, tên người dùng, nút đăng xuất khỏi header mobile (SignOut + CurrentUser dời vào trang Cá nhân — Task 5/chỗ khác đã xử lý nếu có; nếu chưa, di chuyển trong task này, KHÔNG xóa chức năng).
> - **Header desktop (sidebar):** bỏ mascot capybara cạnh logo → chỉ còn **logo + CapyStudy** (sidebar footer giữ nguyên: streak, user, sign out).
>   **Ngoài phạm vi:** mọi thay đổi luồng/setup (Task 1–5) — KHÔNG làm; chỉ thuần giao diện.

---

## 0. Trước khi bắt đầu

```bash
git status
git log -8 --oneline
git pull --ff-only
```

Đọc trước:

- `src/features/match/components/match-board.tsx` — hiện là 2 cột list (grid-cols-2, mỗi cột 6 ô co giãn theo chữ)
- `src/features/match/types/match-types.ts` — `MATCH_PAIR_COUNT = 6` (6 cặp front/back/batch)
- `src/features/study/components/study-session.tsx` — nút trước/sau absolute chồng lên thẻ
- `src/components/layout/app-chrome.tsx` — header mobile + sidebar (logo + mascot + CapyStudy)
- `src/components/layout/app-shell.tsx` — mobileHeaderRight (Streak + CurrentUser + SignOut)
- `src/app/(app)/profile/page.tsx` — nơi chứa CurrentUser/SignOut (nếu chưa có, thêm khi di chuyển)
- `src/features/runner/components/runner-hud.tsx` — tham chiếu HUD style

---

## 1. Match — 6 hàng × 2 cột, 12 ô cố định

### 1.1 Bố cục

- Mỗi batch = 6 cặp (6 front + 6 back).
- Hiển thị: **lưới 6 hàng × 2 cột** — cột trái = mặt trước (front), cột phải = mặt sau (back) của cùng cặp (cùng hàng).
- Tổng 12 ô, **tất cả kích thước bằng nhau** (ô vuông hoặc chữ nhật đều nhau theo hàng).
- Chiều cao: bố cục **chiếm gần hết chiều cao viewport khả dụng** (không cuộn nếu có thể — dùng `h-dvh`/`min-h-dvh` trừ header/progress bar; nếu content không vừa → cho phép cuộn dọc nhưng ô vẫn cố định kích thước, không co giãn theo chữ).
- Mobile-first: ô đủ lớn để chạm (không quá nhỏ trên 390px — kiểm tra 12 ô full màn có chạm được không; nếu quá chật, giảm padding nhưng GIỮ kích thước ô cố định).

### 1.2 Chữ dài → giảm font

- Mỗi ô: text **căn giữa, cố định kích thước ô** (không `whitespace-pre-wrap` kéo dài ô).
- Chữ nhiều → **tự co cỡ chữ** (helper thuần: tính cỡ chữ theo độ dài + glyph rộng — tham khảo `src/features/runner/utils/answer-label-size.ts` đã có, có thể tái sử dụng pattern) hoặc CSS `clamp()`/container query — chọn cách deterministic, có unit test nếu dùng helper.
- Không cắt mất nội dung: nếu chữ rất dài vượt cả cỡ tối thiểu → cho phép `overflow-y-auto` TRONG ô (nhưng ô vẫn giữ kích thước) — chữ không bao giờ đè ra ngoài ô.

### 1.3 Trạng thái giữ nguyên

- Giữ nguyên: selected (viền primary), matched (mờ), incorrect feedback ("Chưa đúng..."), batch progress ("Bộ X / Y", "Đã nối Z / N").
- Chỉ đổi layout ô + co font.

---

## 2. Study lật thẻ — nút trước/sau

- Hiện tại: 2 nút chevron `absolute left-3/right-3 top-1/2` chồng lên thẻ (`study-session.tsx`).
- Sửa: chuyển nút xuống **dưới thẻ** thành hàng nút riêng: `[← Trước] [Thẻ X / Y] [Sau →]` hoặc 2 nút 2 bên ngay dưới thẻ (không chồng lên nội dung).
- Giữ: swipe gesture, keyboard (ArrowLeft/ArrowRight), aria-label "Thẻ trước"/"Thẻ tiếp theo", disabled ở đầu/cuối.
- Mobile: nút đủ cao chạm (≥ 44px).

---

## 3. Header

### 3.1 Mobile header

- Bỏ khỏi `app-chrome.tsx` (mobile header):
  - Mascot capybara cạnh logo (`<MascotImage state="normal">`) — chỉ còn logo + "CapyStudy".
  - `CurrentUser` (avatar + tên) và `SignOutButton` khỏi `mobileHeaderRight` — di chuyển vào trang Cá nhân (`/profile`), nếu chưa có sẵn.
- Giữ: logo, "CapyStudy", `StreakIndicator`.
- Header mobile sau cùng: `[logo] CapyStudy  ·····  [Streak]`.

### 3.2 Desktop sidebar header

- Bỏ mascot capybara cạnh logo → chỉ còn logo + "CapyStudy".
- Sidebar footer GIỮ NGUYÊN (StreakIndicator + CurrentUser + SignOutButton).

### 3.3 Lưu ý

- Kiểm tra các trang/auth không dùng AppChrome — không ảnh hưởng.
- Mascot level vẫn được tính (AppShell truyền `mascotLevel`) — nếu sau khi bỏ mascot khỏi header mà prop `mascotLevel` không còn ai dùng trong AppChrome → giữ prop (đừng phá API) hoặc bỏ sạch nếu dễ; ghi trong evidence.

---

## 4. Mobile-first + accessibility

- Mọi thay đổi mobile-first → desktop.
- Không horizontal overflow 390px (match board + study session + header).
- Focus visible, aria-label đầy đủ cho nút icon-only.
- Tôn trọng `prefers-reduced-motion` (nếu thêm animation).

---

## 5. Tests

### 5.1 Unit/component

- Match board: 12 ô render đủ; ô có kích thước cố định (assert class/style); helper co font (nếu tạo) có unit test: chữ ngắn → cỡ lớn, chữ dài → cỡ nhỏ, cực dài → không vượt ô.
- Study session: nút trước/sau KHÔNG còn chồng lên thẻ (assert DOM: nút nằm ngoài vùng card hoặc hàng riêng); điều hướng vẫn hoạt động.
- App chrome: header mobile không còn CurrentUser/SignOut/mascot; desktop sidebar header chỉ logo + tên; CurrentUser/SignOut có mặt ở /profile.

### 5.2 E2E

- `match-*.spec.ts` (nếu có), `study-mode.spec.ts`, `app-shell.test.tsx`/`foundation.spec.ts`: cập nhật selector.
- Assert: không overflow 390px trên match board + study session + /dashboard header.
- Assert header mobile: logo + CapyStudy + Streak hiển thị, không còn avatar/tên.
- Assert study: bấm "Thẻ trước"/"Thẻ tiếp theo" dưới thẻ vẫn đổi thẻ đúng.

---

## 6. Verification

```bash
npm run check
npm run test:e2e -- match study-mode foundation runner-setup
git status
git diff --check
git diff --stat
git diff
```

Kiểm tra diff: không migration, không đổi engine/logic game (chỉ UI), không đổi setup flow.

## 7. Commit

```bash
git add <các file thuộc task>
git commit -m "feat: polish match grid, study card navigation and app header"
```

**Không push** — chờ xác nhận của điều phối (không cần Sol review nếu không chạm DB).

## 8. Evidence report

- Repository: starting/final commit, push status, worktree
- Match: mô tả layout mới + helper co font
- Study: vị trí nút mới
- Header: mobile/desktop trước → sau, CurrentUser/SignOut dời đi đâu
- Tests: files/discovered/passed/failed/skipped
- Files changed
- Safety: migrations/DB/deps/env/AI/production — YES/NO
- Ambiguities
- Verdict: `EVIDENCE READY FOR REVIEW` hoặc `INCOMPLETE — BLOCKER REQUIRES USER DECISION`
