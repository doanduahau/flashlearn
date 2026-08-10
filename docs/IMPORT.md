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
