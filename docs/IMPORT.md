# Import CSV and Excel

FlashLearn imports `.csv` and `.xlsx` files in browser memory only. The uploaded source file is never sent to storage or persisted; only the set name and normalized front/back text are saved.

## Guided flow

1. Select or drop a file (maximum 5 MB).
2. Choose a worksheet when the workbook contains more than one.
3. Map distinct front and back columns.
4. Review the first 100 valid rows and summary counts.
5. Confirm to atomically create one regular set and its cards.

## Normalization and limits

- Text is converted to string, CRLF is normalized to LF, then leading/trailing whitespace is trimmed.
- Fully blank selected pairs are ignored.
- Partial rows are excluded and counted.
- Exact normalized pairs are deduplicated; the first pair is kept.
- Imports have at most 2,000 valid rows. Oversized imports are rejected, never truncated.
- Unicode, including Vietnamese text, is retained as text and rendered safely by React.

Workbook formulas/macros are not executed. SheetJS reads displayed cell data with formula handling disabled.

## Persistence and security

The client never sends `user_id`. The authenticated RPC obtains it through `auth.uid()`, validates the set and cards, creates all rows in one transaction, and rolls back everything on failure. It is executable only by `authenticated`; `anon` and `public` are explicitly denied.

---

# Document import (Phase 3D — Extraction)

Phase 3D adds **Word (.docx)** and **text-based PDF** document extraction. It is
**extraction only** — no flashcard generation, no AI calls, and no original file
persistence.

```
.docx / text PDF
      ↓
Document Extractor (server-side)
      ↓
ExtractedDocument
      ↓
Stage 3E auto-detection   (planned)
      ↓
Stage 3F AI generation    (planned, only where semantically necessary)
```

## Supported formats

- **.docx** — Word Open XML
- **.pdf** — text-based PDFs only

Not supported:

- `.doc`, `.rtf`, `.odt`
- scan-only / image-only PDFs
- OCR
- image import

## Stage 3D responsibilities

- **Extraction only.** Stage 3D does not classify document blocks, generate
  flashcards, or send document content to AI.
- **Zero Gemini calls.** DOCX extraction, text PDF extraction, and scan-only PDF
  rejection all make zero Gemini requests.
- **No original file persistence.** Uploaded files are read transiently in memory
  and discarded. No Supabase Storage upload, no file tables, no permanent storage.

## DOCX extraction

- Preserves headings, paragraphs, and tables as separate blocks.
- Preserves logical document order (e.g. heading → paragraph → table → paragraph).
- Tables are kept as `rows: string[][]` (no premature front/back mapping).
- Unicode (including Vietnamese) is retained.
- No fake pagination — DOCX page boundaries are not invented.

## PDF extraction

- Page-aware extraction: extracted blocks carry page numbers.
- Partial readable-page extraction is supported; pages without readable text are
  reported (`pagesWithoutText`) rather than failing the whole document.
- Scan-only PDFs (pages but no usable text layer) are rejected with a clear
  message.
- Encrypted / password-protected PDFs are unsupported and rejected with a clear
  message.
- No OCR, no PDF rendering, no Gemini Vision.

## Technical limits

- File max: **15 MB**
- Extracted text max: **100,000 characters**
- PDF max: **200 pages**

These are enforced server-side; oversized documents are rejected, never silently
truncated.

## Common document model

`ExtractedDocument` is a source-independent intermediate model:

```
sourceType: "docx" | "pdf"
title?            — document title (PDF metadata when available)
blocks            — ordered blocks (heading / paragraph / table)
totalCharacters
pageCount?        — PDF only
extractedPageCount? — PDF only
pagesWithoutText?   — PDF only
```

Library-specific types do not leak into domain code; the extractors are isolated
behind the server boundary.

---

# Document auto-detection (Phase 3E)

Stage 3E adds section-level classification of extracted document content. It is
**analysis only** — no flashcard generation, no import, no persistence.

```
ExtractedDocument
      ↓
Section Builder
      ↓
Deterministic Classifier
      ↓
┌───────────────────────────────┐
│                               │
High confidence             Low confidence
│                               │
deterministic result         Gemini classification
│                               │
└───────────────────────────────┘
      ↓
AnalyzedDocument
      ↓
Stage 3F generation (planned)
```

## Core principle: AI as fallback, not default

High-confidence deterministic content is never sent to AI. Only genuinely ambiguous
sections fall back to Gemini classification. Structured tables and obvious prose are
classified deterministically with zero AI calls.

## Section kinds

- **flashcard_like** — content already resembling explicit knowledge pairs (Q/A
  tables, term/definition pairs, two-column structured data).
- **prose** — continuous explanatory/narrative educational text.
- **mixed** — contains both structured pairs AND substantial prose where treating
  the whole section as one type would lose quality.
- **empty** — no meaningful textual knowledge.

## Classification process

1. **Section building:** blocks are grouped by headings. Content before the first
   heading forms its own section. Tables stay in their current section.
2. **Deterministic classification:** each section is measured for table headers
   (Question/Answer, Q/A, Term/Definition, Front/Back, etc.), paragraph dominance,
   and mixed patterns. Confidence is scored 0–1.
3. **Fallback threshold:** `DETERMINISTIC_CONFIDENCE_THRESHOLD = 0.65`. Sections
   below this threshold only are sent to Gemini for classification.
4. **Bounded AI:** at most 10 sections per document may use AI classification.
   Sections are processed sequentially (bounded concurrency).

## Gemini classifier

Reuses the existing `gemini-flash-lite-latest` model and `@google/genai` SDK from
Phase 3B. Gemini receives only the ambiguous section text and returns a structured
classification (`kind` + `confidence`). Gemini does NOT generate flashcards.

## Privacy and cost

- Only ambiguous section content is sent to Gemini. High-confidence deterministic
  sections stay local.
- No document file, extracted content, or analyzed document is persisted.
- No original file persistence (same principle as Stage 3D).
- `sourceChars` and `aiInputChars` are tracked ephemerally for efficiency inspection.

## 3E does NOT

- Generate flashcards (that is Stage 3F)
- Map `DraftFlashcard[]`
- Import or persist anything
- Modify database
- OCR PDFs
- Use Gemini Vision
- Summarize, rewrite, or modify source content

---

# Document flashcard generation (Phase 3F)

Stage 3F generates `DraftFlashcard[]` from `AnalyzedDocument` output. It is
**generation only** — no import, no persistence, no DB writes.

```
AnalyzedDocument
      ↓
Section Processing (in order)
      ↓
flashcard_like  →  deterministic conversion   (0 AI)
prose           →  Gemini grounded generation  (bounded AI)
mixed           →  hybrid (deterministic + AI)
      ↓
DraftFlashcard[]  →  validateDraftCards
      ↓
Stage 3G Preview/Edit (planned)
```

## Core principle: AI as fallback, not default

Structured knowledge converted safely via deterministic rules never calls AI.
Semantic prose is sent to Gemini with grounded, source-only prompts. Mixed
sections extract structured pairs deterministically and send only the prose
remainder to AI.

## Section processing rules

- **flashcard_like**: tables with recognized pair headers (Question/Answer,
  Q/A, Term/Definition, etc.) are converted row-by-row; header rows are
  skipped. Headerless 2-column tables produce cards from every row. Zero
  Gemini generation calls.
- **prose**: full block text is sent to the existing
  `GeminiFlashcardGenerationProvider` (Phase 3B) with grounded prompts.
  Each prose section generates at most `GEMINI_MAX_OUTPUT_CARDS` (100).
- **mixed**: tables are extracted deterministically; prose blocks are sent
  to Gemini. Source order is preserved (deterministic cards from table A,
  then AI cards from prose B, then deterministic from table C, etc.).
- **empty**: produces no cards.

## Gemini generation

- Reuses Phase 3B `GeminiFlashcardGenerationProvider` and
  `gemini-flash-lite-latest` model.
- Prompt explicitly requires: use only source content, no outside
  knowledge, preserve source language, one concept per card, concise
  front/back, no fabrication.
- Structured JSON response (`{ cards: [{ front, back }] }`).
- Retries: bounded (1 attempt per request, per Phase 3B).
- Bounded: at most 10 AI generation requests per document.

## Deduplication

Exact-match deduplication is applied after all sections are processed
(normalized whitespace, case-sensitive). No fuzzy semantic dedup, no
AI dedup call.

## Metrics (ephemeral, no persistence)

- `sourceChars`, `deterministicChars`, `aiInputChars`
- `deterministicCards`, `aiGeneratedCards`, `aiRequests`

Primary efficiency signal: `aiInputChars / sourceChars`.

## Partial failure

If one AI generation section fails, deterministic cards from other
sections survive. The result carries `warnings` indicating partial
processing. No cards are imported automatically; 3G manages the
user-facing preview/edit.

## 3F does NOT

- Import or persist flashcard sets
- Write to database
- Reclassify sections (uses 3E `AnalyzedDocument` directly)
- OCR PDFs
- Use Gemini Vision
- Persist original files, prompts, or responses

---

# Unified Preview/Edit (Phase 3G)

Stage 3G provides a single reusable draft editor for all import sources. It
accepts `DraftFlashcard[]` from any source and lets the user edit, reorder,
add, delete, and swap cards before final atomic import.

```
Excel ───────────────┐
Paste ───────────────┤
Google Sheets ───────┤
Document ────────────┤
                     ↓
             DraftFlashcard[]
                     ↓
            UnifiedDraftEditor
                     ↓
       edit / add / delete / reorder
          swap one / swap all
                     ↓
            canonical validation
                     ↓
         existing atomic import path
                     ↓
              Flashcard Set
```

## Integrated sources

- **Excel** — after file parsing and column mapping, cards flow into the editor
- **Paste** — after structured analysis or Gemini generation, cards flow into the editor
- **Google Sheets** — after column detection and mapping, cards flow into the editor
- **Document (.docx / PDF)** — after extraction → analysis → generation, cards flow into the editor

## Editor actions

| Action            | Behavior                                                   |
| ----------------- | ---------------------------------------------------------- |
| Edit Front / Back | Inline textareas per card, multiline                       |
| Delete            | Per-card ✕ button, no confirmation                         |
| Add               | "+ Thêm thẻ" appends empty card, disabled at canonical max |
| Reorder           | Drag-and-drop via @dnd-kit (pointer, touch, keyboard)      |
| Swap one          | Per-card ⇆ button, exchanges front/back                    |
| Swap all          | Global ⇄ button, reverses every card, idempotent           |

## Rules

- **No AI/deterministic provenance UI** — cards show only content, not implementation source
- **Editing triggers zero AI** — no classifier calls, no generation calls during edit
- **Invalid cards block import** — empty front/back or over-length cards disable the import button. Cards are never silently filtered before persistence.
- **Warnings may allow partial-success import** — 3F warnings are shown but don't block import when valid cards exist
- **> canonical maximum blocks import** — 3F `limitExceeded` shows a clear blocker banner, import unavailable
- **State is transient** — no draft tables, no editor-state persistence, no Supabase Storage
- **Final persistence is atomic** — uses the existing `import_flashcard_set` RPC via `importFlashcards`
- **Final edited order/value is authoritative** — cards are imported in the exact order and with the exact values shown in the editor
- **Server-side validation remains canonical** — `importPayloadSchema` Zod validation is the final gate before the RPC

## Validation architecture

FlashLearn uses a **single canonical validation chain** with no duplicate enforcement:

| Layer                                | What                                                        | Limits enforced                                                                       |
| ------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `validateDraftCards()` (client util) | Adapter/preview validation: blank, partial, duplicate       | `IMPORT_MAX_ROWS` (2000)                                                              |
| `importPayloadSchema` (Zod)          | Server boundary: name, card front/back presence + length    | `SET_NAME_MAX_LENGTH` (120), `CARD_TEXT_MAX_LENGTH` (50000), `IMPORT_MAX_ROWS` (2000) |
| `import_flashcard_set` (RPC)         | Atomic DB persistence: auth ownership, transactional insert | 1–2000 cards, validates per field in PL/pgSQL                                         |

- `IMPORT_MAX_ROWS` is defined in `src/lib/constants.ts` for the TypeScript boundaries. The
  database RPC mirrors the same numeric `2000` guard as an intentional defense-in-depth
  cross-layer contract; SQL does not import application code.
- The client-side `UnifiedDraftEditor` blocks import when any card is invalid (empty front/back or over-length) — it does NOT filter silently. The server-side Zod validator is the authoritative gate.
- No third validator exists. No rules are duplicated inconsistently.

## Internal model

```ts
type EditableDraftCard = {
  id: string; // stable ephemeral UUID, never persisted
  front: string;
  back: string;
};
```

Cards are converted from `DraftFlashcard[]` on entry and back to `DraftFlashcard[]` on import.
Stable UUIDs enable drag-and-drop reordering without index-key bugs.

---

# Phase 3H — Hardening & Production Readiness

## 3H.1 Hardening Audit & Baseline (COMPLETED 2026-08-11)

Audit across: security (11 import surfaces), test-only routes, local-vs-production safety,
reliability, AI cost/bounds, performance, mobile, privacy, DB test debt, observability.

### Baseline (at audit time)

| Check                  | Result                                                                 |
| ---------------------- | ---------------------------------------------------------------------- |
| `npm run check`        | PASS (lint 0 / typecheck clean / 851 unit tests / build clean)         |
| 007 pgTAP              | 12/12 PASS                                                             |
| Full `npm run db:test` | 015 (5/16 fail), 019 (1/29 fail), all others PASS                      |
| E2E import specs       | 11/11 PASS (unified-editor 6, paste-import 5)                          |
| E2E full suite         | infrastructure transient (stream closed early); prior baseline 114/114 |

### Historical retry recommendation (rejected by product policy)

| ID  | Issue                                                                                                                                            | Location                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| R9  | `retryOptions: { attempts: 1 }` is an intentional physical-provider-call bound. It must not be raised without explicit attempt-aware accounting. | `gemini-provider.ts:74`    |
| R10 | The classifier uses the same intentional `attempts: 1` bound.                                                                                    | `gemini-classifier.ts:121` |

### BEFORE PUBLIC BETA (9 findings)

| ID          | Issue                                                                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GS-1        | Google OAuth access token in React state — document that it's transient browser-memory only                                                                 |
| GS-2        | Google Picker API Key must have HTTP referrer + API restrictions in Google Cloud Console (operational checklist)                                            |
| R4          | `ImportWizard` file input never disables during parsing; `useTransition`'s `startTransition` never called                                                   |
| R29         | RPC migration hardcodes `2000` vs. `IMPORT_MAX_ROWS` constant — drift risk                                                                                  |
| R35         | No server-side idempotency key on import; slight double-submit risk via React batching race                                                                 |
| P15/P16/P17 | `UnifiedDraftEditor` renders all cards simultaneously, no `React.memo` — unusable on mobile at 2000 cards; add virtualization/react-window when count > 100 |
| T1          | Mock env vars (`FLASHLEARN_CLASSIFIER_MOCK`, `FLASHLEARN_GENERATION_MOCK`) not documented in `.env.example`                                                 |
| L1          | No dev-vs-production guard: connecting to production Supabase from local dev has no warning                                                                 |

### WHEN SCALE DEMANDS (9 findings)

Subscriptions, billing, content-hash cross-session dedup, production event partitioning, idempotency, debounce wrapper, stale-key edge cases, hardcoded limits that match constants.

### 015 root cause

**Actual:** `select id from public.quiz_sessions limit 1` without ordering. E2E tests leave `quiz_sessions` rows in the local database. The test's transaction sees those pre-existing rows, and `limit 1` picks a stale E2E session (10 questions, origin `manual`) instead of the test's own newly created session. Tests 9-12, 16 assertions use wrong session → wrong values + UUID parse error. Fix: store the return value of `create_owned_quiz_session_from_card_ids` directly via `set_config(explicit.session_id, function_call::text)`. Plan(34) was correct; all 34 assertions preserved.

### 019 root cause

**Actual:** `select projection_revision from public.card_learning_schedule` without WHERE clause. E2E tests and other pgTAP suites leave rows in `card_learning_schedule`. The test's transaction sees pre-existing rows, causing the unscoped subquery to return multiple rows → "more than one row returned". Fix: add `where user_id = ... and flashcard_id = ...` to all 10 unscoped queries and the 1 unscoped UPDATE. Plan(29) was correct; all 29 assertions preserved.

### 3H.2–3H.5 Status

- 3H.2: Security / reliability fixes (FIX NOW items + BEFORE PUBLIC BETA items) ✅
- 3H.3: Full database test green ✅ — all 23 files PASS, 408 tests, 0 failures
- 3H.4: Production readiness (env docs, deployment checklist, operational hardening)
- 3H.5: Deploy + production smoke test
- 3H.3: Full test green (`npm run db:test` all PASS)
- 3H.4: Production readiness (env docs, deployment checklist, operational hardening)
- 3H.5: Deploy + production smoke test

## 3H.2 Security and reliability fixes

- Gemini generation and classification intentionally retain `retryOptions: { attempts: 1 }`.
  This bounds one logical AI request to one SDK attempt and avoids hidden retry amplification.
- `ImportWizard` uses explicit parsing state plus an in-flight ref. Its file control is disabled
  while parsing, duplicate change/drop events are ignored, and both success and failure restore
  the control for a later file.
- `UnifiedDraftEditor` keeps its disabled pending button and adds an in-flight ref so same-tick
  double clicks cannot create concurrent browser import requests. This is client reliability only;
  server-side import idempotency remains a public-beta item.
- Local development refuses the configured production Supabase project by default. The non-secret
  `NEXT_PUBLIC_ALLOW_PRODUCTION_SUPABASE_FROM_LOCAL=1` override exists only for deliberate local diagnostics;
  production deployments and local Supabase E2E are unaffected.
- The E2E-only `FLASHLEARN_CLASSIFIER_*` and `FLASHLEARN_GENERATION_*` variables are documented in
  `.env.example`. The instrumentation routes return 404 unless their matching server environment
  mock flag is `1`; their file paths always come from trusted server environment variables.
- The 2,000-card guard remains a mirrored TypeScript/Zod/database RPC invariant. Invalid editable
  cards block final persistence and the database remains the final atomic guard.
- 015 and 019 pgTAP failures remain deliberately deferred to 3H.3. No 3H.2 change alters their
  current failure signatures.
- The editable list remains non-virtualized. Revisit virtualization only when measured scale or
  responsiveness data justifies it.
