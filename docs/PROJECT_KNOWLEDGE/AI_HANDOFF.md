# AI_HANDOFF.md

> You are entering the FlashLearn codebase. Read this before making changes.

FlashLearn: biến file Excel/CSV/paste/PDF/DOCX/Google Sheets hai cột thành bộ flashcard
và bài kiểm tra thông minh (quiz, study, match, memory, smart review, FSRS scheduling,
coverage, streak, mastery). Stack: Next.js 16 (App Router) + React 19 + TypeScript strict

- Tailwind v4 + Supabase (Auth/Postgres/RLS) + ts-fsrs 5.4.1 + Gemini (import AI) + Vitest
- Playwright.

**Docs trong pack này phản ánh current reality (snapshot commit `57da3a0`); AGENTS.md và
`docs/*.md` cũ có thể lệch — ưu tiên migrations + code khi mâu thuẫn.**

---

## 1. Reading protocol

Trước khi làm bất kỳ task nào, đọc theo thứ tự:

1. `00_START_HERE.md` — mental model nhanh + Documentation status (drift).
2. `AI_HANDOFF.md` (file này) — quy trình + dangerous areas.
3. File feature liên quan trong `07_FEATURES.md` + `04_CODEBASE_MAP.md` (nơi code).
4. Source implementation thực tế (đường dẫn trong `SOURCE_MAP.md`).
5. Migrations/tests liên quan (đường dẫn trong `SOURCE_MAP.md`; migration là nguồn sự
   thật DB).

Sau đó: search code thật trước khi sửa; không tin tưởng docs cũ.

---

## 2. Before changing code — checklist

- [ ] Xác định feature nào bị ảnh hưởng (dùng `07_FEATURES.md` + `04_CODEBASE_MAP.md`).
- [ ] Xác định server/client boundary: file cần `"use client"` không? Có thể là Server
      Component không? Mutation phải qua server action / RPC.
- [ ] Xác định table/RPC liên quan (dùng `SOURCE_MAP.md`); đọc migration bản cuối của RPC
      (có thể đã `CREATE OR REPLACE` nhiều lần).
- [ ] Kiểm tra RLS: client có được phép write table đó không? (Thường là không — qua RPC.)
- [ ] Kiểm tra validation: thêm/sửa Zod schema ở boundary (feature/schemas/*).
- [ ] Kiểm tra tests: pgTAP test nào liên quan (`supabase/tests/`), unit/integration/E2E
      nào có thể vỡ.
- [ ] Kiểm tra documentation liên quan (`docs/*.md`) — cập nhật nếu hành vi đổi.
- [ ] Nếu thêm env mới: cập nhật `.env.example` + `src/lib/env.ts` + docs.
- [ ] Nếu thêm bảng/RPC: tạo migration mới (không sửa migration cũ) + pgTAP test +
      `npm run db:types`.

---

## 3. Change impact map

### Thay database (bảng/RPC/constraint)

```
migration mới → supabase/tests (pgTAP) → npm run db:types (sinh types.ts)
→ server queries/actions (đổi select/insert theo column mới)
→ typecheck (bắt lỗi cũ ngay)
→ UI nếu hiển thị dữ liệu mới
→ docs/PROJECT_KNOWLEDGE (05_DATABASE, SOURCE_MAP, 07_FEATURES)
→ tests liên quan (unit/integration/E2E)
```

### Thay quiz engine (selection/creation/submit)

```
RPC create_quiz_session / submit_quiz_answer (migration mới)
→ quiz/server/actions.ts (param/return thay đổi)
→ quiz UI (quiz-setup, quiz-session)
→ practice-coverage (coverage completion) — nếu thay đổi origin/session semantics
→ spaced-repetition (FSRS reconcile hook)
→ statistics/streak (daily records)
→ learning-modes (nếu đổi mode/filter)
→ pgTAP 011/015/016/020/024/025 + integration fsrs-shadow + E2E quiz-advancement
```

### Thay spaced repetition (scheduling)

```
config.ts (FLASHLEARN_V1_* — ĐỔI THAM SỐ PHẢI ĐỔI parameter_set!)
→ reconcile-orchestrator / schedule-repository
→ RPC upsert_card_learning_schedule (CAS contract)
→ smart-review (due candidates) + dashboard (due/new counts) + mastery (đọc events)
→ scripts fsrs-* (reconcile/compare)
→ pgTAP 014/016/017/018/019/020 + integration fsrs-* + E2E smart-review/new-cards
```

### Thay coverage

```
flashcard_coverage / learning_coverage_sessions / RPC create+complete
→ practice-coverage/server/actions.ts
→ quiz/match/memory (cách họ tạo session + completion)
→ learning-modes (unseen filter dựa trên coverage)
→ pgTAP 022/023/024 + integration card-scope-mismatch
```

### Thay streak / statistics

```
RPC get_learning_statistics + daily_learning_records + submit_quiz_answer (ghi record)
→ statistics UI + dashboard
→ pgTAP 012 + unit statistics + E2E activity-calendar
```

---

## 4. Dangerous areas

1. **`src/features/spaced-repetition/config.ts`** — frozen config. Đổi tham số FSRS mà
   không đổi `parameter_set` sẽ phá khả năng rebuild projection.
2. **RPC `upsert_card_learning_schedule`** — CAS + freshness guard. Gọi sai revision/cursor
   → `22023`; không bypass bằng cách ghi trực tiếp bảng.
3. **RPC `create_quiz_session`** — strict pool + advisory lock + fail-closed guard.
   Không nới lỏng "backfill" hoặc "âm thầm giảm câu" — đây là invariant sản phẩm.
4. **`card_review_events`** — immutable. Không update/delete; không thêm column nullable
   mà không có backfill có chủ đích.
5. **Admin client (`createAdminClient`)** — service role. Chỉ gọi 4 RPC trusted. Không
   thêm RPC service-role mới mà không ràng buộc ownership/CAS.
6. **`submit_quiz_answer` retry idempotency** — retry cùng đáp án phải trả kết quả cũ,
   không ghi đè; retry khác đáp án → not found. Đừng phá.
7. **Coverage completion** — phải idempotent; reset phải giữ advisory lock `user:mode`.
8. **`quiz_sessions.origin`** — immutable (trigger). Coverage quiz chỉ cho `manual`.
9. **PDF runtime isolation** — đừng gỡ `block-pdf-runtime.cjs` hoặc cho pdf-parse chạy
   ngoài worker.
10. **`/api/test/*` routes + `FLASHLEARN_*_MOCK`** — test-only; không bao giờ để mock
    flag bật ở production.
11. **Migrate before deploy** — app code phụ thuộc migration mới phải deploy sau khi
    migration đã apply.
12. **`src/lib/supabase/types.ts`** — file generated; sửa tay sẽ bị overwrite bởi
    `npm run db:types`.

---

## 5. Things not to assume

- **Docs luôn đúng** — AGENTS.md / docs/*.md có drift (xem `00_START_HERE.md`
  §Documentation status và `15_TECH_DEBT_AND_RISKS.md`). Migrations + code là sự thật.
- **Client authorization đủ an toàn** — mọi query bị RLS chặn; client filter chỉ để hiển
  thị. Không bao giờ dựa vào client để bảo mật.
- **Query result không cần validate** — vẫn cần Zod tại boundary nếu input từ client.
- **Bảng có thể thay đổi trực tiếp** — bảng sự kiện/projection/coverage/quiz không được
  client write; qua RPC.
- **Migration cũ có thể sửa** — không. Tạo migration mới additive.
- **`user_id` từ client là đáng tin** — không. Luôn lấy từ session (`getClaims().sub`)
  hoặc để RPC tự `auth.uid()`.
- **Mode `balanced` có trong UI** — không; UI chỉ 3 filter (unseen/wrong/random);
  `balanced` chỉ còn trong schema/RPC.
- **FSRS đã ảnh hưởng mọi thứ** — đọc `config.ts` STATUS comment + code trước khi giả
  định; Smart Review đọc due từ schedule.
- **Repo có `src/types/`, `src/styles/`, hooks dùng chung** — không; chúng trống/không tồn
  tại. Types theo feature.

---

## 6. Definition of done (code task thường)

- [ ] `npm run check` pass (lint + typecheck + test + build).
- [ ] `npm run db:test` pass nếu đụng DB (local Supabase).
- [ ] E2E liên quan pass (`npm run test:e2e`) nếu đụng UI/flow.
- [ ] Không sửa migration cũ; migration mới + pgTAP test nếu cần.
- [ ] `.env.example` + `src/lib/env.ts` cập nhật nếu thêm env.
- [ ] `src/lib/supabase/types.ts` regenerated nếu schema đổi.
- [ ] Docs liên quan trong `docs/` và `docs/PROJECT_KNOWLEDGE/` cập nhật nếu hành vi đổi.
- [ ] Không dead code, không TODO mơ hồ, không eslint-disable/@ts-ignore tùy tiện.
- [ ] Không hardcode user id/token/secret; không log nội dung file import.
- [ ] Diff chỉ chứa thay đổi thuộc task; commit message rõ ràng theo convention
      (`feat:`, `fix:`, `chore:`, `test:`…).
