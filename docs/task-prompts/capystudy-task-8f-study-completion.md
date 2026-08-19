# CapyStudy — Task 8f: Màn hoàn thành Lật thẻ đồng nhất với Kết quả Quiz

> **Loại:** UI feature nhỏ — vừa.
> **Tier:** Codex + Terra (hoặc Gemini) — không review riêng.
> **Baseline commit:** commit mới nhất trên main tại thời điểm giao (SAU Task 7, 8a–8e đã push).
> **Quy tắc:** KHÔNG đụng file ngoài danh sách. 1 commit. KHÔNG push — gửi evidence report.

---

## 0. Bối cảnh

User yêu cầu (đã chốt phương án):

> "các thông báo chúc mừng, buồn, vui khi kết thúc màn trong /study và /quiz phải đồng nhất với nhau về style, kích thước, bố cục."

**Đã chốt:** Lật thẻ (/study/session) hiện KHÔNG có màn kết thúc (chỉ nút "Hoàn thành" ở thẻ cuối) → **thêm màn hoàn thành cho Lật thẻ** có cùng style/kích thước/bố cục với Kết quả Quiz (`/quiz/[sessionId]/result`).

## 1. Màn kết thúc Quiz (tham chiếu style)

`src/app/(app)/quiz/[sessionId]/result/page.tsx` hiện có khối:

```tsx
<div className="flex items-center gap-4">
  <MascotImage level={...} state={percentage >= 60 ? "happy" : "sad"} size={80} className="size-16 shrink-0 object-contain sm:size-20" />
  <div>
    <h1 className="text-3xl font-bold">Kết quả kiểm tra</h1>
    <p className="mt-3 text-xl">{...}/{...} đúng ({...}%)</p>
  </div>
</div>
```

→ Dùng **đúng style này** (mascot size 80, `size-16 sm:size-20`, heading `text-3xl font-bold`, text `text-xl mt-3`) cho màn hoàn thành Lật thẻ.

## 2. Màn hoàn thành Lật thẻ

### File sửa

- `src/features/study/components/study-session.tsx` — thêm state hoàn thành.
- `src/app/(app)/study/session/page.tsx` — (nếu cần) load mascotLevel để truyền xuống, giống quiz result dùng `levelFromStreak(streakSummary?.currentStreak ?? 0)` hoặc `loadMascotLevel`. Kiểm tra pattern hiện có (`loadMascotLevel` / `levelFromStreak` trong `src/features/mascot/`) và chọn cái phù hợp nhất với StudySession (client) — ưu tiên server page load rồi truyền prop xuống (server-first).

### Hành vi

1. Khi user ở **thẻ cuối cùng** và bấm **"Hoàn thành"** (nút hiện có ở `isLast`) → hiển thị **màn hoàn thành** thay vì rời trang ngay.
2. Bố cục màn hoàn thành (giống quiz result):
   - `<MascotImage level={...} state="happy" size={80} className="size-16 shrink-0 object-contain sm:size-20" />` (Lật thẻ không có điểm số — dùng `happy` hoặc `congrats`, chọn 1 và ghi rõ; nếu muốn phản ánh "hoàn thành" → `congrats` cũng hợp lý, chọn theo đúng quy ước mascot dự án).
   - Heading: `Hoàn thành!` (`text-3xl font-bold`).
   - Dòng thông tin: `Đã xem {total} thẻ` (`text-xl mt-3`, hoặc text phù hợp).
   - Nút hành động (style giống quiz result — `flex flex-wrap gap-3 mt-8`):
     - **"Chơi lại"** → bắt đầu lại phiên Lật thẻ với cùng nguồn (reload session — kiểm tra cách đơn giản nhất: `router.refresh()` nếu sessionHref giữ nguyên, hoặc `router.push(sessionHref)`).
     - **"Quay lại"** → về trang trước (`useBackWithFallback` với fallback `/study` hoặc `studyModeHrefFromSession(sessionHref)` — xem pattern có sẵn).
3. GIỮ NGUYÊN: flip card, swipe, keyboard, shuffle, thêm bộ đặc biệt, nút Thẻ trước/Tiếp theo, thanh tiến độ — chỉ thay đổi hành vi nút "Hoàn thành".

## 3. Verification

```bash
npm run check
npm run test:e2e -- study-mode
```

Cập nhật unit/component test `tests/unit/features/study/study-session.test.tsx` cho hành vi mới (nút Hoàn thành → màn hoàn thành, Chơi lại/Quay lại hoạt động). Cập nhật E2E nếu cần — KHÔNG xóa test.

## 4. Commit

```bash
git add <các file thuộc task>
git commit -m "feat: add study completion screen consistent with quiz result"
```

## 5. Evidence report

- Repository: start/final commit, push status.
- Mô tả màn hoàn thành + ảnh/block code.
- Test: `npm run check`, unit study, E2E study-mode.
- Safety: migrations/DB/deps/env/AI/production = NO.
- Ambiguities (vd chọn mascot happy vs congrats — ghi rõ đã chọn gì và lý do).
- Verdict: `EVIDENCE READY FOR REVIEW` / `INCOMPLETE — BLOCKER REQUIRES USER DECISION`.
