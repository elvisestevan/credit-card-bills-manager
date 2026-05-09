---
title: Transaction Categorization Feature Design Specification
version: 1.0
date_created: 2026-05-06
last_updated: 2026-05-06
owner: Elvis
tags: [design, app, feature, transaction, categorization]
---

# Introduction
This specification defines the design, requirements, and acceptance criteria for a new Transaction Categorization feature in the Credit Card Bills Manager application. The feature includes sidebar menu updates, new /bills and /categorization pages, modal-based categorization workflow, bulk update prompts, and new category creation.

## 1. Purpose & Scope
### Purpose
Enable users to assign categories to uncategorized credit card transactions, bulk-update transactions with matching names, and create new categories on the fly.
### Scope
- Sidebar navigation with Bills and Categorize Transactions menu items
- New /bills page listing all bills with transaction stats
- New /categorization page listing bills with pending transactions
- Modal workflow for single and bulk transaction categorization
- Category management (create new, select existing)
### Assumptions
- Application uses Next.js 16 App Router, Prisma with SQLite (per AGENTS.md)
- A "Bill" represents a monthly credit card statement period
- Transactions are associated with a single Bill
### Intended Audience
Frontend/backend developers implementing the feature, QA engineers validating acceptance criteria.

## 2. Definitions
- **Bill**: Monthly credit card statement with `startDate`, `endDate`, unique ID. Contains associated transactions.
- **Transaction**: Credit card charge/refund with `id`, `date`, `description`, `amount`, `installmentInfo`, `categoryId` (nullable), `billId`.
- **Pending Transaction**: Transaction with `categoryId = null` (uncategorized).
- **Category**: User-defined transaction label with `id` and `name` fields.
- **Next Transaction**: Oldest Pending Transaction for a bill, sorted by transaction date ascending.

## 3. Requirements, Constraints & Guidelines
### Functional Requirements
- **REQ-001**: Add sidebar with "Bills" (links to /bills) and "Categorize Transactions" (links to /categorization) menu items.
- **REQ-002**: /bills page lists all bills, each showing: total transaction count, pending transaction count, total pending amount.
- **REQ-003**: /categorization page lists only bills with ≥1 Pending Transaction, each with stats and a "Categorize" button.
- **REQ-004**: Clicking "Categorize" opens a modal displaying the Next Transaction for that bill (all fields: date, description, amount, installments).
- **REQ-005**: Modal includes a category dropdown that: (a) loads all existing categories, (b) supports mouse selection, (c) supports type-to-filter, (d) shows "Create new category: [typed name]" if no match exists.
- **REQ-006**: Selecting an existing category updates the transaction's `categoryId` to the selected category's ID.
- **REQ-007**: After updating a transaction, search for other Pending Transactions with the exact same `description` (case-insensitive). Prompt user to bulk update if matches exist. Bulk updates should only apply to transactions without a category and require a confirmation step to proceed.
- **REQ-008**: Confirming bulk update applies the selected category to all matching Pending Transactions.
- **REQ-009**: Typing a new category name and selecting "Create new" adds the category to the database and assigns it to the current transaction.
- **REQ-010**: After categorizing a transaction, load the next Pending Transaction for the same bill in the modal, or close if none remain.
### Constraints
- **CON-001**: Use existing tech stack: Next.js 16 App Router, Tailwind CSS v4, Prisma with SQLite.
- **CON-002**: New Prisma models must use `bun --bun run prisma migrate dev` for migrations.
- **CON-003**: Enforce unique constraint on `Category.name` in Prisma schema.
- **CON-004**: Category names will be stored in lowercase to avoid duplication issues.
### Guidelines
- **GUD-001**: Follow existing component patterns in `src/components/` for modal, table, dropdown.
- **GUD-002**: Use existing UI libraries (e.g., shadcn/ui) for components if available.
- **GUD-003**: Show toast notifications for successful updates, errors, and bulk update prompts.
- **GUD-004**: Special characters in category names will be sanitized to ensure consistency and prevent errors.

### Assumptions
- **ASM-001**: The application is single-user and used locally, so performance optimizations for large datasets are not required at this stage.
- **ASM-002**: Renaming or deleting categories is out of scope for this feature.
- **ASM-003**: Localization is not required as the application will only support one language.
- **ASM-004**: Pagination and filtering for bills and transactions are not necessary at this stage but can be revisited as the dataset grows.

## 4. Interfaces & Data Contracts
### Prisma Schema Updates
```prisma
// Add to existing schema.prisma
model Category {
  id          Int          @id @default(autoincrement())
  name        String       @unique
  transactions Transaction[]
  createdAt   DateTime     @default(now())
}

model Bill {
  id          Int          @id @default(autoincrement())
  startDate   DateTime
  endDate     DateTime
  transactions Transaction[]
  createdAt   DateTime     @default(now())
}

model Transaction {
  // Existing fields retained
  categoryId  Int?
  category    Category?    @relation(fields: [categoryId], references: [id])
  billId      Int
  bill        Bill         @relation(fields: [billId], references: [id])
}
```

### API Endpoints
| Endpoint | Method | Description | Request Body | Response |
|----------|--------|-------------|--------------|----------|
| `/api/bills` | GET | List all bills with transaction stats | None | Array of bill objects with `totalTransactions`, `pendingCount`, `pendingAmount` |
| `/api/bills/[id]/next-transaction` | GET | Get next Pending Transaction for a bill | None | Transaction object or 404 if no pending |
| `/api/transactions/[id]` | PATCH | Update transaction category | `{ categoryId: number }` or `{ categoryName: string }` | Updated transaction object |
| `/api/categories` | GET | List all categories | None | Array of category objects |
| `/api/categories` | POST | Create new category | `{ name: string }` | New category object |

### Page Routes
| Route | Description |
|-------|-------------|
| `/bills` | List all bills with transaction stats |
| `/categorization` | List bills with pending transactions, categorization workflow |

## 5. Acceptance Criteria
- **AC-001**: Given sidebar is rendered, when page loads, then "Bills" and "Categorize Transactions" menu items are visible.
- **AC-002**: Given user navigates to /bills, when page loads, then all bills are listed with required stats.
- **AC-003**: Given user navigates to /categorization, when page loads, then only bills with ≥1 Pending Transaction are listed.
- **AC-004**: Given user clicks "Categorize" on a bill, when modal opens, then the oldest Pending Transaction (by date) is displayed.
- **AC-005**: Given modal is open, when user types in category dropdown, then existing categories are filtered or "Create new" option appears.
- **AC-006**: Given user selects existing category and confirms, when update succeeds, then transaction is updated and next pending transaction loads.
- **AC-007**: Given transaction is updated, when matching same-description pending transactions exist, then bulk update prompt appears.
- **AC-008**: Given user confirms bulk update, when update succeeds, then all matching transactions have the same category.
- **AC-009**: Given user types new category name and selects create, when category is created, then transaction is assigned to new category.

## 6. Test Automation Strategy
- **Test Levels**: Unit (API endpoints), Component (modal/table/dropdown), E2E (full workflow)
- **Frameworks**: Vitest, React Testing Library (existing per AGENTS.md), Playwright (E2E)
- **Test Data Management**: Prisma test database seeded with test bills, transactions, categories
- **CI/CD Integration**: Add new test jobs to existing `.github/workflows/ci.yml`
- **Coverage Requirements**: 90% minimum for new feature files
- **Performance Testing**: Modal loads next transaction in <500ms, dropdown filters in <200ms

## 7. Rationale & Context
- "Categorize Transactions" menu name is action-oriented and clearer than "Categorization".
- Bills page provides context for statement periods, aligning with the app's core purpose.
- Bulk update prompts reduce effort for recurring transactions (e.g., monthly subscriptions).
- On-the-fly category creation avoids separate category management pages.

## 8. Dependencies & External Integrations
### External Systems
- None
### Third-Party Services
- None
### Infrastructure Dependencies
- **INF-001**: SQLite database (existing) for new Category and Bill models
- **INF-002**: Bun/Node.js runtime (existing) for Next.js and Prisma
### Data Dependencies
- **DAT-001**: Existing Transaction data with `description` field for matching
### Technology Platform Dependencies
- **PLT-001**: Next.js 16 App Router, Tailwind CSS v4, Prisma with libsql adapter (all existing)
### Compliance Dependencies
- None

## 9. Examples & Edge Cases
### Category Dropdown Flow
```typescript
// User types "Gro" in dropdown
// Existing categories: ["Groceries", "Dining", "Transport"]
// Filtered results: ["Groceries"]
// If user types "Travel" (no match):
// Dropdown shows: ["Create new category: Travel"]
```

### Edge Case: No Pending Transactions
```typescript
// All transactions for a bill are categorized
// Bill does not appear on /categorization page
// "Categorize" button is disabled on /bills page for that bill
```

### Edge Case: Same Description Across Bills
```typescript
// Matching transactions for bulk update include all pending transactions across all bills with the same description
// Prompt counts all matching transactions, not just those in the current bill
```

## 10. Validation Criteria
- All acceptance criteria (AC-001 to AC-009) pass
- All new unit/component tests pass (existing 48 + new tests)
- Lint and typecheck pass for all new code
- Prisma migrations apply successfully without errors
- No console errors during manual workflow testing

## 11. Related Specifications / Further Reading
- [AGENTS.md](./AGENTS.md) (Existing project instructions)
- [Prisma Schema Docs](https://www.prisma.io/docs/concepts/components/prisma-schema)
- [Next.js App Router Docs](https://nextjs.org/docs/app)
