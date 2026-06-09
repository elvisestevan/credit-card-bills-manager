# User Description Field for Transactions

Date: 2026-06-09

## Problem

Bank-provided transaction descriptions are often generic codes (e.g., "PAGAMENTO\*NETFLIX\*", "BOLETO 12345") that don't help the user recall what a transaction was. Users need a personal label field they control.

## Solution

Add an optional `userDescription` string field to the Transaction model — user-editable, human-readable, and searchable. The field starts empty; the user fills it in where convenient (import preview, list view, manual entry). The app auto-suggests previous labels for the same bank description to speed up the process.

## Data Model

- **Prisma**: `userDescription String?` on the `Transaction` model
- **TypeScript**: `userDescription: string | null` on both `Transaction` and `TransactionListResponse['data']`

## Auto-Suggest

A new endpoint `GET /api/transactions/user-description-suggestions?description=<bankDescription>` returns the most common `userDescription` for past transactions with the exact same bank description. Used in import previews and manual entry for convenience.

Query:

```sql
SELECT userDescription, COUNT(*) as count
FROM Transaction
WHERE description = ? AND userDescription IS NOT NULL
GROUP BY userDescription
ORDER BY count DESC
LIMIT 1
```

Returns `{ userDescription: string | null, count: number }`.

## API Changes

| Route | Change |
|-------|--------|
| `PATCH /api/transactions/[id]` | Accept `userDescription` in body, update field |
| `GET /api/transactions` | Include `userDescription` in response data; search also covers it |
| `GET /api/transactions/user-description-suggestions` | **New** — returns suggested label for a bank description |
| `POST /api/transactions/import` | Accept `userDescription` per transaction in batch |
| `POST /api/transactions/import/checking-account/confirm` | Accept `userDescription` per transaction |

## UI Changes

| Component | Change |
|-----------|--------|
| `TransactionListView.tsx` | New `userDescription` column with inline editing (click-to-type, blur-to-save), plus `"Add label..."` placeholder when null |
| `ManualEntryForm.tsx` | Optional `userDescription` field below Description, with auto-suggest on type |
| `FileUpload.tsx` | Editable `userDescription` column in preview rows, pre-populated via suggestions API |
| `CheckingAccountImport.tsx` | Editable `userDescription` column in preview rows, pre-populated via suggestions API |

## Out of Scope

- Sorting/filtering by `userDescription` (can be added later)
- Bulk `userDescription` editing (follows existing PATCH-per-transaction pattern)
- Dedicated detail/edit page (inline editing covers the need)
