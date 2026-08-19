# CapyStudy — Task 8c: Match chọn 2 thẻ bất kỳ + ô cố định + thông báo lỗi tách riêng

> **Loại:** logic game nhỏ + UI — vừa.
> **Tier:** Codex + Terra — không cần Sol review (không DB; logic thuần, đã có test).
> **Baseline commit:** commit mới nhất trên main tại thời điểm giao (SAU Task 7, 8a, 8b đã push).
> **Quy tắc:** KHÔNG đụng file ngoài danh sách. 2 commit tách riêng. KHÔNG push — gửi evidence report.

---

## 0. Bối cảnh

User yêu cầu 2 thay đổi trong `/match/session`:

1. **Chọn cặp không phân biệt thứ tự:** hiện tại chỉ chấp nhận khi chọn thẻ **bên trái (front) trước** rồi chọn đúng thẻ **bên phải (back)** sau. User muốn: chọn **2 thẻ đúng bất kỳ** (front + back, thứ tự nào cũng được) là chấp nhận.
2. **12 ô cố định kích thước:** ô không được co dãn khi thông báo "Chưa đúng, thử cặp khác" hiện lên/biến mất — thông báo phải tách riêng khỏi vùng lưới ô.

---

## 1. Phần 1 — Match chấp nhận cặp bất kể thứ tự

### File: `src/features/match/utils/match-state.ts` (hàm `selectCard`)

**Hiện trạng:** `selectCard` chỉ resolve cặp khi:

- click **front**: set `selectedFrontId`, **xóa** `selectedBackId` (nếu có);
- click **back**: nếu `selectedFrontId === null` → chỉ set `selectedBackId` (chưa resolve); nếu đã có front → resolve.

→ Nếu user chọn back trước rồi front sau, click front sẽ **xóa** back đang chọn → không bao giờ resolve. Đây là lỗi user gặp.

**Yêu cầu:** resolve cặp khi có **đúng 1 front + 1 back** được chọn, **bất kể thứ tự click**:

- Click front khi đã chọn back → resolve cặp (front hiện tại + back đang chọn).
- Click back khi đã chọn front → resolve cặp (giữ nguyên hành vi hiện tại).
- Click cùng phía (front khi đã chọn front / back khi đã chọn back) → toggle bỏ chọn (hành vi hiện tại).
- Click thẻ đã matched → bỏ qua (giữ nguyên).
- Kết quả đúng/sai, `lastResult`, `matchedFrontIds`/`matchedBackIds`, `completedPairCount`, advance batch — GIỮ NGUYÊN logic.

**Kiểm chứng:** xem E2E hiện có assert hành vi "front trước back sau" không — nếu có, cập nhật assert cho phù hợp (đừng xóa test). `tests/e2e/match.spec.ts`.

### Test

- Cập nhật `tests/unit/features/match/match-state.test.ts`: thêm case back-trước-front-sau → resolve đúng; front-trước-back-sau → vẫn đúng; cùng phía toggle; matched bỏ qua.
- Chạy: `npx vitest run tests/unit/features/match`

## 2. Phần 2 — 12 ô cố định + thông báo tách riêng

### File: `src/features/match/components/match-board.tsx`

**Hiện trạng:** container `h-[calc(100dvh-140px)] flex flex-col gap-4` chứa: header (shrink-0) + thông báo lỗi `<p role="alert">Chưa đúng, thử cặp khác.</p>` (shrink-0) + lưới grid `flex-1`. Khi thông báo hiện/biến mất, vùng `flex-1` của lưới đổi chiều cao → **12 ô co dãn theo** (lỗi user gặp).

**Yêu cầu:**

- Lưới 12 ô **cố định chiều cao**, không đổi khi thông báo xuất hiện/biến mất.
- Thông báo "Chưa đúng, thử cặp khác." hiển thị **tách riêng** khỏi vùng lưới: chọn 1 trong 2 cách (tốt nhất: cái ít đổi layout nhất):
  - **(a) Reserve vùng thông báo cố định:** dành sẵn 1 khoảng chiều cao cố định (vd `h-8` hoặc `min-h-8`) luôn hiện diện; thông báo render trong khoảng đó; lưới lấy chiều cao còn lại cố định.
  - **(b) Overlay:** thông báo nằm absolute phủ lên (không chiếm chỗ trong flow) — nhưng phải không che lưới khi user đang tương tác; cân nhắc vị trí (vd trên header hoặc giữa).
- Lưới giữ nguyên: `grid grid-cols-2`, mỗi cột `grid-rows-6`, ô `h-full` — kích thước ô phải ổn định giữa các state.
- KHÔNG đổi: logic match-state, `data-match-card-id`/`data-match-side`, disabled, onComplete, E2E selectors.

### Test

- Kiểm tra E2E match hiện có; thêm assert (nếu khả thi): kích thước ô không đổi khi thông báo xuất hiện (đo qua bounding box trước/sau khi sai 1 cặp) — nếu khó ổn định thì ghi rõ trong report + chứng minh bằng component test/visual.
- Chạy: `npm run test:e2e -- match`

## 3. Verification

```bash
npm run check
npm run test:e2e -- match
```

## 4. Commit

```bash
git add <các file thuộc phần 1>
git commit -m "fix: accept match pairs in any click order"
git add <các file thuộc phần 2>
git commit -m "fix: keep match grid cells fixed size and separate error notice"
```

## 5. Evidence report

- Repository: start/final commit, push status.
- Phần 1: thay đổi `selectCard`, các test thêm.
- Phần 2: cách chọn (a/b), bằng chứng ô không co dãn.
- Test: `npm run check`, `npm run test:e2e -- match`.
- Safety: migrations/DB/deps/env/AI/production = NO.
- Ambiguities.
- Verdict: `EVIDENCE READY FOR REVIEW` / `INCOMPLETE — BLOCKER REQUIRES USER DECISION`.
