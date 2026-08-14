# CapyStudy — Task 6c: Match — 12 ô kích thước cố định, 6 hàng × 2 cột, chữ dài tự giảm cỡ

> **Status:** delivered (2026-08-14) — dành cho Gemini (model nhiều token, không mạnh): task nhỏ, thuần CSS/layout, không cần review riêng
> **Baseline commit:** commit mới nhất trên `main` (không phụ thuộc Task 1 UX)
> **Agent tier:** Gemini — làm ĐÚNG phạm vi, không sáng tạo thêm
> **Decisions locked (user):**
>
> - Match (Kiểm tra → Match) hiện bị "khập khiễng": ô co giãn theo chữ.
> - Yêu cầu: chia vùng chơi thành **6 hàng × 2 cột = 12 ô kích thước BẰNG NHAU và CỐ ĐỊNH** (chiếm gần hết chiều cao màn hình — "full màn").
> - Ô KHÔNG co giãn theo nội dung chữ; nếu chữ nhiều → **tự giảm cỡ chữ** cho vừa ô.
> - Mobile-first, không horizontal overflow, thao tác touch.

---

## 0. Trước khi bắt đầu

```bash
git status
git log -8 --oneline
git pull --ff-only
```

Đọc trước (toàn bộ trước khi sửa):

- `src/features/match/components/match-board.tsx` — file DUY NHẤT cần sửa layout
- `src/features/match/types/match-types.ts` — `MATCH_PAIR_COUNT = 6` (mỗi batch = 6 cặp: 6 front + 6 back)
- `src/features/match/utils/match-state.ts` — logic trạng thái (KHÔNG sửa file này)
- `tests/e2e/match.spec.ts` — dùng `data-match-card-id` và `data-match-side` (phải GIỮ NGUYÊN 2 attribute này)
- Tham khảo pattern co chữ: `src/features/runner/utils/answer-label-size.ts` + `src/features/runner/components/runner-bottom-label.tsx` (đã có sẵn cách chọn cỡ chữ theo độ dài — có thể tái sử dụng ý tưởng)

## 1. Hiện trạng (đã xác minh)

- `MatchBoard` render: header `Bộ X / N` + `Đã nối Y / Z` + `grid grid-cols-2 gap-2` chứa 2 `MatchColumn` (front, back).
- `MatchColumn` hiện là `ul flex flex-col gap-2`, mỗi ô là `button` với `px-3 py-2 ... text-sm` — **chiều cao ô co giãn theo nội dung chữ** → gây khập khiễng.
- `data-match-card-id` / `data-match-side` trên mỗi button — **E2E phụ thuộc, phải giữ nguyên**.
- `onSelect` / `selectCard` / disabled / selected / matched — **logic giữ nguyên 100%**.

## 2. Việc cần làm

### 2.1 Bố cục lưới cố định

- Thay layout 2 cột list co giãn bằng **lưới 6 hàng × 2 cột**:
  - Cột trái = mặt trước (front), cột phải = mặt sau (back) — **cặp cùng hàng** (front thứ i và back thứ i của batch nằm cùng hàng i).
  - **12 ô kích thước bằng nhau và cố định** — không phụ thuộc độ dài chữ.
  - Vùng lưới chiếm gần hết chiều cao màn hình (mobile-first, dùng `dvh` — tham khảo cách Runner dùng `min-h-dvh`): ví dụ `h-[calc(100dvh-<phần header+tiêu đề>)]` hoặc flex column với phần tiêu đề cố định và lưới `flex-1 min-h-0`. Căn chỉnh sao cho KHÔNG overflow dọc, KHÔNG scroll ngang, ô vẫn đủ lớn để chạm (chiều cao tối thiểu ~44px mỗi ô).
  - Gợi ý triển khai: container ngoài `grid grid-cols-2 gap-2`; mỗi cột là `grid grid-rows-6 gap-2` (hoặc flex column với 6 ô `flex-1`); mỗi ô `button` có `h-full w-full` + `overflow-hidden`.
- **Giữ nguyên:** header `Bộ X / N`, `Đã nối Y / Z`, thông báo sai `Chưa đúng, thử cặp khác.`, `aria-label` của 2 cột (`Mặt trước`/`Mặt sau`), `aria-pressed`, `disabled={matched}`, màu selected/matched/hover, `data-match-card-id`, `data-match-side`, `onSelect`.

### 2.2 Chữ dài → tự giảm cỡ chữ

- Nội dung ô căn giữa (hoặc giữ kiểu hiện tại `text-left` nếu hợp lý hơn với ô cố định — chọn 1, nhất quán 2 cột), `break-words whitespace-pre-wrap`.
- Chữ dài KHÔNG được làm ô to lên và KHÔNG bị cắt mất nội dung:
  - Viết 1 **helper thuần** nhỏ (mô phỏng `answer-label-size.ts` của Runner): nhận chuỗi (độ dài + glyph rộng nếu cần), trả về class cỡ chữ (vd: `text-sm` / `text-xs` / `text-[11px]` / `text-[10px]`) sao cho chữ dài tự nhỏ lại.
  - Hoặc đơn giản hơn: dùng kết hợp cỡ chữ theo độ dài + `line-clamp`/`overflow` hợp lý — nhưng **KHÔNG cắt mất ý nghĩa**: ưu tiên giảm cỡ chữ trước, clamp chỉ là phương án cuối.
  - Kèm **unit test** cho helper (các case: ngắn / trung bình / dài / chuỗi không có khoảng trắng dài).

### 2.3 Touch & responsive

- Mobile-first: test ở 390px — không horizontal overflow, ô chạm vừa tay.
- Desktop: lưới vẫn 6×2, chiều cao giới hạn hợp lý (không "dính trần-dính sàn" kỳ dị — có max-height hoặc padding hợp lý).

## 3. Tests

- `tests/e2e/match.spec.ts` — chạy lại, các assertion `data-match-card-id`/`data-match-side`/click phải vẫn pass (đừng sửa logic test; nếu 1 assertion về layout cũ vỡ vì vị trí, cập nhật tối thiểu cho khớp layout mới).
- Thêm assertion E2E (nếu hợp lý, trong spec hiện có): ở viewport mobile 390px, **không horizontal overflow** khi render bảng Match.
- Unit test cho helper co chữ (xem 2.2).
- Nếu có unit/component test cho `match-board` — chạy lại, cập nhật tối thiểu.

## 4. Verification

```bash
npx vitest run tests/unit/features/match
npm run check
npm run test:e2e -- match
```

## 5. Diff review trước khi kết thúc

```bash
git status
git diff --check
git diff --stat
git diff
```

Kiểm tra:

- Đúng phạm vi: `match-board.tsx` + helper mới (nếu có) + test liên quan.
- KHÔNG sửa: `match-state.ts`, `match-session.ts`, server actions, migration, DB, dependency, env, AI, các mode khác.
- Logic `selectCard`/`onSelect`/disabled/selected/matched KHÔNG đổi.
- Ô cố định — chiều cao không đổi khi chữ dài ra.

## 6. Commit

```bash
git add <task-related-files>
git commit -m "fix: render match board as fixed 6x2 grid with auto-shrinking labels"
```

**KHÔNG push** — gửi evidence report để người quản lý (tôi) review.

## 7. Evidence report

Báo:

- **Repository:** starting commit, final commit, push status (KHÔNG push), worktree.
- **Thay đổi:** tóm tắt từng file.
- **Tests:** file test, số discovered/passed/failed/skipped; kết quả `npm run check`.
- **Safety:** migrations changed NO / DB NO / dependencies NO / env NO / AI NO / production NO.
- **Ambiguities:** nếu có — ghi rõ, KHÔNG tự quyết.

---

## Ràng buộc tuyệt đối

1. CHỈ sửa layout `match-board.tsx` + helper + test — không refactor logic game, không đụng file khác.
2. KHÔNG đổi hành vi nối cặp / trạng thái / thông báo.
3. KHÔNG tạo component mới phức tạp, KHÔNG cài dependency.
4. Nếu gặp điều gì không rõ → dừng và hỏi, KHÔNG tự quyết.
