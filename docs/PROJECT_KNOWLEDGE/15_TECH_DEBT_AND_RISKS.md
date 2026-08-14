# 15. Tech Debt & Risks

> Chỉ ghi vấn đề có evidence từ code/docs/tests. Mỗi item: evidence, impact, files,
> severity, recommendation. Không phải danh sách chê code.

---

## 1. Documentation drift

| #   | Drift                                                                                                                                                                                                       | Evidence                                                                          | Impact                                                        | Severity |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------- |
| D1  | **Schema naming khác AGENTS.md** — không có `quiz_attempts`/`quiz_attempt_items`/`flashcard_learning_stats`; thực tế là `quiz_sessions`/`quiz_questions`/`card_review_events` (+ `card_learning_schedule`). | `supabase/migrations/`                                                            | AI mới nhầm tên bảng                                          | High     |
| D2  | **Env key khác AGENTS.md** — `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (không phải `NEXT_PUBLIC_SUPABASE_ANON_KEY`).                                                                                           | `.env.example`, `src/lib/env.ts`                                                  | Cấu hình sai                                                  | Medium   |
| D3  | **Route khác AGENTS.md** — `/study/[sessionId]` → `/study/session`; `/quiz/[attemptId]` → `/quiz/[sessionId]`.                                                                                              | `src/app/(app)/`                                                                  | Tìm sai route                                                 | Medium   |
| D4  | **React Hook Form không được dùng** dù AGENTS.md yêu cầu.                                                                                                                                                   | `package.json` (không có RHF); forms dùng state + Zod                             | Blueprint không phản ánh reality                              | Low      |
| D5  | **Feature `flashcards`/`streak`/`analytics` trống** dù AGENTS.md liệt kê như feature; logic nằm ở feature khác.                                                                                             | `src/features/{flashcards,streak,analytics}/.gitkeep`                             | Nhầm chỗ sửa                                                  | Medium   |
| D6  | **`docs/DEPLOYMENT.md` cũ hơn migration head** — ghi "Current local migration head: 20260810180000" nhưng repo có tới `20260813010000`; baseline test 23/23 pgTAP nhưng hiện có 25 file test.               | `docs/DEPLOYMENT.md` vs `supabase/migrations/`, `supabase/tests/`                 | Deployment checklist thiếu migration mới (strict eligibility) | High     |
| D7  | **README ghi Studio port 64323**, `config.toml` ghi `64723`.                                                                                                                                                | `README.md`, `supabase/config.toml`                                               | Nhầm port local                                               | Low      |
| D8  | **README liệt kê `src/styles/`, `src/types/`, `src/hooks/`** nhưng `styles/` không tồn tại, `hooks/`/`types/` trống.                                                                                        | `find src -type d`                                                                | Cấu trúc sai                                                  | Low      |
| D9  | **AGENTS.md mô tả route map/blueprint MVP** nhưng product đã vượt MVP (match, memory, smart review, FSRS, coverage…).                                                                                       | code + docs cũ                                                                    | —                                                             | Medium   |
| D10 | **`docs/LEARNING_MODES.md`, `QUIZ.md`…** có thể lệch nhẹ so với migration mới nhất (strict eligibility). Nên đối chiếu trước khi dùng.                                                                      | docs vs migrations 20260813xxxx                                                   | —                                                             | Medium   |
| D11 | **`middleware.ts` không tồn tại** dù AGENTS.md/`docs/AUTH.md` nhắc như auth proxy — auth guard thực tế ở `(app)/layout.tsx` (redirect) + `src/proxy.ts` (cookie refresh).                                   | `find . -name middleware*` (không có), `src/proxy.ts`, `src/app/(app)/layout.tsx` | AI đi tìm middleware sẽ lạc                                   | Medium   |

**Khuyến nghị:** khi sửa feature, cập nhật `docs/*.md` tương ứng; ưu tiên đúng theo
migrations + code.

---

## 2. Architecture drift

| #   | Vấn đề                                                                                                                                                                                                              | Evidence                                                                                                     | Severity       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------- |
| A1  | **FSRS config comment mâu thuẫn code** — `config.ts` ghi "FSRS does NOT yet influence Smart Review eligibility", nhưng `startSmartReview` đọc due từ `card_learning_schedule` (tức FSRS đã ảnh hưởng Smart Review). | `src/features/spaced-repetition/config.ts` (STATUS comment) vs `src/features/smart-review/server/actions.ts` | Medium         |
| A2  | **Business logic chính nằm trong RPC SQL** — không có service layer TS riêng; unit test SQL khó hơn.                                                                                                                | `supabase/migrations/20260813010000_harden_strict_quiz_session_creation.sql`                                 | Low (có pgTAP) |
| A3  | **`getClaims()` dùng để lấy user id** thay `getUser()` — pattern không có trong blueprint.                                                                                                                          | nhiều server actions                                                                                         | Low            |
| A4  | `tests/components/` trống; component tests nằm trong `tests/unit/components/` — README mô tả `tests/components/`                                                                                                    | `ls tests`                                                                                                   | Low            |

---

## 3. Duplication

| #   | Vấn đề                                                                                                       | Evidence                                                                        | Severity |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | -------- |
| U1  | **`loadCards` gần giống hệt nhau giữa match và memory** (3 nhánh all/set/collection + dedupe).               | `src/features/match/server/actions.ts`, `src/features/memory/server/actions.ts` | Medium   |
| U2  | **`filterCardsByMode` lặp giữa match/memory** (cùng `applyLearningFilter` + loadUncovered/wrong).            | như trên                                                                        | Low      |
| U3  | **`collectStudyCardIds` + source ownership validation lặp** giữa study/match/memory/quiz (mỗi nơi tự query). | `study/server/load-study-cards.ts`, match/memory actions                        | Medium   |

---

## 4. High-coupling modules

| #   | Module                                    | Coupling                                                                                                  | Severity |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------- |
| C1  | **`practice-coverage/server/actions.ts`** | Được quiz, match, memory dùng; phụ thuộc RPC completion + bảng coverage                                   | High     |
| C2  | **`quiz/server/actions.ts`**              | Gọi study (collectStudyCardIds), practice-coverage, spaced-repetition (reconcile)                         | High     |
| C3  | **RPC `create_quiz_session`**             | Chứa ~200 dòng logic (pool, distractor, ordering, coverage session); migration thay đổi thường xuyên nhất | High     |
| C4  | **`spaced-repetition/server/`**           | Phụ thuộc admin client + CAS RPC + reconcile orchestrator; integration test dày                           | High     |

---

## 5. Complex business logic

| #   | Vùng                                                                              | Evidence                          | Severity |
| --- | --------------------------------------------------------------------------------- | --------------------------------- | -------- |
| B1  | Quiz creation (strict pool + ordering + distractor + advisory lock + fail-closed) | migration 20260813010000          | High     |
| B2  | FSRS reconcile (replay, CAS, freshness guard, idempotency)                        | `reconcile-orchestrator.ts` + RPC | High     |
| B3  | Coverage completion + reset (advisory lock, live vs covered count)                | migration 20260812200000          | High     |
| B4  | Streak/timezone (get_learning_statistics SQL loop)                                | RPC                               | Medium   |

---

## 6. Weakly tested areas

| #   | Vùng                                                                                                    | Ghi chú                  | Severity |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------ | -------- |
| T1  | Component tests — chỉ 4 files (`unit/components`), UI chủ yếu qua E2E                                   | —                        | Medium   |
| T2  | RLS matrix — pgTAP test ownership nhưng chưa có test chi tiết từng policy insert/update/delete mọi bảng | một phần qua 003/004/009 | Low      |
| T3  | Gemini path (semantic paste/document generation) — có E2E với mock; live Gemini chỉ smoke manual        | —                        | Medium   |
| T4  | Streak RPC logic (`get_learning_statistics` loop SQL) — test gián tiếp                                  | —                        | Low      |

---

## 7. Security-sensitive areas

| #   | Vùng                                                                                            | Ghi chú                             | Severity                    |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------- |
| S1  | `admin.ts` (service role) — 4 RPC trusted; sai sót = vượt RLS                                   | rất hạn chế, CAS + ownership check  | High (cần cẩn thận khi sửa) |
| S2  | `/api/test/*` routes — bị guard bởi mock env; nếu set `FLASHLEARN_*_MOCK=1` production → active | release blocker trong DEPLOYMENT.md | High                        |
| S3  | PDF runtime isolation — chặn bằng `block-pdf-runtime.cjs`; có test                              | —                                   | Medium                      |
| S4  | Google Picker key — public, phải restrict origin/API externally                                 | —                                   | Medium                      |

---

## 8. Migration-sensitive areas

- Quiz engine RPC family (`create_quiz_session` được `CREATE OR REPLACE` 6 lần qua
  migrations) — sửa migration cũ bị cấm; phải tạo migration mới kế thừa.
- `card_learning_schedule` + `upsert_card_learning_schedule` — CAS/frozen config.
- `submit_quiz_answer` — drop + recreate (đổi return type) ở migration 20260810160000.
- Bất kỳ thay đổi `get_learning_statistics` cần đồng bộ client parse.

---

## 9. Performance-sensitive areas

| #   | Vùng                                                                                      | Ghi chú                                                         |
| --- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| P1  | Quiz creation query trên scope card ids (self-join distractor)                            | scope ≤ 50 sources, nhưng card có thể nhiều; index cần kiểm tra |
| P2  | `loadWrongAnswerCardIds` / `loadUncoveredIds` batch 200                                   | nhiều roundtrip với scope lớn                                   |
| P3  | `due-repository` paging 1000/scope                                                        | OK                                                              |
| P4  | Event table growth (`card_review_events`) — DEPLOYMENT.md ghi partitioning là future work | monitoring                                                      |

---

## 10. Generated / manual sync risks

- `src/lib/supabase/types.ts` sinh từ DB (`npm run db:types`) — sau migration mới phải
  regenerate, nếu không typecheck client có thể sai.
- `docs/DEPLOYMENT.md` baseline (migration head, test counts) là snapshot tĩnh — dễ stale.

---

## 11. Legacy / dead code

- `src/features/{flashcards,streak,analytics}` — thư mục trống (`.gitkeep`), không dead
  code thực sự.
- Không tìm thấy TODO/FIXME/HACK/XXX trong `src/` hay `scripts/` (chỉ `Hacked` trong
  string test `profile-settings.spec.ts:88` — là dữ liệu test, không phải TODO).
- Mode `balanced` vẫn tồn tại trong schema + RPC nhưng không exposed trong UI
  (quiz setup dùng `ModeFilter` unseen/wrong/random) — "dead-ish" path cố ý giữ.

---

## 12. Unresolved / cần xác minh

- Trạng thái email confirmation production (ADR 002 nói tắt; `config.toml` local bật) —
  không thể xác minh từ repo.
- Production migration head thực tế (DEPLOYMENT.md snapshot cũ).
- FSRS có thực sự ảnh hưởng Dashboard counts chưa (comment config mâu thuẫn code).
