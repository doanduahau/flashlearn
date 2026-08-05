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
