---
title: Checking Account Transactions Import Feature Specification
version: 1.0
date_created: 2026-06-01
last_updated: 2026-06-01
owner: Elvis
tags: [app, design, feature, checking-account, import]
---

# Introduction
This specification defines the requirements, constraints, interfaces, and validation criteria for adding checking account transaction import capabilities to the Credit Card Bills Manager application. The feature enables users to import bank statement CSVs (semicolon-delimited, no header), preview transactions with selection checkboxes, auto-assign transactions to bills by month, and filter the dashboard by transaction type (credit card, checking account, or both).

## 1. Purpose & Scope
### Purpose
Enable users to import checking account transactions alongside existing credit card transactions, normalize both to a consistent expense/refund convention, provide a two-step import workflow (preview → confirm) for transaction selection, and add type-based filtering throughout the application.

### Scope
This specification covers:
- Addition of a `transactionType` field (`credit_card` | `checking_account`) to the Transaction model
- New checking account CSV parser (semicolon-delimited, Brazilian decimal format, no header)
- Two-step import API: preview (parse + auto-select debits) and confirm (save selected transactions)
- New import page at `/checking-account/import` with file upload, preview table with checkboxes, and confirm button
- Amount normalization: checking account amounts are negated on parse so positive = expense, negative = refund (matching credit card convention)
- Auto-month assignment: each transaction's date determines its bill month-year, supporting multiple bills per CSV
- Dashboard tabs: "All", "Credit Card", "Checking Account" filtering all charts
- Sidebar navigation item: "Import Checking"
- `type` query parameter on bills, transactions, and dashboard APIs

### Intended Audience
Software developers, QA engineers, product owners, and technical stakeholders involved in implementing or validating the feature.

### Assumptions
- The existing application uses Prisma with SQLite, Next.js 16 App Router, TypeScript, and Tailwind CSS v4
- The existing credit card import flow remains unchanged
- Bills can contain both credit card and checking account transactions simultaneously
- CSV files must be semicolon-delimited with no header row
- Date format in CSV is DD/MM/YYYY
- Amount format uses Brazilian notation (comma decimal, period thousands separators)
- Positive amounts in the raw CSV are debits (money leaving the account), negative amounts are refunds/credits
- All amounts are negated on parse to normalize: positive = expense, negative = refund

## 2. Definitions
| Term | Definition |
|------|------------|
| Checking Account Transaction | A transaction imported from a checking account CSV, with `transactionType = "checking_account"`. No installment fields |
| Credit Card Transaction | A transaction imported from an Itau CSV, with `transactionType = "credit_card"`. May have installment fields |
| Transaction Type | A discriminator field on Transaction records indicating the source: `"credit_card"` or `"checking_account"` |
| Amount Normalization | The conversion applied to checking account amounts on parse: raw values from CSV are negated so that debits (expenses) become positive numbers and credits (refunds) become negative numbers, matching the credit card convention |
| Preview | The first step of the checking account import: parse CSV, display transactions in a table with checkboxes, auto-select debits (positive after negation) |
| Confirm | The second step of the checking account import: save the user-selected transactions to the database, each assigned to its month's bill |

## 3. Requirements, Constraints & Guidelines
### Requirements
- **REQ-001**: Add a `transactionType` string field to the Transaction model with default `"credit_card"`
- **REQ-002**: Create a new checking account CSV parser that handles semicolon-delimited, no-header CSV with DD/MM/YYYY dates and Brazilian decimal amounts
- **REQ-003**: Negate all amounts on parse so positive = expense/debit (red), negative = refund/credit (green), matching credit card convention
- **REQ-004**: Implement a two-step import flow: preview (parse → display with checkboxes) and confirm (save selected)
- **REQ-005**: Auto-select debit transactions (positive after negation) in the preview; auto-unselect credit transactions (negative after negation)
- **REQ-006**: Auto-assign each transaction to its month's bill based on the transaction date; create bills as needed
- **REQ-007**: Support a single CSV containing transactions spanning multiple months
- **REQ-008**: Add a new page at `/checking-account/import` with the full import workflow
- **REQ-009**: Add "Import Checking" navigation item to the sidebar
- **REQ-010**: Add "All", "Credit Card", and "Checking Account" tabs to the dashboard, filtering all charts
- **REQ-011**: Add optional `type` query parameter to all bill, transaction, and dashboard API endpoints
- **REQ-012**: Deduplicate checking account transactions by date + description + amount (same as credit card)
- **REQ-013**: Return `transactionType` in all transaction list API responses

### Constraints
- **CON-001**: Existing credit card import flow must remain unchanged
- **CON-002**: Amount normalization (negation) must be consistent between preview and confirm endpoints
- **CON-003**: Checking account transactions have no installment concept (installment fields are always null)
- **CON-004**: The dashboard tabs apply globally to all charts in both Global and Monthly sections
- **CON-005**: A bill can contain both credit card and checking account transactions simultaneously

### Guidelines
- **GUD-001**: Follow existing parser pattern in `src/lib/parsers/itau.ts` when creating `checking-account.ts`
- **GUD-002**: Reuse the existing `Bill` model for grouping; do not create a separate model for checking account transactions
- **GUD-003**: Use the same validation and dedup patterns as the credit card import route
- **GUD-004**: Preserve existing pagination, filtering, and sorting in transaction list views

## 4. Interfaces & Data Contracts
### Prisma Schema Changes
Add `transactionType` to Transaction model:
```prisma
model Transaction {
  // ... existing fields
  transactionType String @default("credit_card")
  // values: "credit_card" | "checking_account"
}
```

### Types (`src/types/index.ts`)
```typescript
export type TransactionType = "credit_card" | "checking_account";

export interface CheckingAccountTransaction {
  date: Date;
  description: string;
  amount: number;
}

export interface CheckingAccountPreviewItem {
  index: number;
  date: string;
  description: string;
  amount: number;
  billMonthYear: string;
  selected: boolean;
}
```

### API Endpoints
#### POST /api/transactions/import/checking-account/preview
Accepts multipart/form-data: `file` (CSV file).
Returns:
```json
{
  "success": true,
  "items": [
    {
      "index": 0,
      "date": "2026-05-19",
      "description": "COR OPERACOES B3",
      "amount": 702.45,
      "billMonthYear": "05-2026",
      "selected": true
    }
  ],
  "errors": ["Row 1: Invalid amount"]
}
```
- `amount` is already negated (CSV `-702,45` → `702.45`)
- `selected` is `true` for `amount > 0` (debits/expenses after negation)
- `billMonthYear` derived automatically from transaction date

#### POST /api/transactions/import/checking-account/confirm
Accepts multipart/form-data: `file` (CSV file), `selectedIndices` (JSON string of number[]).
Returns:
```json
{
  "success": true,
  "added": 15,
  "ignored": 2,
  "errors": [],
  "importId": "uuid",
  "billIds": ["bill1", "bill2"],
  "billMonthYears": ["05-2026", "06-2026"]
}
```
- Re-parses the file server-side (does not trust client data)
- Deduplicates by date + description + amount within the same bill
- Creates bills for months that don't exist yet
- Each transaction gets `transactionType: "checking_account"`

### UI Routes
- `/checking-account/import`: Import page with upload → preview table → confirm

## 5. Acceptance Criteria
- **AC-001**: Given a user uploads a checking account CSV, When the preview loads, Then transactions parsed from the CSV are displayed in a table with Date, Description, Amount, and Bill (MM-YYYY) columns
- **AC-002**: Given a checking account CSV with both debits (negative in CSV) and credits (positive in CSV), When the preview loads, Then debits are shown as positive amounts (auto-selected) and credits as negative amounts (auto-unselected)
- **AC-003**: Given a user unchecks some transactions in the preview, When they click "Import Selected", Then only the checked transactions are saved to the database
- **AC-004**: Given a CSV with transactions from May and June, When imported, Then May transactions go to the 05-2026 bill and June transactions to the 06-2026 bill
- **AC-005**: Given a user switches the dashboard tab to "Checking Account", When the page loads, Then only checking account transactions are shown in all charts
- **AC-006**: Given a user switches the dashboard tab to "All", When the page loads, Then all transactions (credit card + checking account) are shown
- **AC-007**: Given a user navigates to `/checking-account/import`, When the page loads, Then the sidebar "Import Checking" link is highlighted as active

## 6. Test Automation Strategy
- **Test Levels**: Unit (parsers), Integration (API routes)
- **Frameworks**: Vitest (existing test runner)
- **Test Coverage**: 9 parser tests for checking-account.ts covering valid CSV, dates, thousands separators, wrong column count, empty CSV, empty lines, invalid dates, invalid amounts, missing fields
- **CI/CD Integration**: All 69 tests (8 existing + 1 new test file) pass via `bun run test`

## 7. Rationale & Context
The existing application only supports credit card transactions. Users also need to track checking account spending. Rather than building a separate application, adding checking account support to the existing app allows unified financial tracking with a single dashboard, categorization workflow, and bill grouping system. The amount normalization ensures consistent visual treatment (red for expenses, green for refunds) regardless of source.

## 8. Dependencies & External Integrations
### External Systems
None.

### Third-Party Services
None.

### Infrastructure Dependencies
- SQLite database (`dev.db`) — Must support Prisma schema migration for the new `transactionType` field
- Next.js 16 App Router — Required for the new `/checking-account/import` page and API routes

### Data Dependencies
- Checking account CSV format defined in `src/lib/parsers/checking-account.ts`

## 9. Examples & Edge Cases
### CSV Parse Example
Input:
```
19/05/2026;COR OPERACOES B3;-702,45
19/05/2026;REND PAGO APLIC AUT MAIS;0,04
```
After negation:
- `-702,45` → `+702.45` (expense, auto-selected)
- `0,04` → `-0.04` (refund, auto-unselected)

### Edge Cases
1. **Positive amount in CSV**: `0,04` (credit/income) → stored as `-0.04` (refund, green). Correct: it's money coming in.
2. **Thousands separator**: `1.500,50` → parsed as `1500.50` (after removing dots + comma normalization). After negation: `-1500.50` is expense.
3. **Negative debit**: `-702,45` → parsed as `-702.45`. After negation: `+702.45` (expense, red). Correct: it's money leaving.
4. **Multiple months in one CSV**: Transactions from May and June create or use existing 05-2026 and 06-2026 bills automatically.
5. **Duplicate re-import**: Same CSV imported twice: second import shows all transactions as already existing (ignored).
6. **Already imported transaction in different bill**: Cannot happen because bill is derived from date, not user-specified. A given transaction always maps to the same bill.
7. **Empty file**: Returns parse error, no transactions imported.
8. **Dashboard tab with no data**: "Checking Account" tab when no checking transactions exist → shows "No data available" in GlobalSection, "No bills available" in MonthlySection. No crash.

## 10. Validation Criteria
- All Acceptance Criteria (AC-001 to AC-007) are satisfied
- Prisma schema migration for `transactionType` runs successfully
- All 69 existing and new tests pass
- `bun --bun run lint` completes with 0 errors
- `bun --bun run build` succeeds with no TypeScript errors
- New `/checking-account/import` page renders correctly per REQ-008
- Dashboard tabs filter correctly per REQ-010

## 11. Related Specifications / Further Reading
- [AGENTS.md](AGENTS.md) - Dev commands, tech stack, and file references
- [prisma/schema.prisma](prisma/schema.prisma) - Data model with `transactionType`
- [src/lib/parsers/checking-account.ts](src/lib/parsers/checking-account.ts) - Checking account CSV parser
- [src/app/checking-account/import/page.tsx](src/app/checking-account/import/page.tsx) - Import page UI
- [src/app/api/transactions/import/checking-account/preview/route.ts](src/app/api/transactions/import/checking-account/preview/route.ts) - Preview API
- [src/app/api/transactions/import/checking-account/confirm/route.ts](src/app/api/transactions/import/checking-account/confirm/route.ts) - Confirm API
