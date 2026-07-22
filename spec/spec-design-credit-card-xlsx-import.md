---
title: Credit Card XLSX Import - Itaú Billing Statement
version: 1.0
date_created: 2026-07-21
owner: elvis
tags: [import, xlsx, itau, credit-card]
---

# Credit Card XLSX Import Specification

## 1. Purpose & Scope

Add support for importing Itaú credit card billing statements in XLSX format.
The import follows a two-step flow (preview → confirm), consistent with the
existing checking account import pattern.

**Audience:** Developers implementing the feature.

## 2. Definitions

- **XLSX**: Microsoft Excel 2007+ spreadsheet format (Office Open XML)
- **Excel serial date**: Date stored as number of days since 1900-01-01
  (with leap year bug: 1900-02-29 is treated as valid)
- **Fatura Aberta**: Open/pending billing statement (Portuguese)
- **Parcela X de Y**: Installment X of Y (Portuguese)

## 3. Requirements

- **REQ-001**: Parse Itaú XLSX billing statements into transactions
- **REQ-002**: Skip "Pagamento Efetuado" (payment) rows automatically
- **REQ-003**: Include cashback credit rows as negative amounts
- **REQ-004**: Convert Excel serial dates to JavaScript Date objects
- **REQ-005**: Extract installment info from "Parcelamento" column
- **REQ-006**: Extract card name and bill month-year from XLSX metadata
- **REQ-007**: Two-step import flow: preview → confirm (like checking account)
- **REQ-008**: Auto-select expenses (amount > 0), auto-unselect credits (amount < 0)
- **REQ-009**: Deduplicate against existing DB transactions
- **REQ-010**: Support user description overrides on confirm
- **REQ-011**: Add "Credit Card XLSX" option to import type dropdown

## 4. XLSX Format Structure

**Itaú billing statement layout:**

| Row Range | Content |
|-----------|---------|
| 1-13 | Metadata: name, agency, account, card name, bill total, due date |
| 14 | Column headers: Data, Lançamento, Parcelamento, Valor, Titularidade, Nome, Tipo do cartão, Número do cartão |
| 15-42+ | Transaction rows (variable count) |
| 43+ | Footer: Subtotal, disclaimer text |

**Transaction columns:**

| Column | Field | Type | Notes |
|--------|-------|------|-------|
| B | Data | Excel serial number | Days since 1900-01-01 |
| C | Lançamento | String | Transaction description |
| D | Parcelamento | String | "Parcela X de Y" or empty |
| E | Valor | Number | Positive = expense, negative = credit |
| G | Titularidade | String | "Titular" or "Adicional" (ignored) |
| H | Nome | String | Cardholder name (ignored) |
| I | Tipo do cartão | String | "Físico" or "Virtual recorrente" (ignored) |
| J | Número do cartão | String | Masked card number (ignored) |

## 5. Parser Interface

```typescript
// src/lib/parsers/itau-xlsx.ts

type ItauXlsxTransaction = {
  date: Date;
  description: string;
  amount: number;
  installmentNumber: number | null;
  totalInstallments: number | null;
};

type ItauXlsxParseResult = {
  transactions: ItauXlsxTransaction[];
  errors: string[];
  billMonthYear: string;  // "MM-YYYY"
  cardName: string;
};

function parseItauXlsx(buffer: Buffer): ItauXlsxParseResult;
```

**Parsing algorithm:**
1. `xlsx.read(buffer, { type: 'buffer' })`
2. Get active sheet
3. Scan rows 1-13 for card name (row containing "Cartão") and bill metadata
4. Find header row by matching "Data" + "Lançamento" + "Valor"
5. Parse transactions from rows after header until "Subtotal" or empty row
6. Date conversion: `(serial - 25569) * 86400000` → `new Date(ms)`
7. Installment extraction: regex `/Parcela (\d+) de (\d+)/` on Parcelamento column
8. Filter: skip rows where description === "Pagamento Efetuado"
9. billMonthYear: extract from "Fatura Aberta - Mês/AAAA" → "MM-YYYY"

## 6. API Routes

### Preview — `POST /api/transactions/import/credit-card-xlsx/preview`

**Request:** `FormData { file: File }`

**Validation:**
- File extension must be `.xlsx`
- Parser must not return empty transactions with errors

**Response:**
```json
{
  "success": true,
  "billMonthYear": "08-2026",
  "cardName": "Itaú Personnalite Black Pontos Mastercard - final 6283",
  "items": [{
    "index": 0,
    "date": "2026-07-15",
    "description": "Luana Yuri Mysugutbarueri Bra",
    "amount": 210.00,
    "installmentNumber": 2,
    "totalInstallments": 2,
    "billMonthYear": "08-2026",
    "selected": true,
    "exists": false
  }]
}
```

### Confirm — `POST /api/transactions/import/credit-card-xlsx/confirm`

**Request:** `FormData { file: File, selectedIndices: string (JSON), userDescriptions?: string (JSON) }`

**Logic:**
1. Re-parse XLSX from file
2. Filter to selected indices
3. Deduplicate against DB `(date, description, amount)` with `source: "import"`
4. Upsert bill via `prisma.bill.upsert`
5. Batch-create via `prisma.transaction.createMany`:
   - `transactionType: "credit_card"`
   - `source: "import"`
   - `importId: crypto.randomUUID()`
   - `billId: <upserted bill id>`
6. Return `{ success, added, ignored, errors, importId, billId, billMonthYear }`

## 7. Component

**`src/components/CreditCardXlsxImport.tsx`**

- Props: `{ onUploadComplete: () => void }`
- Drag-and-drop zone with `accept=".xlsx"`
- Client-side validation: `.xlsx` extension check
- Three phases: Upload → Preview → Confirm
- Preview table: Date, Description, Installment (e.g. "2/2"), Amount, Checkbox
- Auto-select expenses, unselect credits
- Inline description editing
- "Import Selected" button → confirm API → success state

**No billMonthYear input** — extracted from XLSX metadata automatically.

## 8. Integration Changes

**Modified files:**
- `src/app/transactions/add/page.tsx` — Add "Credit Card XLSX" to dropdown

**New files:**
- `src/lib/parsers/itau-xlsx.ts`
- `src/lib/parsers/__tests__/itau-xlsx.test.ts`
- `src/app/api/transactions/import/credit-card-xlsx/preview/route.ts`
- `src/app/api/transactions/import/credit-card-xlsx/confirm/route.ts`
- `src/app/api/transactions/import/credit-card-xlsx/preview/__tests__/route.test.ts`
- `src/app/api/transactions/import/credit-card-xlsx/confirm/__tests__/route.test.ts`
- `src/components/CreditCardXlsxImport.tsx`
- `src/components/__tests__/CreditCardXlsxImport.test.tsx`

**New dependency:**
- `xlsx` (SheetJS)

## 9. Acceptance Criteria

- **AC-001**: Given a valid Itaú XLSX file, When uploaded, Then 28 transactions are parsed (for the test file)
- **AC-002**: Given the test file, When parsed, Then total amount is R$ 2,617.66
- **AC-003**: Given "Pagamento Efetuado" rows, When parsed, Then they are excluded from results
- **AC-004**: Given "Credito Programa Cashback" rows, When parsed, Then they appear as negative amounts
- **AC-005**: Given Excel serial date 46209, When converted, Then result is 2026-07-15
- **AC-006**: Given "Parcela 3 de 4" in Parcelamento column, When parsed, Then installmentNumber=3, totalInstallments=4
- **AC-007**: Given a non-xlsx file, When uploaded, Then error "File must be an XLSX" is returned
- **AC-008**: Given a CSV file, When uploaded to XLSX endpoint, Then error is returned
- **AC-009**: Given duplicate transactions in DB, When previewed, Then `exists: true` is set
- **AC-010**: Given selected transactions, When confirmed, Then transactions are created with `source: "import"` and linked to correct bill

## 10. Test Strategy

- **Parser tests**: Valid XLSX, empty file, invalid format, date conversion, installment parsing, filtering, edge cases
- **API tests**: Mock Prisma, test preview response structure, test confirm deduplication, test file extension validation
- **Component tests**: Render upload zone, file selection, preview table display, selection toggling, confirm flow
- **Validation against real file**: Use `~/Downloads/fatura-aberta-final 6283-agosto2026.xlsx` (28 rows, R$ 2,617.66)

## 11. Rationale & Context

The existing CSV import works well for manually exported data, but Itaú also
provides XLSX billing statements that contain richer metadata (installments
in a separate column, card holder info, card type). The XLSX format avoids
the fragile CSV column parsing and provides a better user experience with
automatic bill month-year extraction.

## 12. Dependencies

- **xlsx** (SheetJS) — Excel file parsing library for JavaScript/TypeScript
- **Prisma** — Database ORM for transaction and bill operations
- **Next.js** — App router API routes and React components

## 13. Validation Data

The specification was validated against the real file:
`~/Downloads/fatura-aberta-final 6283-agosto2026.xlsx`
- 28 transaction rows
- Total amount: R$ 2,617.66
- Card: Itaú Personnalite Black Pontos Mastercard - final 6283
- Bill: Fatura Aberta - Agosto/2026
