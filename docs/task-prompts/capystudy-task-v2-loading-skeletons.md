# CapyStudy Task V2 — Loading skeleton cho mọi trang + prefetch link chính

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `27b6f60` (đã push; KHÔNG phụ thuộc V1 — làm song song được, nhưng nếu chạy cùng repo hãy đợi V1 xong để tránh đè commit)
- `Agent tier`: Gemini (implementer) — không chạm DB nên không cần review độc lập bắt buộc
- `Commit message`: `feat: add loading skeletons and prefetch key links`
- `Push`: KHÔNG push — gửi evidence report; chỉ push sau khi coordinator verify + user duyệt

## 1. Yêu cầu (từ user)

> "Chuyển qua lại các trang cảm giác chậm — đặc biệt vào trang tổng quan phải chờ lâu mới hiện gì đó."

## 2. Chẩn đoán

- Dashboard và nhiều trang authenticated KHÔNG có `loading.tsx` → khi điều hướng, Next.js chờ toàn bộ server render xong mới hiển thị → màn trắng (cảm giác "chậm/đứng")
- Hiện chỉ có 3 loading.tsx: `quiz`, `statistics`, `study`
- Design token đã có sẵn (Soft Green Learning Garden) — skeleton phải dùng token, không hardcode màu

## 3. Phạm vi task

1. **`loading.tsx` cho các trang còn thiếu** (theo route map AGENTS.md §8):
   - `/dashboard`, `/sets`, `/sets/library`, `/sets/[setId]`, `/sets/create`, `/collections`, `/collections/[collectionId]`, `/quiz/mode`, `/match`, `/memory`, `/study/mode`, `/runner`, `/profile`, `/share/[token]` (nếu chưa có)
2. **Skeleton component dùng chung** `src/components/shared/page-skeleton.tsx`:
   - Layout skeleton: header placeholder + vài block `animate-pulse` bo tròn theo token (`rounded-2xl border border-border-soft bg-surface`)
   - KHÔNG cần mô phỏng chính xác từng trang — 1 skeleton chung kiểu "khối nội dung" là đủ, giữ thống nhất
   - Mascot `state="thinking"` level={1} size 64 ở giữa cho các trang trống? (tùy chọn — chỉ nếu đơn giản, không bắt buộc)
3. **Prefetch link chính**:
   - `dashboard/page.tsx`: Link "Bắt đầu bài test hôm nay" / smart-review / new-cards → `prefetch`
   - `app-navigation.tsx` (nav chính): prefetch các route authenticated chính (dashboard, sets, study, quiz) — Next tự prefetch in-viewport trong production, chỉ thêm tường minh nếu cần
   - Kiểm tra: `next/link` `prefetch` prop mặc định `true` cho static; với dynamic pages vẫn prefetch RSC payload — xác nhận hành vi thực tế, không phình bundle
4. **KHÔNG đụng**: logic server, DB, quiz/study engine, View Transitions (V3)

## 4. Thiết kế chi tiết

### 4.1. PageSkeleton

```tsx
// src/components/shared/page-skeleton.tsx (server component, không "use client")
export function PageSkeleton({ title }: { title?: string }) {
  return (
    <main className="mx-auto w-full max-w-5xl p-3 sm:p-8">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-surface-subtle" />
      <div className="mt-4 h-28 animate-pulse rounded-2xl border border-border-soft bg-surface sm:h-36" />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
        <div className="h-24 animate-pulse rounded-xl border border-border-soft bg-surface sm:rounded-2xl" />
        <div className="h-24 animate-pulse rounded-xl border border-border-soft bg-surface sm:rounded-2xl" />
      </div>
      <div className="mt-3 h-40 animate-pulse rounded-2xl border border-border-soft bg-surface sm:rounded-3xl" />
    </main>
  );
}
```

- Mỗi `loading.tsx` chỉ cần: `export default function Loading() { return <PageSkeleton />; }`
- Đọc trước 1 file loading.tsx hiện có (vd `study/loading.tsx`) để giữ style nhất quán — chọn 1 pattern
- Tôn trọng `prefers-reduced-motion` (AGENTS §11.6): `animate-pulse` của Tailwind đã tắt với reduced-motion? Verify — nếu không, thêm class có điều kiện hoặc chấp nhận pulse nhẹ (không chuyển động lặp lớn)

### 4.2. Prefetch

- Chỉ thêm `prefetch` cho link hành động chính (dashboard CTA → quiz/study), không prefetch toàn bộ nav nếu bundle phình
- Đo trước/sau nếu được: `npm run build` output size không tăng đáng kể

## 5. Verification gates (bắt buộc)

1. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
2. Unit test: `page-skeleton.test.tsx` (render được, có role/aria-label hợp lý — không cần assert animation)
3. E2E: các spec chạm navigation vẫn pass — `npm run test:e2e -- foundation primary-navigation mobile-first-ui`
4. Manual (báo trong evidence): vào /dashboard trên mạng chậm (hoặc dùng Playwright throttling nếu có thể) → thấy skeleton ngay thay vì màn trắng
5. `git diff --check` sạch

## 6. Files dự kiến

- `src/components/shared/page-skeleton.tsx` (mới)
- `src/app/(app)/<route>/loading.tsx` — nhiều file (xem §3.1)
- `src/app/(app)/dashboard/page.tsx` (prefetch CTA — nếu cần)
- `src/components/layout/app-navigation.tsx` (prefetch nav chính — nếu cần)
- `tests/unit/components/shared/page-skeleton.test.tsx` (mới)
- KHÔNG đụng: DB, server actions, logic nghiệp vụ

## 7. Lưu ý cho implementer

- loading.tsx trong App Router hiển thị ngay khi navigation bắt đầu (streaming) — đây chính là thứ loại bỏ "màn trắng"
- KHÔNG thêm "use client" vào skeleton (thuần server OK)
- KHÔNG hardcode màu — dùng design token Tailwind có sẵn (`bg-surface`, `bg-surface-subtle`, `border-border-soft`)
- Nếu 1 route có loading.tsx rồi (quiz/statistics/study) → giữ nguyên, không sửa trừ khi không nhất quán nghiêm trọng

## 8. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files), push status: NOT pushed
Trích code: PageSkeleton (ngắn) + 1 loading.tsx
Verification:
- npm run check: lint X/Y, typecheck, unit N passed, build OK
- Unit page-skeleton: N/N PASS
- E2E regression: foundation primary-navigation mobile-first-ui: N/N PASS
- git diff --check: PASS
Safety: migrations/DB NO · deps NO · env NO · AI NO · production NO
Ambiguities: <skeleton chung vs riêng từng trang; prefetch bundle size>
```
