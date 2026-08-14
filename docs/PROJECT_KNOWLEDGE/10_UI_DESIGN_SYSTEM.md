# 10. UI & Design System

> Reverse-engineered từ code thực tế. Phân biệt **intended design system** (AGENTS.md §11)
> và **implemented design system**.

---

## 1. Visual identity — "Soft Green Learning Garden"

Đúng tinh thần blueprint: xanh lá pastel, thân thiện, bo tròn, không dashboard doanh nghiệp.

**Palette thực tế** (`src/app/globals.css`):

| Token                  | Giá trị   | Ghi chú          |
| ---------------------- | --------- | ---------------- |
| `--background`         | `#f8fbf7` | nền              |
| `--surface`            | `#ffffff` |                  |
| `--surface-subtle`     | `#f1f7f3` |                  |
| `--primary`            | `#7bcfa6` | xanh lá chủ đạo  |
| `--primary-hover`      | `#65be91` |                  |
| `--primary-soft`       | `#eaf8f0` |                  |
| `--primary-foreground` | `#245c46` |                  |
| `--text-primary`       | `#20352c` |                  |
| `--text-secondary`     | `#64756d` |                  |
| `--border-soft`        | `#ddebe3` |                  |
| `--success`            | `#65be91` |                  |
| `--warning`            | `#f3a66a` |                  |
| `--danger`             | `#ef8585` |                  |
| `--info`               | `#7ab8e8` |                  |
| `--achievement`        | `#f6c85f` |                  |
| `--destructive`        | `#c4514e` | (shadcn mapping) |

**Mastery V1 tokens** (thêm so với blueprint): 4 trạng thái pastel
(`--mastery-untested`, `--mastery-review`, `--mastery-learning`, `--mastery-strong`
mỗi trạng thái có `-border` và `-dot`) — dùng cho visual mastery.

**shadcn/ui mapping:** `--card`, `--popover`, `--secondary`, `--muted`, `--accent`,
`--border`, `--input`, `--ring`, `--chart-1..5` đều map sang palette trên.

**Typography:** heading = Nunito (600/700/800), body = Be Vietnam Pro (400–700);
cả hai load qua `next/font/google` với subsets `latin, vietnamese`
(`src/app/layout.tsx`). Đúng blueprint (Nunito heading, Be Vietnam Pro body).

**Radius:** `--radius: 0.75rem`; Tailwind scale `--radius-sm/md/lg/xl` = radius −4/−2/0/+4px.

**Shadow:** `--shadow-soft-card: 0 8px 24px rgba(39, 93, 70, 0.08)` — đúng blueprint.

**Animation tokens:** `--animate-card-in` (0.18s), `--animate-fade-in` (0.12s),
`--animate-confetti` (0.7s, dùng `--confetti-x`), keyframes `confetti`, `card-in`, `fadeIn`.

---

## 2. Design tokens — nơi khai báo

- CSS custom properties: `src/app/globals.css` (`:root` + `@theme inline`).
- Tailwind v4 (không có `tailwind.config.ts` — dùng CSS-first config).
- Component dùng class semantic: `bg-surface`, `text-text-primary`, `bg-primary`,
  `border-border-soft`, `bg-mastery-review-dot`, v.v. (qua `@theme inline` mapping).
- Helper `cn()` (`src/lib/utils.ts`) — tailwind-merge + clsx.

**Khác biệt so với blueprint:** không có file token riêng (đúng blueprint là dùng
globals.css); thêm mastery tokens; fonts là Be Vietnam Pro (body) + Nunito (heading) —
blueprint cho phép cả hai.

---

## 3. Shared components

### `src/components/ui/` (primitives — danh sách nhỏ, không đủ shadcn)

| Component            | Vai trò                                             |
| -------------------- | --------------------------------------------------- |
| `button.tsx`         | Button với variants (c-v-a), `asChild` (Radix Slot) |
| `input.tsx`          | Input                                               |
| `label.tsx`          | Label (Radix Label)                                 |
| `textarea.tsx`       | Textarea                                            |
| `dialog-overlay.tsx` | Overlay cho dialog                                  |

### `src/components/layout/`

| Component              | Vai trò                                                                     |
| ---------------------- | --------------------------------------------------------------------------- |
| `app-shell.tsx`        | Shell authenticated: sidebar desktop + bottom nav mobile + `<CurrentUser/>` |
| `app-navigation.tsx`   | Nav chính                                                                   |
| `nav-items.ts`         | Danh sách item nav                                                          |
| `placeholder-page.tsx` | Placeholder route chưa xây                                                  |

### `src/components/shared/`

| Component                 | Vai trò        |
| ------------------------- | -------------- |
| `mode-tabs.tsx`           | Tabs chọn mode |
| `section-tabs.tsx`        | Tabs phân đoạn |
| `pagination-controls.tsx` | Phân trang     |

---

## 4. Navigation

- **Desktop:** sidebar (trong `app-shell.tsx` + `app-navigation.tsx`).
- **Mobile:** bottom navigation (mobile-first).
- Items trong `nav-items.ts`: dashboard, quiz, study, match, memory, sets, collections,
  history, statistics, profile/settings (xác minh danh sách chính xác trong file).

---

## 5. Major page patterns

| Pattern             | Ví dụ                                          | Ghi chú                                                                    |
| ------------------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| Dashboard           | `/dashboard`                                   | Greeting + CTA + streak + due/new counts (`dashboard-learning-status.tsx`) |
| List page           | `/sets`, `/collections`                        | Card grid/list + pagination                                                |
| Detail page         | `/sets/[setId]`, `/collections/[collectionId]` | Danh sách thẻ                                                              |
| Flashcard study     | `/study/session`                               | Card lớn, lật, prev/next, shuffle                                          |
| Quiz                | `/quiz/[sessionId]`                            | 1 câu/lần, 4 đáp án, feedback màu + icon + text, nút tiếp tục              |
| Learning mode setup | `/quiz`, `/match`, `/memory`                   | source-browser + mode-filter + question-count-selector + sticky-start-bar  |
| Match/Memory        | `/match/session`, `/memory/session`            | Board ghép cặp / grid lật ô                                                |
| Form                | profile settings, manual set form              | React Hook Form? (xem bên dưới)                                            |
| Empty/Error/Loading | nhiều trang                                    | Empty state với hành động; error boundary (`error.tsx`, `not-found.tsx`)   |

**Ghi chú form:** AGENTS.md yêu cầu React Hook Form + Zod. Implementation dùng
`zod` chắc chắn; **React Hook Form không có trong `package.json` dependencies**
(chỉ zod, c-v-a, clsx, lucide-react, dnd-kit…). Xác nhận: không có `react-hook-form`
trong package.json → **drift**: blueprint nói dùng RHF nhưng implementation không dùng.

---

## 6. Accessibility (trong code)

- `aria-label` cho icon-only buttons (xác minh từng component).
- Focus visible qua Tailwind default + custom.
- Feedback đúng/sai dùng màu + icon + text (không chỉ màu) — quiz-session.
- `prefers-reduced-motion` — chưa thấy xử lý rõ ràng trong globals.css (không có
  media query reduced-motion); blueprint yêu cầu → **drift/thiếu**.
- Keyboard: quiz đáp án dùng semantic button; flashcard lật qua button.
- Dialog overlay có focus management cơ bản (`dialog-overlay.tsx`).

---

## 7. Responsive strategy

- Mobile-first: app-shell có bottom nav mobile + sidebar desktop.
- CTA tối thiểu ~44px touch target (theo convention).
- Table preview import có scroll/card view (unified-draft-editor).
- E2E `responsive-ui.spec.ts`, `mobile-first-ui.spec.ts` kiểm tra các trạng thái này.

---

## 8. Interaction conventions

- **Drag & drop:** reorder bộ flashcard dùng `@dnd-kit` (`set-reorder-list.tsx`).
- **Motion:** card-in, fade-in, confetti (ngắn) khi hoàn thành.
- **Keyboard:** quiz/study điều hướng.
- **Seeded random:** match dùng `node:crypto` randomInt → seed cho shuffling deterministic
  per session.

---

## 9. Intended vs Implemented

| Mục                  | Intended (AGENTS.md §11)                | Implemented                                                      | Drift                |
| -------------------- | --------------------------------------- | ---------------------------------------------------------------- | -------------------- |
| Palette              | Soft green pastel                       | ✅ khớp (globals.css)                                            | Không                |
| Typography           | Nunito/Be Vietnam Pro                   | ✅ khớp                                                          | Không                |
| Radius               | Card 24–32, dialog 24, button 14–18     | `--radius 0.75rem` + scale; chi tiết per-component               | Có thể lệch nhẹ      |
| Shadow               | `0 8px 24px rgba(39,93,70,0.08)`        | ✅ `--shadow-soft-card`                                          | Không                |
| Motion               | 150–250ms, flip 300–400, reduced-motion | card-in/fade-in/confetti; **không thấy reduced-motion handling** | Thiếu reduced-motion |
| React Hook Form      | Bắt buộc                                | **Không có trong dependencies**                                  | Drift                |
| shadcn/ui primitives | Ưu tiên                                 | Chỉ 5 primitives tùy chỉnh                                       | Partial              |
| Mobile nav           | Bottom navigation                       | ✅ app-shell bottom nav                                          | Không                |

---

## 10. Nơi xem thêm

- `src/app/globals.css` — tokens + keyframes.
- `src/app/layout.tsx` — fonts.
- `src/components/layout/app-shell.tsx` — navigation shell.
- `src/features/*/components/` — page patterns theo feature.
- `docs/QA/FOUNDATION_AUDIT.md`, `MVP_RELEASE_AUDIT.md` — audit UI trước đó.
