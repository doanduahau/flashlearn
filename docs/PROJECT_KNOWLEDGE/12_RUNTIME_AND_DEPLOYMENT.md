# 12. Runtime & Deployment

> Cách dự án chạy: local dev, scripts, env, build, production, deployment.
> Không chứa secret — chỉ mô tả tên env và cách dùng.

---

## 1. Local development

**Prerequisites:**

- Node.js ≥ 20 (`package.json` engines — xác minh: README ghi ≥ 20).
- npm.
- Docker Desktop (cho Supabase local stack).
- Supabase CLI (`supabase` trong devDependencies, chạy qua `npx supabase` / npm scripts).
- Playwright chromium (`npx playwright install chromium`).

**Setup:**

```bash
npm install
cp .env.example .env.local   # điền các giá trị
npm run supabase:start       # dựng local Supabase (Postgres 15, ports 64721–64724)
npm run db:reset             # build DB từ migrations + seed
npm run dev                  # http://127.0.0.1:3000
```

- Studio: <http://localhost:64723> (README ghi 64323 — **config.toml ghi port 64723**; ưu tiên config.toml).
- Postgres local: `localhost:64722` (postgres/postgres).
- Inbucket (email confirm): port 64724.

**Lưu ý an toàn:** `src/lib/env.ts` từ chối dùng production Supabase project từ local
trừ khi `NEXT_PUBLIC_ALLOW_PRODUCTION_SUPABASE_FROM_LOCAL=1` (chỉ diagnostic có chủ đích).

---

## 2. NPM scripts

| Script                                 | Ý nghĩa                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `dev`                                  | Next dev server                                                                |
| `build`                                | Next production build                                                          |
| `start`                                | Next production server (E2E webServer dùng `npm run start`)                    |
| `lint`                                 | ESLint toàn repo                                                               |
| `typecheck`                            | `tsc --noEmit`                                                                 |
| `format` / `format:check`              | Prettier write / check                                                         |
| `test` / `test:watch`                  | Vitest (unit + integration)                                                    |
| `test:e2e`                             | `node scripts/test-e2e-local.mjs` — dựng local Supabase + app, chạy Playwright |
| `test:e2e:auth:no-confirm`             | `scripts/test-e2e-auth-no-confirm.mjs`                                         |
| `test:pdf-runtime-isolation`           | `scripts/test-production-pdf-isolation.mjs` (cần production guard)             |
| `test:pdf-worker-runtime`              | `scripts/test-production-pdf-worker.mjs`                                       |
| `fsrs:test:local`                      | `scripts/test-fsrs-local.mjs`                                                  |
| `prepare`                              | Husky install                                                                  |
| `check`                                | `lint && typecheck && test && build` — gate bắt buộc trước commit              |
| `supabase:start` / `stop` / `status`   | Quản lý stack Supabase local                                                   |
| `db:reset`                             | Build lại DB từ migrations + seed                                              |
| `db:test`                              | pgTAP test (`supabase/tests/*.sql`)                                            |
| `db:types`                             | Sinh `src/lib/supabase/types.ts` từ local DB                                   |
| `fsrs:reconcile:local` / `:production` | `tsx` scripts reconcile projection                                             |
| `fsrs:compare:local` / `:production`   | So sánh projection vs replay                                                   |
| `fsrs:diagnose:production`             | Diagnose production FSRS                                                       |

**Husky + lint-staged:** pre-commit chạy prettier + eslint --fix trên file staged
(xem `package.json` `lint-staged`).

---

## 3. Environment variables

Nguồn: `.env.example` + `src/lib/env.ts`. **Không ghi giá trị secret.**

| Variable                                           | Mục đích                               | Client/Server | Secret                       | Dùng bởi                                           |
| -------------------------------------------------- | -------------------------------------- | ------------- | ---------------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                              | URL app cho auth redirect              | Public        | —                            | auth, redirects                                    |
| `NEXT_PUBLIC_SUPABASE_URL`                         | Supabase project URL                   | Public        | —                            | mọi client                                         |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`             | Supabase anon key                      | Public        | —                            | browser/server client                              |
| `SUPABASE_SERVICE_ROLE_KEY`                        | Service role key                       | Server        | ✅                           | `admin.ts` (RPC trusted)                           |
| `GEMINI_API_KEY`                                   | Gemini API key                         | Server        | ✅                           | imports adapters (`getGeminiApiKey`)               |
| `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`               | Google OAuth web client ID             | Public        | —                            | Google Sheets import                               |
| `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`                | Google Picker/Sheets API key           | Public        | — (phải restrict origin/API) | Picker                                             |
| `NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID`                  | Google Drive app/project number        | Public        | —                            | Picker                                             |
| `NEXT_PUBLIC_ALLOW_PRODUCTION_SUPABASE_FROM_LOCAL` | Cho phép local dùng production project | Server(dev)   | —                            | env safety                                         |
| `FLASHLEARN_CLASSIFIER_MOCK`                       | Mock classifier (test-only)            | Server        | —                            | E2E runner — **không set production**              |
| `FLASHLEARN_CLASSIFIER_COUNT_FILE`                 | Counter file mock (test-only)          | Server        | —                            | E2E                                                |
| `FLASHLEARN_GENERATION_MOCK`                       | Mock Gemini generation (test-only)     | Server        | —                            | E2E — **không set production**                     |
| `FLASHLEARN_GENERATION_COUNT_FILE`                 | Counter file (test-only)               | Server        | —                            | E2E                                                |
| `FLASHLEARN_GENERATION_MOCK_FAIL_FILE`             | Failure flag (test-only)               | Server        | —                            | E2E                                                |
| `FLASHLEARN_PRODUCTION_SUPABASE_URL`               | URL cho production FSRS scripts        | Server        | —                            | `scripts/fsrs-*-production.ts`                     |
| `FLASHLEARN_PRODUCTION_PROJECT_REF`                | Project ref cho allowlist scripts      | Server        | —                            | `scripts/lib/production-identity.ts` (fail closed) |

**Quy tắc:** `NEXT_PUBLIC_*` bị bundle lúc build — đổi giá trị cần redeploy.
Không set bất kỳ `FLASHLEARN_*_MOCK=1` ở production (release blocker — bật `/api/test/*` routes).

**Lưu ý env naming drift:** `.env.example` dùng `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
(không phải `NEXT_PUBLIC_SUPABASE_ANON_KEY` như AGENTS.md §21). Đây là naming thực tế.

---

## 4. Build

```bash
npm run build
```

- Next.js 16.3.0 build (App Router, Turbopack config trong `next.config.ts`).
- `npm run check` chạy lint + typecheck + test + build — gate trước commit/deploy.

---

## 5. Production / Deployment

- **Platform:** Vercel (git push / dashboard trigger). Xem `docs/DEPLOYMENT.md`.
- **Dependencies production:** Supabase project (migrations + RLS), Google Cloud
  (OAuth + Picker + Sheets API), Gemini (server key).
- **Deployment order** (tóm tắt từ `docs/DEPLOYMENT.md`):
  1. Local gate: `npm run check`, `npm run test:e2e`, `npm run db:test`, `git status` clean.
  2. Production env: đủ biến, không mock flags.
  3. Google Cloud: OAuth origins + API key restriction.
  4. Supabase remote: so sánh migration list local vs remote; apply migration TRƯỚC app;
     drift bất ngờ → STOP.
  5. Deploy Vercel.
  6. Production smoke matrix (§8 trong DEPLOYMENT.md).
  7. Rollback: Vercel promote deployment cũ; **không rollback DB tự động**.
- **Migration safety:** migration additive; kiểm tra remote head vs local head;
  nếu remote có migration lạ → STOP, không push blind.

---

## 6. Supabase local vs production

| Aspect        | Local                                            | Production                    |
| ------------- | ------------------------------------------------ | ----------------------------- |
| URL           | `http://127.0.0.1:54321` (mặc định Supabase CLI) | project URL                   |
| Config        | `supabase/config.toml` (ports 64721–64724)       | Supabase dashboard            |
| Email confirm | bật (Inbucket)                                   | theo policy (xem ADR 002)     |
| Migrations    | `npm run db:reset` (chạy lại từ đầu)             | apply migration mới từng bước |
| Tests         | `npm run db:test` (pgTAP)                        | không chạy                    |

**Lưu ý:** README ghi Studio tại `localhost:64323` còn `config.toml` ghi `64723` —
khi dùng local, kiểm tra port thực tế từ `npm run supabase:status`.

---

## 7. Maintenance scripts

| Script                                 | Mục đích                             | Rủi ro                                                   |
| -------------------------------------- | ------------------------------------ | -------------------------------------------------------- |
| `scripts/fsrs-reconcile-production.ts` | Reconcile FSRS projection production | Ghi DB production — chỉ chạy khi cần, có guard allowlist |
| `scripts/fsrs-compare-production.ts`   | So sánh read-only                    | Read-only                                                |
| `scripts/fsrs-diagnose-production.ts`  | Diagnose                             | Read-only                                                |
| `scripts/test-production-pdf-*.mjs`    | Verify PDF isolation                 | Read-only                                                |

Tất cả production scripts require `FLASHLEARN_PRODUCTION_SUPABASE_URL` +
`FLASHLEARN_PRODUCTION_PROJECT_REF` (allowlist trong `scripts/lib/production-identity.ts`);
fail closed khi thiếu.

---

## 8. Observability

- `src/lib/logger.ts`: console logger — `info` (chỉ non-production), `warn`, `error`.
- Error boundary `src/app/error.tsx`: user-friendly retry + console.error.
- Chưa có structured logging/metrics/Sentry (ghi trong DEPLOYMENT.md như future work).
