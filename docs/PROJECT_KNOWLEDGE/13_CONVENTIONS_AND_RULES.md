# 13. Conventions & Rules

> Tổng hợp convention mà developer/AI phải tuân thủ — kiểm chứng từ code + config,
> không chỉ copy AGENTS.md. Khi rule blueprint không còn được code tuân thủ → ghi rõ
> "Historical/intended rule — implementation currently differs".

---

## 1. Folder organization

- **Feature-first:** `src/features/<feature>/` chứa `components/`, `server/`, `utils/`,
  `schemas/`, `types/` (chỉ tạo thư mục cần thiết). ✅ Implementation tuân thủ.
- Không có barrel `index.ts` chuẩn — import trực tiếp theo path. ✅
- Route groups: `src/app/(marketing)`, `(auth)`, `(app)`; `src/app/api/` cho route handlers. ✅
- Khác blueprint: `src/types/`, `src/styles/`, `src/hooks/` (trống — types/hooks nằm
  trong feature). README vẫn liệt kê `styles/` và `types/` → docs drift nhẹ.

---

## 2. Naming

| Quy tắc                                     | Ví dụ                                           | Tuân thủ             |
| ------------------------------------------- | ----------------------------------------------- | -------------------- |
| Component PascalCase                        | `QuizSession`                                   | ✅                   |
| Hook `useX`                                 | —                                               | ✅ (ít custom hooks) |
| Function/variable camelCase                 | `startQuiz`                                     | ✅                   |
| Constant SCREAMING_SNAKE (global immutable) | `FLASHLEARN_V1_W`                               | ✅                   |
| File component kebab-case                   | `quiz-session.tsx`                              | ✅                   |
| File logic kebab-case                       | `reconcile-card-schedule.ts`                    | ✅                   |
| DB snake_case                               | `quiz_sessions`                                 | ✅                   |
| Route kebab-case                            | `/study/session`                                | ✅                   |
| Tên mô tả nghiệp vụ (không `handleData`)    | `generateBalancedQuiz`, `reconcileCardSchedule` | ✅                   |

---

## 3. TypeScript

- Strict mode (`tsconfig.json`). ✅
- Không dùng `any`; dùng `unknown` + narrow. ✅ (typecheck pass).
- Tránh non-null assertion; dùng explicit handling. ✅
- `type` cho union/object đơn giản, `interface` khi cần mở rộng. ✅ (ví dụ `QuizMode` type, server action result types).
- Không enum TS — dùng union literal (`learningFilters`, `QuizMode`). ✅
- Discriminated union cho trạng thái phức tạp (`{ ok: true; ... } | { ok: false; error }` pattern). ✅
- Database types từ `src/lib/supabase/types.ts` (generated). ✅
- Schema Zod là nguồn type tại boundary. ✅

---

## 4. Import convention

- Alias `@/` → `src/`. ✅ (`vitest.config.mts` + `tsconfig.json`).
- Import type riêng khi cần (`import type { ... }`). ✅
- `server-only` guard cho module server. ✅ (spaced-repetition reconcile).

---

## 5. Server Component vs Client Component

- Server Component mặc định. ✅ (các page đều server; client chỉ khi cần state/tương tác).
- `"use client"` chỉ khi cần browser API/state/event. ✅
- Client Component nhỏ, gần nơi cần tương tác. ✅ (form, session components).
- Không biến cả page thành client vì một component con. ✅

---

## 6. Validation

- Mọi input qua Zod tại boundary: server actions dùng `*.schema.ts`. ✅
- RPC tự validate lần nữa (raise errcode). ✅
- `src/lib/env.ts` validate env khi khởi động (fail fast). ✅

---

## 7. Error handling

- Server actions trả `{ ok: false, error: string }` (tiếng Việt, không lộ chi tiết). ✅
- Không trả stack trace / lỗi DB chi tiết cho client. ✅
- `lib/mutation-error.ts` chuẩn hóa mutation errors. ✅
- Error boundary: `error.tsx`, `not-found.tsx`. ✅
- Lỗi DB map sang message generic (vd quiz `generic`). ✅

---

## 8. Database access & RLS

- Mọi bảng user-owned có `user_id` (hoặc composite FK) + RLS `*_own`. ✅
- Client không ghi trực tiếp bảng nhạy cảm; qua RPC security definer / service role. ✅
- Query luôn giới hạn theo user qua RLS + ownership. ✅
- Không tin `user_id` từ client; từ session (`getClaims().sub`). ✅
- Validate UUID và ownership trước mutation. ✅
- Dùng RPC/transaction cho multi-step (import atomic, quiz create, submit). ✅

---

## 9. Migration rules

- Không sửa migration đã áp dụng — tạo migration mới. ✅ (lịch sử `2026081xxxxx` sửa bằng
  migration additive, e.g. `20260810180000` tách từ `20260810170000`).
- Migrations phải chạy từ DB sạch (`db:reset`). ✅
- Destructive migration cần ghi chú. ✅ (xem `docs/DEPLOYMENT.md` policy).
- Migration đi kèm pgTAP test. ✅ (`supabase/tests/`).
- Apply migration TRƯỚC deploy app phụ thuộc nó. ✅

---

## 10. Styling

- Tailwind v4 CSS-first (`globals.css` `@theme`), dùng design tokens. ✅
- Không hardcode hex trong component sau khi token tồn tại. ✅ (hầu hết; kiểm tra khi thêm mới).
- Không inline style trừ giá trị động. ✅
- Dùng `cn()` cho conditional classes. ✅
- Variant semantic (`variant="success"`), tránh prop boolean chồng chất. ✅ (button c-v-a).
- Component >250 dòng cần tách (guideline — quiz-session/match-session có thể lớn). ⚠️

---

## 11. Component rules

- Ưu tiên shadcn/ui primitive — thực tế chỉ có 5 primitives tùy chỉnh trong `components/ui`. ⚠️
- Không sửa primitive theo một màn hình; tạo wrapper/variant. ✅
- Page component orchestration, không chứa toàn bộ UI + business. ✅
- Hook không che side effect khó đoán. ✅ (ít hooks).

---

## 12. Testing expectations

- Feature logic thuần có unit test trong `tests/unit/features/<feature>/`. ✅
- Invariant nghiệp vụ DB có pgTAP test. ✅
- Luồng E2E quan trọng có Playwright spec. ✅
- `npm run check` phải pass trước commit (Husky + lint-staged). ✅
- Không sửa test để che lỗi sản phẩm. ✅

---

## 13. Formatting & linting

- Prettier (`.prettierrc.json`) + ESLint flat config (`eslint.config.mjs`). ✅
- Husky pre-commit chạy lint-staged (prettier + eslint --fix). ✅

---

## 14. Dependency rules

- Không cài dependency nếu platform đã giải quyết. ✅ (dependencies gọn: xem package.json).
- Cần giải thích khi thêm dependency. ✅
- **React Hook Form:** blueprint yêu cầu RHF nhưng **không có trong package.json** —
  forms dùng state + Zod thuần. → _Historical/intended rule — implementation currently
  differs_ (xem [10_UI_DESIGN_SYSTEM.md §9](./10_UI_DESIGN_SYSTEM.md)).

---

## 15. Quy tắc nghiệp vụ bắt buộc (tổng hợp)

1. Quiz `requested == actual` question count; strict pool không backfill.
2. Snapshot câu hỏi bất biến; `source_flashcard_id` giữ identity.
3. Events immutable; projection rebuild được; CAS trên mọi write schedule.
4. FSRS config frozen (`flashlearn-v1`) — đổi tham số phải đổi parameter_set.
5. Streak theo local date (timezone profile); 1 quiz/ngày đủ duy trì.
6. Coverage chỉ ghi khi hoàn tất; reset khi scope cover hết.
7. Smart Review / New Cards không tạo quiz coverage (chỉ origin `manual`).
8. Client không ghi bảng quiz/events/projection/coverage trực tiếp.
9. Không hardcode user ID/token/sample secret.
10. Không log nội dung file import.

---

## 16. Quy ước ghi nhận từ code (chưa có trong AGENTS.md)

- Server actions dùng pattern `{ ok: true; ... } | { ok: false; error: string }`.
- Business logic nghiệp vụ quan trọng nằm trong RPC SQL, không phải service layer TS.
- Admin client (service role) chỉ cho 4 RPC trusted cụ thể.
- `getClaims()` được dùng thay `getUser()` để lấy user id trong server actions.
