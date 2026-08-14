# Rebrand: FlashLearn → CapyStudy (toàn UI)

> **Status:** delivered (2026-08-14) — đã duyệt, giao cho OpenCode
> **Baseline commit:** `3137b33`
> **Agent tier:** OpenCode + DeepSeek V4 Pro (chính) — task cơ học nhưng phủ toàn app + test, không cần Terra (không đụng DB/security)
> **Decisions locked (user):**
>
> - Chỉ đổi **tên thương hiệu** "FlashLearn"/"Flashlearn" → "CapyStudy". **GIỮ NGUYÊN màu xanh hiện tại**, layout, logo icon (Leaf), env names, URLs.
> - Đổi cả chuỗi **nội bộ** (log/env/AI-instruction/config) cho đồng bộ.
> - KHÔNG đổi docs (README.md, AGENTS.md, docs/**, docs/PROJECT_KNOWLEDGE/**, docs/task-prompts/**).
> - Mascot assets đã nằm trong repo (public/mascot) — không đụng trong task này.

---

## 0. Before starting

Baseline `3137b33` trên `main`. `git status` / `git log -3` / `git pull --ff-only`.

## 1. Scope

Thay chuỗi brand `FlashLearn` / `Flashlearn` → `CapyStudy` trong **toàn bộ `src/` và `tests/`** (theo danh sách file bên dưới). Chỉ đổi **chuỗi brand**, giữ nguyên nội dung câu xung quanh (chỉ thay từ thương hiệu, không viết lại câu).

## 2. Files

### UI + metadata

- `src/lib/constants.ts` — `APP_NAME = "CapyStudy"`; giữ nguyên `APP_DESCRIPTION` (đã verify: không chứa tên brand).
- `src/app/layout.tsx` — metadata title/description (2 chỗ).
- `src/app/(marketing)/page.tsx` — 2 chỗ (hero/heading).
- `src/app/(auth)/sign-in/page.tsx`, `sign-up/page.tsx` — 1 chỗ mỗi file.
- `src/app/auth/error/page.tsx`, `src/app/check-email/page.tsx` — 1 chỗ mỗi file.
- `src/components/layout/app-shell.tsx` — logo text "FlashLearn" → "CapyStudy" (2 chỗ: sidebar + mobile header).
- `src/features/imports/components/document-import.tsx`, `unified-draft-editor.tsx` — 1 chỗ mỗi file (chuỗi hiển thị).

### Nội bộ (đồng bộ)

- `src/lib/env.ts` (2), `src/lib/supabase/production-project.ts` (1).
- `src/features/spaced-repetition/config.ts` (2), `server/reconcile-orchestrator.ts` (2), `types/due-types.ts` (1), `utils/run-production-diagnostic.ts` (2).
- `src/features/imports/server/extract-document.ts` (2 — chuỗi hướng dẫn AI; thay tên brand, giữ nguyên instruction).

### Tests (cập nhật assertion theo đúng chuỗi mới)

- `tests/e2e/document-import.spec.ts`, `tests/e2e/foundation.spec.ts`.
- `tests/integration/fsrs-reconciliation.integration.test.ts`, `tests/integration/fsrs-shadow-quiz.integration.test.ts`.
- `tests/unit/components/app-shell.test.tsx`, `tests/unit/features/spaced-repetition/config.test.ts`, `replay-history.test.ts`.

## 3. GIỮ NGUYÊN

- Màu sắc / design tokens / typography (KHÔNG đổi CSS).
- Logo icon (Leaf), favicon (hiện không có file icon — không thêm).
- Tên biến env (`NEXT_PUBLIC_*`), URL, supabase project refs, slug/routes.
- Docs (README.md, AGENTS.md, docs/**, PROJECT_KNOWLEDGE, task-prompts) — KHÔNG đổi.
- Mascot assets (`public/mascot/`) — KHÔNG đụng.

## 4. Verification

1. `grep -rin "flashlearn" src/ tests/` → **0 kết quả** (bắt buộc).
2. `npm run check`.
3. E2E nếu môi trường local Supabase có: `npx playwright test foundation document-import app-shell` (hoặc spec tương đương liên quan brand).
4. Chạy thử nhanh: landing, sign-in, dashboard logo hiển thị "CapyStudy".

## 5. Diff review

- Chỉ thay chuỗi brand; không đổi logic/class/color/layout; không đổi docs; không đổi mascot assets; không đổi test sai hướng (test phải assert chuỗi mới).

## 6. Commit

```bash
git add src tests
git commit -m "chore: rebrand FlashLearn to CapyStudy"
```

Push chỉ khi: baseline trên origin/main, mọi gate pass, không thay đổi bất ngờ. Nếu nghi ngờ: không push.

## 7. Evidence report

- Repository: starting/final commit, push status, worktree.
- Files changed (từng file + số chuỗi đổi).
- Verification: grep kết quả, `npm run check`, E2E chạy/không chạy được (nêu rõ).
- Safety: migrations NO; DB NO; deps NO; env NO; AI NO; production NO; docs NO.
- Ambiguities; Verdict.
