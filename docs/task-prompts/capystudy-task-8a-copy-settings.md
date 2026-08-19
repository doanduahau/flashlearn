# CapyStudy — Task 8a: Copy + Cài đặt + fix xuống dòng thẻ

> **Loại:** UI copy + CSS nhỏ — nhẹ, cơ học.
> **Tier:** Gemini — không review riêng, E2E bắt buộc.
> **Baseline commit:** commit mới nhất trên main tại thời điểm giao (SAU Task 7 mascot level đã push).
> **Quy tắc:** KHÔNG đụng file ngoài danh sách. Mỗi mục commit riêng. KHÔNG push — gửi evidence report.

---

## 0. Trước khi bắt đầu

```bash
git status
git log -5 --oneline
git pull --ff-only
```

## 1. Đổi dòng chữ trang chủ (landing + metadata)

**1.1** `src/app/(marketing)/page.tsx` — đoạn `<p>`:

Hiện tại:

```tsx
Biến bất kỳ file Excel hai cột nào thành bộ flashcard và bài kiểm tra thông minh. Học ngoại
ngữ, lập trình, công thức, luật, y khoa và nhiều nội dung khác.
```

Đổi thành (giữ nguyên style/class của `<p>`):

```tsx
tạo bộ flashcard từ tài liệu của riêng bạn. Vừa học vừa chơi cùng CapyStudy
```

**1.2** `src/app/layout.tsx` — metadata `description` hiện đang là "Biến bất kỳ file Excel hai cột nào thành bộ flashcard và bài kiểm tra thông minh." → đổi cho khớp nội dung mới (viết hoa đầu câu hợp lý):

```
Tạo bộ flashcard từ tài liệu của riêng bạn. Vừa học vừa chơi cùng CapyStudy.
```

Commit: `docs: update landing copy to CapyStudy tagline`

## 2. Copy trang chọn chế độ Học — `/study/mode`

`src/features/study/components/study-mode-select.tsx` — đổi đúng 3 chuỗi mô tả (KHÔNG đổi heading/tên chế độ, KHÔNG đổi nút):

| Cũ                                                     | Mới                              |
| ------------------------------------------------------ | -------------------------------- |
| `Ôn theo cách truyền thống, tự lật thẻ để xem đáp án.` | `thẻ truyền thống`               |
| `Lật ô và ghép đúng mặt trước với mặt sau.`            | `Ghi nhớ vị trí và nội dung thẻ` |
| `Chạy nhanh và chọn đáp án đúng.`                      | `Chướng ngại vật hay là đáp án`  |

Commit: `docs: update study mode descriptions`

## 3. Copy trang chọn chế độ Kiểm tra — `/quiz/mode`

`src/features/quiz/components/quiz-mode-select.tsx` — đổi đúng 2 chuỗi:

| Cũ                                   | Mới                  |
| ------------------------------------ | -------------------- |
| `Chọn đáp án đúng trong 4 lựa chọn.` | `Chọn đáp án đúng`   |
| `Lật ô và ghép đúng cặp thẻ.`        | `ghép 2 thẻ phù hợp` |

Commit: `docs: update quiz mode descriptions`

## 4. Cá nhân → Cài đặt: khu vực Đăng xuất

`src/app/(app)/profile/page.tsx` (nhánh `tab === "settings"`):

Hiện tại:

```tsx
<h2 id="sign-out-heading" className="text-xl font-bold">Đăng xuất</h2>
<p className="mt-1 text-sm text-text-secondary">Đăng xuất khỏi tài khoản trên thiết bị này.</p>
<div className="mt-4"><SignOutButton /></div>
```

Yêu cầu (theo đúng user):

- **BỎ** dòng `<p>` mô tả "Đăng xuất khỏi tài khoản trên thiết bị này.".
- Nút đăng xuất + chữ "Đăng xuất" nằm **trên một hàng**, thứ tự **nút → chữ**:

```tsx
<div className="flex items-center gap-3">
  <SignOutButton />
  <span className="text-sm font-medium">Đăng xuất</span>
</div>
```

- `SignOutButton` hiện là icon-only (size-9, aria-label="Đăng xuất") — GIỮ NGUYÊN component, chỉ bố trí lại layout.
- Có thể bỏ `<h2>` heading (vì chữ "Đăng xuất" đã nằm cạnh nút) — nếu bỏ thì thay `aria-labelledby="sign-out-heading"` bằng `aria-label="Đăng xuất"`. Chọn cách ít rối nhất, mobile-friendly.
- KHÔNG đổi `sign-out-button.tsx` (file riêng, ngoài phạm vi — nếu cần đổi thì báo trong report, đừng tự sửa).

Commit: `feat: simplify profile sign-out row`

## 5. Fix thẻ xuống dòng tùy tiện trong chi tiết bộ

**Vấn đề user gặp:** trong `/sets/[setId]` (và `/collections/[collectionId]`), nội dung thẻ bị xuống dòng tùy tiện dù chưa hết không gian chiều ngang, khiến thẻ phình dài theo chiều dọc.

**Nghi ngờ chính (kiểm chứng trước khi sửa):** `src/features/mastery/components/mastery-card-content.tsx` dùng `[overflow-wrap:anywhere]` — giá trị `anywhere` làm ảnh hưởng min-content sizing của flex item, khiến text wrap sớm không tận dụng chiều ngang.

Yêu cầu:

1. Kiểm tra `mastery-card-content.tsx` (dùng cho cả set detail + collection detail) — thử bỏ `[overflow-wrap:anywhere]`, giữ `break-words` + `whitespace-pre-wrap`, đảm bảo container text `min-w-0 flex-1` tận dụng hết chiều ngang.
2. Kết quả mong muốn: text dùng hết bề rộng còn trống, chỉ xuống dòng tại ranh giới từ hoặc khi từ dài bắt buộc phải cắt — thẻ không phình dọc một cách tùy tiện.
3. Không phá layout edit/delete/collection buttons (`shrink-0`) bên phải.
4. Chỉ sửa nếu chứng minh được đúng nguyên nhân; nếu nguyên nhân khác (vd flex `min-w-0` thiếu ở nơi khác) thì sửa đúng chỗ đó và ghi rõ trong report.

Commit: `fix: let mastery card text use full width before wrapping`

## 5b. BỔ SUNG — Fix wrap thẻ mobile (nguyên nhân thật đã tìm ra)

> **Cập nhật từ coordinator sau khi user test:** fix `overflow-wrap` ở mục 5 chưa hết trên mobile với nội dung dài. Đã đo thực tế ở viewport 390px:
>
> | Layout                                                     | Cột text | Chiều cao thẻ |
> | ---------------------------------------------------------- | -------- | ------------- |
> | 3 nút (Sửa/Xóa/Bộ đặc biệt) nằm NGANG cạnh text (hiện tại) | 216px    | 290px         |
> | Không có nút (text full width)                             | 356px    | 200px         |
>
> **Nguyên nhân:** trên mobile, cột nút action `shrink-0` (3 icon button ~140px) nằm cùng hàng ngang với text trong `flex min-w-0 items-start gap-3` → bóp cột text còn ~216px → text dài wrap sớm → thẻ cao hơn ~45% so với mức cần thiết.

### Yêu cầu

File: `src/app/(app)/sets/[setId]/page.tsx` (khối render `li` flashcard) — và kiểm tra `src/app/(app)/collections/[collectionId]/page.tsx` nếu cùng pattern.

- **Mobile-first:** trên mobile (< sm), hàng nút action (EditCardForm / DeleteCardButton / CardCollectionsControl) chuyển xuống **dưới text** — text dùng toàn bộ chiều ngang. Desktop (sm+) giữ nguyên nút bên phải như hiện tại.
- Cách làm gợi ý: container `li` dùng `flex flex-col gap-3 sm:flex-row sm:items-start`; text `min-w-0 flex-1`; hàng nút `flex shrink-0 items-center gap-1 self-start sm:self-auto` (hoặc cách tương đương đạt đúng mục tiêu).
- KHÔNG đổi: `MasteryCardContent`, logic edit/delete/collection, popup `CardCollectionsControl` (absolute right-0 — kiểm tra vẫn không tràn khi nút nằm dưới trên mobile).
- Xác minh: không horizontal overflow ở 390px; text dùng full width; thẻ cao tối đa theo nội dung thật (không bị bóp).

Commit bổ sung (thêm vào chuỗi 8a):

```bash
git add <các file thuộc mục 5b>
git commit -m "fix: stack set detail action buttons below text on mobile"
```

## 6. Verification

```bash
npm run check
```

E2E (bắt buộc, chạy các spec chạm trang bị sửa — nếu spec assert copy cũ thì cập nhật assert cho khớp copy mới, KHÔNG xóa test):

```bash
npm run test:e2e -- foundation primary-navigation study-mode quiz-result-collections
```

Xác nhận cuối:

- `grep -rn "Biến bất kỳ file Excel" src/` → 0 kết quả.
- `grep -rn "Ôn theo cách truyền thống\|Lật ô và ghép đúng mặt trước\|Chạy nhanh và chọn đáp án" src/` → 0.
- `grep -rn "Chọn đáp án đúng trong 4\|Lật ô và ghép đúng cặp" src/` → 0.

## 7. Commit

- 4 commit tách riêng theo mục (1→5) + 1 commit bổ sung mục 5b, mỗi commit đúng message đã ghi, chỉ stage file thuộc mục đó (KHÔNG `git add .`).

## 8. Evidence report

- Repository: start/final commit, push status.
- Từng mục: file → thay đổi → kết quả grep xác nhận.
- Mục 5: nêu rõ nguyên nhân thực tế đã tìm ra + cách sửa.
- Test: `npm run check`, E2E.
- Safety: migrations/DB/deps/env/AI/production = NO.
- Ambiguities nếu có.
- Verdict: `EVIDENCE READY FOR REVIEW` hoặc `INCOMPLETE — BLOCKER REQUIRES USER DECISION`.
