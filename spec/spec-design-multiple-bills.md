---
title: Multiple Credit Card Bills Management Feature Specification
version: 1.0
date_created: 2026-04-30
last_updated: 2026-05-04
owner: Elvis
tags: [app, design, feature, bills, credit-card]
---

# Introduction
This specification defines the requirements, constraints, interfaces, and validation criteria for adding multiple credit card bill management capabilities to the Credit Card Bills Manager application. The feature enables users to associate imported transactions with specific billing cycles (identified by month-year), prevents transaction duplication across billing cycles, and provides UI for bill visualization and filtered transaction viewing.

## 1. Purpose & Scope
### Purpose
Enable users to manage multiple credit card billing cycles, each identified by a month-year (MM-YYYY) value, ensure transactions are uniquely associated with a single billing cycle, and provide intuitive UI for bill management and transaction filtering.

### Scope
This specification covers:
- Updates to the data model (Prisma schema) to add a `Bill` model and associate `Transaction` records with bills
- Modifications to the existing CSV import flow to prompt for bill identification and validate transaction uniqueness across bills
- Implementation of a new Bills visualization screen
- Updates to the existing Transactions list UI to display bill context and support bill-based filtering

### Intended Audience
Software developers, QA engineers, product owners, and technical stakeholders involved in implementing or validating the feature.

### Assumptions
- The existing application uses Prisma with SQLite, Next.js 16 App Router, TypeScript, and Tailwind CSS v4
- The existing `Transaction` model and CSV parsing logic (Itau format) remain functional and are extended, not replaced
- Users understand the standard MM-YYYY format for billing cycles
- If the specified `monthYear` does not exist during import, a new `Bill` record is auto-created

## 2. Definitions
| Term | Definition |
|------|------------|
| Bill | A credit card billing cycle identified by a unique month-year string in MM-YYYY format |
| Bill ID | The month-year string (MM-YYYY) assigned to a bill during import |
| Transaction | A credit card transaction imported from a CSV file, associated with exactly one Bill. Uniqueness is determined by a composite key of description + date + amount |
| Installment Transaction | A transaction split into multiple recurring payments, identified by the `(\d+)/(\d+)` regex pattern appended to the description (e.g., HYUNDAI ALPHAVILLE03/06 for 3 of 6 installments) |
| Partial Import | Importing a subset of transactions from a bill CSV file, with subsequent imports adding only missing transactions |
| Conflict | A transaction in the uploaded file that already exists in a Bill with a different month-year ID than the one being imported |

## 3. Requirements, Constraints & Guidelines
### Requirements
- **REQ-001**: On every CSV file import, the application must prompt the user to enter a Bill identification in month-year (MM-YYYY) format.
- **REQ-002**: Before processing an import, the application must check all transactions in the uploaded file against existing database transactions to identify any that are associated with a Bill other than the one being imported.
- **REQ-003**: If any conflicting transaction (per REQ-002) is found, the entire import must be refused (all transactions in the file). The error message must list all conflicting transactions and the Bill ID (month-year) they belong to.
- **REQ-004**: If no conflicts exist, proceed with import: ignore transactions already present in the database for the target Bill, add only new non-existing transactions.
- **REQ-005**: Implement a new Bills visualization screen with a table containing columns: Bill ID (month-year), Total Transactions, Total Amount (sum of all transaction amounts), Total Installment Transactions, Total Installment Amount, Last Updated (Bill.updatedAt).
- **REQ-006**: Each row in the Bills table must be clickable or include a dedicated button to navigate to the Transactions list screen, filtered to show only transactions associated with that Bill.
- **REQ-007**: The Transactions list UI must include a header displaying the Bill identification (month-year) of the currently viewed transactions. The view always shows transactions for a single bill.
- **REQ-008**: A `Bill` model must be added to the Prisma schema with fields: `id` (auto-generated CUID), `monthYear` (unique string, MM-YYYY format), `createdAt`, `updatedAt`.
- **REQ-009**: The existing `Transaction` model must be updated to include a required `billId` foreign key referencing the `Bill` model.

### Constraints
- **CON-001**: Bill month-year input must follow strict MM-YYYY format (e.g., `04-2026`, `12-2025`) and be validated on submission.
- **CON-002**: A Transaction can be associated with exactly one Bill; cross-bill transaction associations are prohibited.
- **CON-003**: Import operations must be atomic: either all eligible new transactions are added to the target Bill, or no changes are made (on conflict with other Bills).
- **CON-004**: The Transactions list UI always displays transactions for a single bill; no view for all bills exists.

### Guidelines
- **GUD-001**: Follow existing Prisma schema conventions when adding the `Bill` model and `Transaction` relation.
- **GUD-002**: Use existing UI component patterns (Tailwind CSS v4, Next.js App Router) for the new Bills screen and Transaction header.
- **GUD-003**: Reuse existing CSV parsing logic from `src/lib/parsers/itau.ts`; only add bill association and conflict checking steps.
- **GUD-004**: Use existing API route patterns for new `/api/bills` endpoints and updated import/transactions routes. Preserve existing pagination functionality in the Transactions list.

## 4. Interfaces & Data Contracts
### Prisma Schema Changes
Add `Bill` model and update `Transaction` model:
```prisma
// New Bill model
model Bill {
  id          String   @id @default(cuid())
  monthYear   String   @unique @db.String(7) // MM-YYYY format (7 characters), validated at database level
  transactions Transaction[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// Updated Transaction model (additions)
model Transaction {
  // ... existing fields
  billId      String
  bill        Bill     @relation(fields: [billId], references: [id])

  @@index([billId]) // Index for performance on bill-based queries
}
```

### API Endpoints
#### POST /api/transactions/import
Accepts multipart/form-data with fields:
- `file`: CSV file (Itau format)
- `billMonthYear`: String (MM-YYYY format)

Responses:
- `200 OK`: Import successful. Returns `{ success: true, added: number, ignored: number }`
- `400 Bad Request`: Invalid bill format, conflicting transactions, or file error. Returns `{ success: false, error: string, conflicts?: Array<{ transaction: string, existingBill: string }> }`. Examples:
  - Invalid format: `{ "success": false, "error": "Invalid bill ID format. Expected MM-YYYY (e.g., 04-2026)." }`
  - Conflicts: `{ "success": false, "error": "Conflicting transactions found in other bills", "conflicts": [{"transaction": "Netflix - 2026-03-15 - $15.99", "existingBill": "03-2026"}] }`

#### GET /api/bills
Returns array of bill objects with aggregated data:
```json
[
  {
    "id": "clx0y1z2a0000bz3x4d5e6f7g",
    "monthYear": "04-2026",
    "totalTransactions": 42,
    "totalAmount": 1234.56,
    "totalInstallmentTransactions": 12,
    "totalInstallmentAmount": 567.89,
    "lastUpdated": "2026-04-30T12:34:56.789Z"
  }
]
```

#### GET /api/bills/{billId}/transactions
Returns transactions filtered by the specified Bill ID, plus bill context:
```json
{
  "bill": { "id": "xxx", "monthYear": "04-2026" },
  "transactions": [ ... ] // existing transaction array
}
```

### UI Routes
- `/bills`: New Bills visualization screen (Next.js App Router page: `src/app/bills/page.tsx`)
- `/bills/{billId}/transactions`: Transactions list screen for a specific bill, displaying bill header (Next.js App Router page: `src/app/bills/[billId]/transactions/page.tsx`)

## 5. Acceptance Criteria
- **AC-001**: Given a user uploads a valid Itau CSV file and enters a valid MM-YYYY bill ID, When no transactions in the file exist in other Bills, Then the import proceeds, existing transactions for the target Bill are ignored, and only new transactions are added to the database.
- **AC-002**: Given a user uploads a CSV file and enters a bill ID, When any transaction in the file exists in a different Bill (month-year), Then the import is refused, and an error message is displayed listing all conflicting transactions and their associated Bill IDs.
- **AC-003**: Given a user navigates to the `/bills` screen, When the page loads, Then a table is displayed with columns: Bill ID (month-year), Total Transactions, Total Amount, Total Installment Transactions, Total Installment Amount, Last Updated.
- **AC-004**: Given a user is on the `/bills` screen, When they click a bill row or dedicated button, Then they are navigated to the `/bills/{billId}/transactions` screen for that Bill, with the Bill's month-year displayed in the header.
- **AC-005**: Given a user is viewing the `/bills/{billId}/transactions` screen, When the page loads, Then the header displays the Bill's month-year identification.
- **AC-006**: Given a user enters an invalid bill ID (not matching MM-YYYY format), When they attempt to import, Then the import is refused with a validation error specifying the invalid bill ID format.
- **AC-007**: Given a user imports a partial CSV for a Bill (8 new transactions, 2 existing in target Bill), When the import completes, Then only the 8 new transactions are added, and the 2 existing are ignored.

## 6. Test Automation Strategy
- **Test Levels**: Unit (parsers, validation logic), Integration (API routes, Prisma database operations), Component (React component rendering and user interactions)
- **Frameworks**: Vitest (existing test runner), React Testing Library (component tests), Prisma test database (SQLite in-memory for integration tests)
- **Test Data Management**: Seed test database with sample Bills and Transactions; clean up test data after each test run
- **CI/CD Integration**: Existing GitHub Actions CI pipeline (`.github/workflows/ci.yml`) runs all tests via `bun run test`; new tests for the bills feature are included automatically
- **Coverage Requirements**: Maintain 90% minimum code coverage for new feature code; all existing tests must pass (no regressions)
- **Performance Testing**: Not required for initial implementation; may be added if bill lists grow beyond 1000 records. Include test scenarios for pagination on the Transactions page and large datasets (e.g., 100+ bills, 1000+ transactions per bill).

## 7. Rationale & Context
The existing application supports importing transactions but lacks the ability to manage multiple billing cycles. This leads to:
- Unclear association between transactions and their billing cycles
- Potential for importing the same transaction into multiple billing cycles
- No way to review or manage multiple months of bills

The MM-YYYY format for Bill IDs aligns with standard credit card billing cycle conventions, making it intuitive for users. Associating transactions with bills ensures data integrity and enables accurate financial tracking per billing cycle. The conflict check prevents accidental duplicate imports across cycles, while partial import support accommodates real-world scenarios where billing statements are updated after initial import.

## 8. Dependencies & External Integrations
### External Systems
None.

### Third-Party Services
None.

### Infrastructure Dependencies
- **INF-001**: SQLite database (`dev.db`) - Must support Prisma schema migrations for the new `Bill` model and `Transaction` relation update.
- **INF-002**: Next.js 16 App Router - Required for implementing the new `/bills` page and updated API routes.
- **INF-003**: Bun runtime - Required for running Prisma commands (`bun --bun run prisma migrate dev`) and dev server as per existing project configuration.

### Data Dependencies
- **DAT-001**: Itau CSV format - Import logic must continue to support the existing CSV format defined in `src/lib/parsers/itau.ts`.

### Technology Platform Dependencies
- **PLT-001**: TypeScript - Required for type safety on new interfaces, API contracts, and Prisma client updates.
- **PLT-002**: Tailwind CSS v4 - Required for styling the new Bills screen and Transaction header to match existing UI patterns.

### Compliance Dependencies
None.

## 9. Examples & Edge Cases
### Prisma Migration Example
After updating `prisma/schema.prisma`, run:
```bash
bun --bun run prisma migrate dev --name add_bill_model
```

### Conflict Error Example
Uploading a transaction that exists in the `03-2026` bill to the `04-2026` bill returns:
```json
{
  "success": false,
  "error": "Conflicting transactions found in other bills",
  "conflicts": [
    {
      "transaction": "Netflix (1/3) - 2026-03-15 - $15.99",
      "existingBill": "03-2026"
    }
  ]
}
```

### Edge Cases
1. **Partial Import**: User imports 10 transactions for `04-2026`, 8 are new, 2 already exist in `04-2026`. Import adds 8 new transactions, ignores 2 existing.
2. **Invalid Bill Format**: User enters `April 2026` instead of `04-2026` → import refused with format validation error.
3. **Empty Bill**: User imports a file with no new transactions for an existing bill → import succeeds, reports 0 added, N ignored.
4. **Bill with No Transactions**: User creates a bill but imports no transactions → Bills table shows the bill row with 0 for all transaction counts and amounts (table starts empty and grows with imports).

## 10. Validation Criteria
- All Acceptance Criteria (AC-001 to AC-007) are satisfied
- Prisma schema migrations for the `Bill` model and `Transaction` relation run successfully
- All existing tests pass (no regressions)
- New unit, integration, and component tests for the bills feature pass
- `bun run lint` and TypeScript type checking complete without errors
- New Bills screen renders correctly per REQ-005 and REQ-006
- Transaction header displays bill ID per REQ-007

## 11. Related Specifications / Further Reading
- [AGENTS.md](AGENTS.md) - Dev commands, tech stack, and existing file references
- [prisma/schema.prisma](prisma/schema.prisma) - Existing data model
- [src/lib/parsers/itau.ts](src/lib/parsers/itau.ts) - Existing import logic
- [src/app/api/transactions/route.ts](src/app/api/transactions/route.ts) - To be updated with bill filtering
- [src/app/api/transactions/import/route.ts](src/app/api/transactions/import/route.ts) - To be updated with bill ID and conflict checking
