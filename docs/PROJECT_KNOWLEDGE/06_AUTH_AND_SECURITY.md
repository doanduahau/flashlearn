# 06. Auth & Security

> Mô tả security model thực tế. Nguồn: `src/features/auth/`, `(app)/layout.tsx`,
> `src/proxy.ts`, `src/lib/supabase/*`, migrations, `docs/AUTH.md` (có thể lệch).

---

## 1. Supabase Auth

- **Provider:** Supabase Auth (email/password). Sign up tạo user trong `auth.users`;
  trigger `handle_new_user()` tạo `profiles` row (timezone mặc định `Asia/Ho_Chi_Minh`).
- **Email confirmation:** BẬT (`supabase/config.toml` → `[auth.email] enable_confirmations = true`;
  template `supabase/templates/confirm-email.html`). Local dev dùng Inbucket (port 64724).
- **Session:** cookie-based qua `@supabase/ssr`. Server actions/components đọc session từ cookie
  bằng server client; browser dùng browser client.

---

## 2. Luồng sign up / sign in / sign out

- `src/features/auth/server/actions.ts`:
  - `signUp` — tạo user + redirect theo `next` (an toàn: `utils/safe-redirect.ts`).
  - `signIn` — đăng nhập + redirect.
  - `signOut` — xóa session.
- UI: `components/sign-in-form.tsx`, `components/sign-up-error-display.tsx`, `components/sign-out-button.tsx`.
- Sau sign up → redirect `/check-email` (nếu confirm bật) hoặc vào thẳng.
- `/auth/confirm` (route handler) xử lý redirect từ email confirm.
- Lỗi auth → `/auth/error?error=...&error_code=...&error_description=...` (trang `src/app/auth/error/page.tsx`).
- Auth guard: `(app)/layout.tsx` fetch claims server-side và `redirect('/sign-in')` nếu
  chưa đăng nhập. Không có `middleware.ts` trong repo (xem drift D11 ở
  [15_TECH_DEBT_AND_RISKS.md](./15_TECH_DEBT_AND_RISKS.md)).

---

## 3. Proxy (auth guard + cookie refresh)

- `src/proxy.ts` (Next.js 16 `proxy` export, matcher loại trừ static assets):
  - Gọi `updateSession(request)` (`src/lib/supabase/proxy.ts`) để refresh cookies + lấy claims.
  - **Route protection:** đã đăng nhập mà vào guest route → redirect `/dashboard`;
    chưa đăng nhập mà vào protected route → redirect `/sign-in?next=<path>`.
  - Xác định guest/protected qua `src/features/auth/utils/routes.ts`.
- **Lưu ý:** không có `middleware.ts` trong repo — AGENTS.md liệt kê nhưng file không tồn
  tại; auth guard nằm ở `src/proxy.ts` + `(app)/layout.tsx` (layout là lớp phòng thủ thứ 2
  cho các route trong group `(app)`).
- Chi tiết auth flow: xem `docs/AUTH.md` (có thể lệch implementation — ưu tiên code).

---

## 4. Auth clients (browser vs server vs admin)

| Client  | File                         | Scope                  | Dùng ở đâu                                                                                   |
| ------- | ---------------------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| Browser | `src/lib/supabase/client.ts` | anon key, cookie-based | Client Components (form, interactive UI)                                                     |
| Server  | `src/lib/supabase/server.ts` | anon key, cookie-based | Server Components, server actions                                                            |
| Admin   | `src/lib/supabase/admin.ts`  | **service role key**   | Chỉ server-side; RPC trusted (reconcile FSRS, coverage session create, smart review wrapper) |

Quy tắc:

- Không import server client vào Client Component (`server-only` guard ở các module server).
- Không dùng service role key trong frontend.
- `createAdminClient()` chỉ nên dùng cho RPC đã được giới hạn
  (`upsert_card_learning_schedule`, `create_learning_coverage_session`,
  `create_owned_quiz_session_from_card_ids`, `create_owned_quiz_session_from_card_ids_new_cards`).
- `src/lib/supabase/production-project.ts`: chặn app local kết nối production Supabase
  project (trừ khi `NEXT_PUBLIC_ALLOW_PRODUCTION_SUPABASE_FROM_LOCAL=1` cho diagnostic có chủ đích).

---

## 5. Server-side authorization

- Server actions luôn lấy user từ session (không tin client gửi user_id):
  - `supabase.auth.getClaims()` → `claims.sub` (xem `authenticatedUserId` trong các actions).
- RPC security definer tự `auth.uid()` — client không truyền ownership.
- Ngoại lệ duy nhất: RPC service-role nhận `p_user_id` — chỉ được gọi từ server
  đã xác thực user (smart review, coverage session create, FSRS reconcile).

---

## 6. RLS (xem chi tiết [05_DATABASE.md §4](./05_DATABASE.md))

- Mọi bảng user-owned bật RLS, policy `*_own` (user_id = auth.uid()).
- Bảng sự kiện/projection/coverage: client chỉ SELECT (hoặc không gì cả); ghi qua RPC.
- Membership cross-user bị chặn ở tầng DB bằng composite FK
  (`special_collection_items`).

---

## 7. Input validation

- Mọi input qua Zod schema tại boundary (form, server action, URL param, RPC param):
  - `src/features/*/schemas/*.ts` (Zod 4).
  - `src/lib/env.ts` validate env khi khởi động.
- RPC tự validate input lần nữa (raise exception với errcode `22023` invalid input /
  `42501` auth / `23505` unique).
- Quiz RPC validate strict: mode, question_count bounds, scope bounds, ownership của từng
  source id, đủ thẻ/distractor, fail closed.

---

## 8. File import security

- Import file không lưu file gốc (chỉ parse + lưu payload thẻ).
- Giới hạn dung lượng/số hàng: `src/lib/constants.ts`.
- Parser chạy server-side; không thực thi macro/công thức (`xlsx` đọc dữ liệu tĩnh).
- **PDF runtime isolation:** `scripts/block-pdf-runtime.cjs` chặn `pdf-parse` chạy ngoài
  worker; có E2E `pdf-runtime-isolation.spec.ts` và scripts kiểm tra production
  (`test-production-pdf-isolation.mjs`, `test-production-pdf-worker.mjs`).
- Server re-validate payload trước khi ghi (Zod + RPC validate).
- Nội dung thẻ được normalize (`lib/normalize-content.ts`) và escape khi hiển thị
  (React mặc định; không render HTML trực tiếp từ ô Excel).

---

## 9. External API boundaries

| API                 | Key                                                                                                          | Server/Client      | Ràng buộc                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Gemini       | `GEMINI_API_KEY`                                                                                             | Server-only        | Paste import semantic generation & document classification; không bao giờ vào browser. Khi thiếu key, paste có cấu trúc vẫn chạy; continuous-text cần key. |
| Google Sheets       | `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`, `NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID` | Browser            | Google Picker/OAuth flow; không phải secret (giới hạn origin + API).                                                                                       |
| Gemini mocks (test) | `FLASHLEARN_CLASSIFIER_MOCK`, `FLASHLEARN_GENERATION_MOCK` (+ count/fail files)                              | Server (test-only) | Chỉ local E2E runner bật.                                                                                                                                  |

---

## 10. Secrets & env rules

- `.env.example` liệt kê đủ biến (xem [12_RUNTIME_AND_DEPLOYMENT.md](./12_RUNTIME_AND_DEPLOYMENT.md)).
- Không commit `.env.local`. Không đặt secret trong `NEXT_PUBLIC_*`.
- `SUPABASE_SERVICE_ROLE_KEY` chỉ dùng server-side (`admin.ts`).
- `scripts/lib/production-identity.ts`: allowlist project ref cho production scripts
  (fail closed khi thiếu/không khớp).

---

## 11. Trust boundaries

```text
Browser ──────────────► Server (Next.js) ──────────────► Supabase (Postgres + RLS)
   │                        │                                 │
   │ anon key, cookies      │ anon key (cookie session)       │ RLS policy per table
   │ user input (Zod)       │ service role (admin.ts)         │ security definer RPC
   │ Google Picker keys     │ Gemini API key (server-only)    │ composite FK ownership
   ▼                        ▼                                 ▼
  UI                       Server Actions / RPC              Database
```

| Boundary            | Dữ liệu đi qua                                                     | Kiểm soát                                                        |
| ------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Browser → Server    | form input, file (parsed client-side), selection, question answers | Zod schema, server re-parse, không tin client ownership          |
| Server → Supabase   | RPC calls, queries                                                 | RLS, security definer derive auth.uid(), revoke grants           |
| Server → Gemini     | text/paste/document content                                        | server-only key; retry policy; không log nội dung file           |
| Server (admin) → DB | projection writes, coverage session create                         | RPC service-role only, CAS/freshness guards                      |
| File input          | Excel/CSV/PDF/DOCX/paste                                           | extension + size limit, parser server-side, PDF worker isolation |

---

## 12. Security invariants (có evidence)

1. **Client filtering không bao giờ là authorization** — mọi query/RPC đều bị RLS
   hoặc security definer chặn theo `auth.uid()`.
2. **Ownership từ server/session, không từ client** — `p_user_id` chỉ xuất hiện trong
   RPC service-role, và chỉ được gọi từ server đã xác thực.
3. **Client không ghi trực tiếp bảng nhạy cảm** — events, projection, coverage, quiz
   sessions/questions đều revoke write grant; chỉ qua RPC.
4. **Fail closed** — RPC tự raise exception khi thiếu auth (`42501`), input sai (`22023`),
   stale projection (CAS), pool thiếu (quiz strict).
5. **Service role key không bao giờ vào browser** — `admin.ts` dùng `server-only`.
6. **No secret trong NEXT_PUBLIC_** — chỉ các client identifier (Google) được phép
   public và có giới hạn origin.
7. **PDF runtime bị cô lập** — có script chặn + E2E verify.

---

## 13. Lỗi & xử lý

- Server actions trả `{ ok: false, error: string }` (tiếng Việt, không lộ chi tiết kỹ thuật)
  hoặc `{ ok: true, ... }`.
- Lỗi DB không bao giờ trả thẳng cho client; map sang message chung
  (ví dụ `generic = "Không thể xử lý bài kiểm tra..."` trong quiz actions).
- `lib/mutation-error.ts` chuẩn hóa lỗi mutation.
- Error boundary: `src/app/error.tsx`, `not-found.tsx`.
