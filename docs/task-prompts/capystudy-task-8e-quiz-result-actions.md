# CapyStudy — Task 8e: Kết quả Quiz — nút "Chơi lại"/"Quay lại" phía trên

> **Loại:** UI — nhẹ–vừa.
> **Tier:** Codex + Terra (hoặc Gemini nếu Codex bận) — không review riêng.
> **Baseline commit:** commit mới nhất trên main tại thời điểm giao (SAU Task 7, 8a–8d đã push).
> **Quy tắc:** KHÔNG đụng file ngoài danh sách. 1 commit. KHÔNG push — gửi evidence report.

---

## 0. Bối cảnh

User yêu cầu (đã chốt phương án):

> "ở phần kiểm tra trắc nghiệm, sau khi hoàn thành thì các nút 'Thiết lập bài mới', 'Về màn hình chính', 'Xem lịch sử' đổi thành 'chơi lại', 'quay lại'. và hiển thị phía trên thay vì phía dưới."

**Đã chốt với user:**

- **"Chơi lại"** → dẫn về `/quiz/mode` (trang chọn chế độ kiểm tra — user chọn nguồn mới).
- **"Quay lại"** → dẫn về trang trước đó (history back, fallback `/quiz` hoặc `/dashboard`).
- Bỏ nút "Xem lịch sử" (lịch sử đã chuyển vào Cá nhân → Thống kê từ Task 4).

## 1. File sửa

`src/app/(app)/quiz/[sessionId]/result/page.tsx`

**Hiện trạng (cuối file):**

```tsx
<div className="mt-8 flex flex-wrap gap-3">
  {session.origin === "manual" ? (
    <Button asChild>
      <Link href="/quiz/mode">Thiết lập bài mới</Link>
    </Button>
  ) : null}
  <Button asChild variant={session.origin === "manual" ? "outline" : "default"}>
    <Link href="/dashboard">Về màn hình chính</Link>
  </Button>
  <Button asChild variant="outline">
    <Link href="/profile?tab=statistics">Xem lịch sử</Link>
  </Button>
</div>
```

**Yêu cầu:**

1. **Di chuyển lên phía trên:** đặt hàng nút ngay sau khối mascot + heading kết quả (sau `<div className="flex items-center gap-4">` chứa mascot/điểm, trước section streak / review). Bỏ khối nút ở cuối trang.
2. **2 nút:**
   - `Chơi lại` → `router.push("/quiz/mode")` (hoặc `<Link href="/quiz/mode">` — chọn cách nhất quán với file). Luôn hiển thị (bỏ điều kiện `origin === "manual"` — user muốn 1 nút "chơi lại" duy nhất).
   - `Quay lại` → về trang trước: dùng `useBackWithFallback` (đã có sẵn trong dự án) với fallback `/quiz` — file này là server component hiện tại, nếu cần chuyển 1 phần thành client component nhỏ hoặc tạo component con `"use client"` cho riêng hàng nút (theo đúng pattern server-first của dự án — chỉ phần cần tương tác là client).
3. Style: 2 nút cùng hàng, responsive (wrap trên mobile), khớp design token dự án.

**Không sửa:** mascot happy/sad, điểm số, streak section, smart-review/new-cards continuation, review câu trả lời, collection controls.

## 2. Verification

```bash
npm run check
npm run test:e2e -- quiz-result-collections quiz-advancement primary-navigation
```

Cập nhật assert E2E nếu spec cũ assert 3 nút cũ ("Thiết lập bài mới"/"Về màn hình chính"/"Xem lịch sử") — đổi sang 2 nút mới, KHÔNG xóa test.

## 3. Commit

```bash
git add <các file thuộc task>
git commit -m "feat: move quiz result actions to top as replay and back"
```

## 4. Evidence report

- Repository: start/final commit, push status.
- Vị trí mới của hàng nút, 2 nút, hành vi back.
- Test: `npm run check`, E2E.
- Safety: migrations/DB/deps/env/AI/production = NO.
- Ambiguities.
- Verdict: `EVIDENCE READY FOR REVIEW` / `INCOMPLETE — BLOCKER REQUIRES USER DECISION`.
