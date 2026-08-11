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
